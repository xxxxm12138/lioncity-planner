/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Photo, PhotoCurationResult, PostFormat, CuratedPost, CollageLayout } from '../types';
import { photoToBase64Jpeg } from './imageUtils';

/** Max images per API request. Larger sets are auto-batched. */
const BATCH_SIZE = 24;

function chunkPhotos<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

function demoCurate(photos: Photo[], day: number): PhotoCurationResult {
  const formats: PostFormat[] = ['grid', 'poster', 'mono', 'text_card', 'single_hero'];
  const posts: CuratedPost[] = [];
  let idx = 0;
  let order = 1;
  while (idx < photos.length) {
    const format = formats[(order - 1) % formats.length];
    const count =
      format === 'grid' ? Math.min(9, photos.length - idx) :
      format === 'poster' ? Math.min(5, photos.length - idx) :
      1;
    const slice = photos.slice(idx, idx + count);
    if (slice.length === 0) break;
    const collageLayout: CollageLayout =
      format === 'single_hero' || slice.length === 1 ? 'single_hero' :
      slice.length === 2 ? 'duo_balance' :
      slice.length === 3 ? 'blur_bg_stack' :
      slice.length <= 5 ? 'blur_bg_scatter' :
      slice.length <= 8 ? 'hero_2x2' : 'grid_3x3';
    posts.push({
      id: `demo-${order}`,
      title: `第 ${order} 条 · ${slice[0].locationName || '旅途片段'}`,
      theme: order % 3 === 0 ? '人物' : order % 3 === 1 ? '地标建筑' : '美食',
      timeSlot: order <= 2 ? '上午' : order <= 4 ? '午后' : '傍晚',
      scene: `场景 ${order}`,
      mood: order % 2 === 0 ? '明亮纪实' : '电影感',
      storylineOrder: order,
      format,
      caption: `Day ${day} · ${slice[0].locationName || '新加坡'} 的一段记忆。`,
      hashtags: ['#新加坡旅行', '#狮城', '#朋友圈'],
      photoIds: slice.map(p => p.id),
      collageLayout,
      collageRationale: '演示分组：同组色调接近，人物照与环境照搭配。',
      layoutHint: format === 'grid' ? '九宫格主图放第一张' : undefined,
    });
    idx += count;
    order += 1;
  }
  return {
    day,
    summary: `（本地演示）已将 ${photos.length} 张照片拆成 ${posts.length} 条方案。部署到 Vercel 且配置 GEMINI_API_KEY 后将使用服务端 AI 识图。`,
    posts,
  };
}

export type CurateProgress = { current: number; total: number; phase?: 'compress' | 'analyze' };

export async function fetchServerHasGemini(): Promise<boolean> {
  try {
    const res = await fetch('/api/config', { cache: 'no-store' });
    if (!res.ok) return false;
    const data = (await res.json()) as { hasGemini?: boolean };
    return Boolean(data.hasGemini);
  } catch {
    return false;
  }
}

async function curateBatchViaApi(
  allPhotos: Photo[],
  chunk: Photo[],
  globalOffset: number,
  day: number,
  tripContext: string,
  batchIndex: number,
  totalBatches: number,
  priorContext: string
): Promise<{ summary: string; posts: CuratedPost[] }> {
  const images = await Promise.all(
    chunk.map(async p => ({
      id: p.id,
      locationName: p.locationName,
      day: p.day,
      base64: await photoToBase64Jpeg(p.url, 640),
    }))
  );

  const res = await fetch('/api/curate-batch', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      allPhotoMeta: allPhotos.map(p => ({ id: p.id, locationName: p.locationName, day: p.day })),
      images: images.map(({ id, locationName, day, base64 }) => ({ id, locationName, day, base64 })),
      globalOffset,
      day,
      tripContext,
      batchIndex,
      totalBatches,
      priorContext,
    }),
  });

  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(err.error || `分析请求失败 (${res.status})`);
  }

  return res.json() as Promise<{ summary: string; posts: CuratedPost[] }>;
}

export async function curateDayPhotos(
  photos: Photo[],
  day: number,
  tripContext?: string,
  onProgress?: (p: CurateProgress) => void
): Promise<PhotoCurationResult> {
  if (photos.length === 0) {
    return { day, summary: '没有照片可分析', posts: [] };
  }

  const serverOk = await fetchServerHasGemini();
  if (!serverOk) {
    await new Promise(r => setTimeout(r, 800));
    return demoCurate(photos, day);
  }

  const chunks = chunkPhotos(photos, BATCH_SIZE);
  const allPosts: CuratedPost[] = [];
  const summaries: string[] = [];
  let priorContext = '';

  for (let b = 0; b < chunks.length; b++) {
    onProgress?.({ current: b + 1, total: chunks.length, phase: 'compress' });
    const offset = b * BATCH_SIZE;

    onProgress?.({ current: b + 1, total: chunks.length, phase: 'analyze' });
    const { summary, posts } = await curateBatchViaApi(
      photos,
      chunks[b],
      offset,
      day,
      tripContext || '',
      b,
      chunks.length,
      priorContext
    );

    summaries.push(summary);
    for (const post of posts) {
      allPosts.push({
        ...post,
        storylineOrder: b * 1000 + post.storylineOrder,
      });
    }

    const sceneList = posts.map(p => p.scene).filter(Boolean).slice(0, 6).join('、');
    priorContext = `上一批已整理场景包括：${sceneList || '（无）'}。上一批摘要：${summary}`;
  }

  allPosts.sort((a, b) => a.storylineOrder - b.storylineOrder);
  const merged = allPosts.map((p, i) => ({
    ...p,
    id: `curate-${day}-${i + 1}`,
    storylineOrder: i + 1,
  }));

  const batchNote =
    chunks.length > 1
      ? `共 ${photos.length} 张照片，分 ${chunks.length} 批由服务端 AI 分析完成。`
      : `共 ${photos.length} 张照片，已由服务端 AI 分析。`;

  if (merged.length === 0) {
    const fallback = demoCurate(photos, day);
    return {
      ...fallback,
      summary: `${batchNote} 模型分组编号未能匹配到照片，已按顺序自动生成 ${fallback.posts.length} 条方案。`,
    };
  }

  const usedIds = new Set(merged.flatMap(p => p.photoIds));
  const unusedPhotoIds = photos.filter(p => !usedIds.has(p.id)).map(p => p.id);

  return {
    day,
    summary:
      [batchNote, summaries.filter(Boolean).join(' ')].filter(Boolean).join(' ') ||
      `已整理 ${merged.length} 条发布方案`,
    posts: merged,
    unusedPhotoIds: unusedPhotoIds.length ? unusedPhotoIds : undefined,
  };
}

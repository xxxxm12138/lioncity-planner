/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Server-only: uses GEMINI_API_KEY from Vercel runtime env (never exposed to browser).
 */

import { GoogleGenAI, Type } from '@google/genai';
import { Photo, PostFormat, CuratedPost } from '../types';

export type PhotoPayload = {
  id: string;
  locationName: string;
  day: number;
  base64: string;
};

const schema = {
  type: Type.OBJECT,
  properties: {
    summary: { type: Type.STRING },
    posts: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          title: { type: Type.STRING },
          scene: { type: Type.STRING },
          mood: { type: Type.STRING },
          storylineOrder: { type: Type.INTEGER },
          format: {
            type: Type.STRING,
            enum: ['grid', 'poster', 'mono', 'text_card', 'single_hero'],
          },
          caption: { type: Type.STRING },
          hashtags: { type: Type.ARRAY, items: { type: Type.STRING } },
          photoIndices: {
            type: Type.ARRAY,
            items: { type: Type.INTEGER },
          },
          layoutHint: { type: Type.STRING },
        },
        required: ['title', 'scene', 'mood', 'storylineOrder', 'format', 'caption', 'photoIndices'],
      },
    },
  },
  required: ['summary', 'posts'],
};

type RawPost = {
  title: string;
  scene: string;
  mood: string;
  storylineOrder: number;
  format: PostFormat;
  caption: string;
  hashtags: string[];
  photoIndices: number[];
  layoutHint?: string;
};

export function getServerGeminiKey() {
  return (process.env.GEMINI_API_KEY || '').trim();
}

/** Override in Vercel: GEMINI_MODEL=gemini-2.5-flash */
export function getServerGeminiModel() {
  return (process.env.GEMINI_MODEL || 'gemini-2.5-flash').trim();
}

/** Map model photoIndices (global / batch-local / 1-based) to global indices in allPhotoMeta. */
function normalizeGlobalIndices(
  indices: number[],
  globalOffset: number,
  batchLength: number,
  totalPhotos: number
): number[] {
  const globalMax = globalOffset + batchLength;
  const out: number[] = [];
  const seen = new Set<number>();

  for (let ix of indices) {
    if (typeof ix !== 'number' || !Number.isFinite(ix)) continue;
    ix = Math.round(ix);

    let global: number | null = null;
    if (ix >= globalOffset && ix < globalMax) {
      global = ix;
    } else if (ix >= 0 && ix < batchLength) {
      global = globalOffset + ix;
    } else if (ix >= 1 && ix <= batchLength) {
      global = globalOffset + ix - 1;
    } else if (
      globalOffset === 0 &&
      batchLength === totalPhotos &&
      ix >= 1 &&
      ix <= totalPhotos
    ) {
      global = ix - 1;
    }

    if (global != null && global >= 0 && global < totalPhotos && !seen.has(global)) {
      seen.add(global);
      out.push(global);
    }
  }
  return out;
}

function fallbackBatchPosts(
  allPhotoMeta: Pick<Photo, 'id' | 'locationName' | 'day'>[],
  globalOffset: number,
  batchLength: number,
  aiSummary?: string
): CuratedPost[] {
  const formats: PostFormat[] = ['grid', 'poster', 'mono', 'text_card', 'single_hero'];
  const posts: CuratedPost[] = [];
  let local = 0;
  let order = 1;

  while (local < batchLength) {
    const format = formats[(order - 1) % formats.length];
    const count =
      format === 'grid' ? Math.min(9, batchLength - local) :
      format === 'poster' ? Math.min(5, batchLength - local) :
      1;
    const globals: number[] = [];
    for (let i = 0; i < count; i++) globals.push(globalOffset + local + i);
    const photoIds = globals
      .map(g => allPhotoMeta[g]?.id)
      .filter(Boolean) as string[];
    if (photoIds.length === 0) break;

    const first = allPhotoMeta[globals[0]];
    posts.push({
      id: `fallback-${globalOffset}-${order}`,
      title: `第 ${order} 条 · ${first?.locationName || '旅途片段'}`,
      scene: '自动分组',
      mood: order % 2 === 0 ? '明亮纪实' : '电影感',
      storylineOrder: order,
      format,
      caption:
        aiSummary?.slice(0, 120) ||
        `Day ${first?.day ?? 1} · ${first?.locationName || '新加坡'} 的一段记忆。`,
      hashtags: ['#新加坡旅行', '#狮城', '#朋友圈'],
      photoIds,
      layoutHint: format === 'grid' ? '九宫格主图放第一张' : undefined,
    });
    local += count;
    order += 1;
  }
  return posts;
}

export function formatGeminiError(e: unknown): string {
  const raw = e instanceof Error ? e.message : String(e);
  if (
    raw.includes('429') ||
    raw.includes('RESOURCE_EXHAUSTED') ||
    /quota|rate.?limit|too many requests/i.test(raw)
  ) {
    return (
      'Gemini API 免费额度已用完或请求太频繁（429）。请稍等 1～2 分钟后用更少照片重试；' +
      '若仍失败，请到 Google AI Studio 查看用量/开通计费，或在 Vercel 设置环境变量 GEMINI_MODEL（如 gemini-2.5-flash）。'
    );
  }
  try {
    const j = JSON.parse(raw) as { error?: { message?: string } };
    if (j.error?.message) return j.error.message;
  } catch {
    /* not JSON */
  }
  return raw.length > 280 ? `${raw.slice(0, 280)}…` : raw;
}

export async function curateBatchOnServer(params: {
  allPhotoMeta: Pick<Photo, 'id' | 'locationName' | 'day'>[];
  images: PhotoPayload[];
  globalOffset: number;
  day: number;
  tripContext: string;
  batchIndex: number;
  totalBatches: number;
  priorContext: string;
}): Promise<{ summary: string; posts: CuratedPost[] }> {
  const key = getServerGeminiKey();
  if (!key) {
    throw new Error('GEMINI_API_KEY 未在服务端环境变量中配置');
  }

  const ai = new GoogleGenAI({ apiKey: key });
  const { allPhotoMeta, images, globalOffset, tripContext, batchIndex, totalBatches, priorContext } = params;
  const globalEnd = globalOffset + images.length - 1;

  const imageParts = images.map((img, i) => ({
    text: `[global_index=${globalOffset + i}] id=${img.id} filename=${img.locationName}`,
    inlineData: { mimeType: 'image/jpeg' as const, data: img.base64 },
  }));

  const prompt = `
你是旅行摄影编辑 + 社交媒体运营。请按「场景相似」「色调/情绪」「故事线顺序」整理成多条朋友圈发布方案。

行程背景: ${tripContext || '新加坡自由行'}

${totalBatches > 1 ? `
分批说明: 第 ${batchIndex + 1}/${totalBatches} 批。本批全局编号 ${globalOffset}–${globalEnd}（全天共 ${allPhotoMeta.length} 张）。
${priorContext}
` : ''}

要求：
1. 相似场景放在同一条 post。
2. storylineOrder 本批内从早到晚。
3. format: grid | poster | mono | text_card | single_hero
4. caption 中文 1~3 句；hashtags 3~5 个。
5. photoIndices 用全局编号 ${globalOffset}..${globalEnd}，每条 1~9 张，不重复。
6. 只返回 JSON。
`;

  const parts = [{ text: prompt }, ...imageParts.flatMap(p => [{ text: p.text }, { inlineData: p.inlineData }])];

  const response = await ai.models.generateContent({
    model: getServerGeminiModel(),
    contents: [{ role: 'user', parts }],
    config: {
      responseMimeType: 'application/json',
      responseSchema: schema,
    },
  });

  const raw = JSON.parse(response.text || '{}') as { summary?: string; posts?: RawPost[] };
  const batchLength = images.length;
  const totalPhotos = allPhotoMeta.length;
  const usedGlobal = new Set<number>();

  let posts = (raw.posts || [])
    .sort((a, b) => a.storylineOrder - b.storylineOrder)
    .map((p, i) => {
      const indices = normalizeGlobalIndices(
        p.photoIndices || [],
        globalOffset,
        batchLength,
        totalPhotos
      )
        .filter(ix => !usedGlobal.has(ix))
        .slice(0, 9);
      indices.forEach(ix => usedGlobal.add(ix));
      const photoIds = indices.map(ix => allPhotoMeta[ix]?.id).filter(Boolean) as string[];
      return {
        id: `curate-batch-${globalOffset}-${i}`,
        title: p.title,
        scene: p.scene,
        mood: p.mood,
        storylineOrder: p.storylineOrder,
        format: p.format,
        caption: p.caption,
        hashtags: p.hashtags || [],
        photoIds,
        layoutHint: p.layoutHint,
      };
    })
    .filter(p => p.photoIds.length > 0);

  if (posts.length === 0 && batchLength > 0) {
    posts = fallbackBatchPosts(allPhotoMeta, globalOffset, batchLength, raw.summary);
  }

  return { summary: raw.summary || '', posts };
}

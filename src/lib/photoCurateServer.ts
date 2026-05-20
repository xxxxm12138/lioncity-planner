/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Server-only: uses GEMINI_API_KEY from Vercel runtime env (never exposed to browser).
 */

import { GoogleGenAI, Type } from '@google/genai';
import { Photo, PostFormat, CuratedPost, CollageLayout } from '../types';

const COLLAGE_LAYOUTS: CollageLayout[] = [
  'grid_3x3',
  'hero_2x2',
  'triptych_vertical',
  'duo_balance',
  'filmstrip',
  'single_hero',
  'blur_bg_stack',
  'blur_bg_scatter',
];

function parseCollageLayout(value: string | undefined, format: PostFormat, count: number): CollageLayout {
  const v = (value || '').trim() as CollageLayout;
  if (COLLAGE_LAYOUTS.includes(v)) return v;
  if (format === 'single_hero' || count === 1) return 'single_hero';
  if (count === 2) return 'duo_balance';
  if (count === 3) return 'blur_bg_stack';
  if (count <= 5 && (format === 'poster' || format === 'grid')) return 'blur_bg_scatter';
  if (count <= 5) return 'blur_bg_scatter';
  if (count >= 6 || format === 'grid') return 'grid_3x3';
  return 'hero_2x2';
}

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
          theme: { type: Type.STRING },
          timeSlot: { type: Type.STRING },
          scene: { type: Type.STRING },
          mood: { type: Type.STRING },
          storylineOrder: { type: Type.INTEGER },
          format: {
            type: Type.STRING,
            enum: ['grid', 'poster', 'mono', 'text_card', 'single_hero'],
          },
          collageLayout: {
            type: Type.STRING,
            enum: COLLAGE_LAYOUTS,
          },
          collageRationale: { type: Type.STRING },
          caption: { type: Type.STRING },
          hashtags: { type: Type.ARRAY, items: { type: Type.STRING } },
          photoIndices: {
            type: Type.ARRAY,
            items: { type: Type.INTEGER },
          },
          layoutHint: { type: Type.STRING },
        },
        required: [
          'title',
          'theme',
          'timeSlot',
          'scene',
          'mood',
          'storylineOrder',
          'format',
          'collageLayout',
          'collageRationale',
          'caption',
          'photoIndices',
        ],
      },
    },
  },
  required: ['summary', 'posts'],
};

type RawPost = {
  title: string;
  theme?: string;
  timeSlot?: string;
  scene: string;
  mood: string;
  storylineOrder: number;
  format: PostFormat;
  collageLayout?: string;
  collageRationale?: string;
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
    const collageLayout = parseCollageLayout(undefined, format, photoIds.length);
    posts.push({
      id: `fallback-${globalOffset}-${order}`,
      title: `第 ${order} 条 · ${first?.locationName || '旅途片段'}`,
      theme: '旅途随拍',
      timeSlot: order <= 2 ? '上午' : order <= 4 ? '午后' : '傍晚',
      scene: '自动分组',
      mood: order % 2 === 0 ? '明亮纪实' : '电影感',
      storylineOrder: order,
      format,
      caption:
        aiSummary?.slice(0, 120) ||
        `Day ${first?.day ?? 1} · ${first?.locationName || '新加坡'} 的一段记忆。`,
      hashtags: ['#新加坡旅行', '#狮城', '#朋友圈'],
      photoIds,
      collageLayout,
      collageRationale:
        '同组照片色调接近；人物照与空景/建筑照搭配，避免连续多张自拍。',
      layoutHint: format === 'grid' ? '九宫格：主图放第 1 格，其余按明暗交错' : undefined,
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
你是旅行故事线编辑。请根据图片内容，按【主题】与【时间线】告诉用户：哪些照片应该放在同一条朋友圈/同一段故事里，以及先后顺序。

行程背景: ${tripContext || '新加坡自由行'}

${totalBatches > 1 ? `
分批说明: 第 ${batchIndex + 1}/${totalBatches} 批。本批全局编号 ${globalOffset}–${globalEnd}（全天共 ${allPhotoMeta.length} 张）。
${priorContext}
` : ''}

## 分组原则（必须遵守）
1. **主题 theme**：每条只围绕一个主题（美食、建筑地标、自然、人物、酒店、街景、夜景等），不要混搭无关主题。
2. **时间线 timeSlot**：清晨/上午/午后/傍晚/夜间。storylineOrder 按时间从早到晚。
3. **编组逻辑**：同条内照片场景、色调、情绪相近；人物照与环境照合理搭配，说明为何放一起。
4. **photoIndices**：使用全局编号 ${globalOffset}..${globalEnd}，每条 1–9 张，不重复，本批尽量覆盖。

## 字段说明
- collageRationale：用中文写【编组说明】——哪些 global_index 放一起、顺序建议、色调/人景搭配理由（2–4 句）。不要描述拼图排版或海报设计。
- layoutHint：可选，补充「建议第几张作主图」等简短提示。
- collageLayout / format：填合理默认值即可（如 grid、poster），用户不再用于生成拼图。
- caption：该条朋友圈配文参考，中文 1~3 句；hashtags 3~5 个。

summary：概括整日如何按主题与时间线划分（1–2 句）。

只返回 JSON。
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
      const collageLayout = parseCollageLayout(p.collageLayout, p.format, photoIds.length);
      return {
        id: `curate-batch-${globalOffset}-${i}`,
        title: p.title,
        theme: p.theme || '旅途随拍',
        timeSlot: p.timeSlot || '全天',
        scene: p.scene,
        mood: p.mood,
        storylineOrder: p.storylineOrder,
        format: p.format,
        caption: p.caption,
        hashtags: p.hashtags || [],
        photoIds,
        collageLayout,
        collageRationale:
          p.collageRationale ||
          '同组色调统一；人物与环境照搭配，主图选故事感最强的一张。',
        layoutHint: p.layoutHint,
      };
    })
    .filter(p => p.photoIds.length > 0);

  if (posts.length === 0 && batchLength > 0) {
    posts = fallbackBatchPosts(allPhotoMeta, globalOffset, batchLength, raw.summary);
  }

  return { summary: raw.summary || '', posts };
}

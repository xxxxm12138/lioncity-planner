/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { curateBatchOnServer, formatGeminiError, PhotoPayload } from '../src/lib/photoCurateServer.js';

export const config = {
  maxDuration: 120,
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const body = req.body as {
      allPhotoMeta: { id: string; locationName: string; day: number }[];
      images: PhotoPayload[];
      globalOffset: number;
      day: number;
      tripContext?: string;
      batchIndex: number;
      totalBatches: number;
      priorContext?: string;
    };

    if (!body?.images?.length || !body.allPhotoMeta?.length) {
      return res.status(400).json({ error: '缺少照片数据' });
    }

    const result = await curateBatchOnServer({
      allPhotoMeta: body.allPhotoMeta,
      images: body.images,
      globalOffset: body.globalOffset,
      day: body.day,
      tripContext: body.tripContext || '',
      batchIndex: body.batchIndex,
      totalBatches: body.totalBatches,
      priorContext: body.priorContext || '',
    });

    return res.status(200).json(result);
  } catch (e) {
    console.error('curate-batch error', e);
    const message = formatGeminiError(e);
    const isQuota = /429|quota|RESOURCE_EXHAUSTED|rate.?limit/i.test(message);
    return res.status(isQuota ? 429 : 500).json({ error: message });
  }
}

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getServerGeminiKey } from '../src/lib/photoCurateServer.js';

export default function handler(_req: VercelRequest, res: VercelResponse) {
  res.setHeader('Cache-Control', 'no-store');
  return res.status(200).json({
    hasGemini: Boolean(getServerGeminiKey()),
  });
}

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/** Strip AI batch / system lines from summary; keep narrative lead only. */
export function sanitizeCurationSummary(summary: string): string {
  const tech = /共\s*\d+\s*张|服务端|分批|本地演示|模型分组|AI\s*分析|已按顺序|编号未能|整理\s*\d+\s*条/i;
  const parts = summary
    .split(/[。．!\n]+/)
    .map(s => s.trim())
    .filter(Boolean)
    .filter(s => !tech.test(s));
  if (parts.length === 0) return '';
  return parts.join('。') + '。';
}

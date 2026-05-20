/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Itinerary, Photo, PhotoCurationResult, CuratedPost } from '../types';

export type DayReportInput = {
  curation: PhotoCurationResult;
  itinerary: Itinerary;
  photosById: Map<string, Photo>;
};

function photoLabel(photo: Photo, indexInGroup: number): string {
  const name = photo.locationName || '照片';
  return `图 ${indexInGroup + 1} · ${name}`;
}

function buildPostSection(post: CuratedPost, photos: Photo[]): string {
  const photoLines = photos
    .map((p, i) => `<li>${photoLabel(p, i)}</li>`)
    .join('');
  const tags = post.hashtags?.length ? `<p class="tags">${post.hashtags.join(' ')}</p>` : '';
  const note = post.collageRationale || post.layoutHint || '';
  return `
    <section class="post">
      <header>
        <span class="order">故事线 #${post.storylineOrder}</span>
        <h3>${escapeHtml(post.title)}</h3>
        <p class="meta">${escapeHtml(post.theme)} · ${escapeHtml(post.timeSlot)} · ${escapeHtml(post.scene)} · ${escapeHtml(post.mood)}</p>
      </header>
      <div class="note">
        <strong>本组照片（${photos.length} 张）</strong>
        <ul>${photoLines || '<li>（无匹配照片）</li>'}</ul>
      </div>
      ${note ? `<div class="pairing"><strong>编组说明</strong><p>${escapeHtml(note)}</p></div>` : ''}
      <div class="caption-block">
        <strong>配文参考</strong>
        <p>${escapeHtml(post.caption)}</p>
        ${tags}
      </div>
      ${photos.length ? `<div class="thumbs">${photos.map(p => `<img src="${p.url}" alt="" />`).join('')}</div>` : ''}
    </section>
  `;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function buildDayReportHtml({ curation, itinerary, photosById }: DayReportInput): string {
  const dayPlan = itinerary.days.find(d => d.day === curation.day);
  const dayTitle = dayPlan?.title || `第 ${curation.day} 天`;
  const vibe = itinerary.narrative?.vibe || '';
  const sorted = [...curation.posts].sort((a, b) => a.storylineOrder - b.storylineOrder);

  const sections = sorted
    .map(post => {
      const photos = post.photoIds
        .map(id => photosById.get(id))
        .filter((p): p is Photo => Boolean(p));
      return buildPostSection(post, photos);
    })
    .join('');

  const unused = (curation.unusedPhotoIds || [])
    .map(id => photosById.get(id))
    .filter((p): p is Photo => Boolean(p));
  const unusedBlock =
    unused.length > 0
      ? `<section class="unused"><h2>未编入故事线的照片</h2><ul>${unused.map((p, i) => `<li>${photoLabel(p, i)}</li>`).join('')}</ul></section>`
      : '';

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <title>Day ${curation.day} 旅行故事线报告</title>
  <style>
    * { box-sizing: border-box; }
    body { font-family: "PingFang SC", "Inter", sans-serif; background: #f9f7f2; color: #1a1a1a; margin: 0; padding: 40px 24px; line-height: 1.6; }
    .wrap { max-width: 720px; margin: 0 auto; }
    h1 { font-family: Georgia, serif; font-size: 2rem; color: #c52f2f; margin: 0 0 8px; }
    .lead { color: #666; font-size: 0.95rem; margin-bottom: 32px; }
    .summary { background: #fff; border: 1px solid #e5e1d8; border-radius: 12px; padding: 20px; margin-bottom: 28px; }
    .post { background: #fff; border: 1px solid #e5e1d8; border-radius: 12px; padding: 20px; margin-bottom: 20px; page-break-inside: avoid; }
    .order { font-size: 0.7rem; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: #c52f2f; }
    h3 { font-family: Georgia, serif; margin: 8px 0 4px; font-size: 1.25rem; }
    .meta { font-size: 0.8rem; color: #888; margin: 0; }
    .note ul { margin: 8px 0 0; padding-left: 1.2rem; }
    .pairing { background: #fffbeb; border: 1px solid #fde68a; border-radius: 8px; padding: 12px; margin: 12px 0; font-size: 0.9rem; }
    .caption-block { margin-top: 12px; font-size: 0.9rem; }
    .tags { color: #c52f2f; font-size: 0.8rem; margin-top: 6px; }
    .thumbs { display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px; margin-top: 12px; }
    .thumbs img { width: 100%; aspect-ratio: 1; object-fit: cover; border-radius: 6px; }
    .unused { margin-top: 32px; padding-top: 20px; border-top: 1px dashed #e5e1d8; }
    footer { margin-top: 40px; font-size: 0.75rem; color: #aaa; text-align: center; }
    @media print { body { padding: 16px; } .post { break-inside: avoid; } }
  </style>
</head>
<body>
  <div class="wrap">
    <h1>${escapeHtml(dayTitle)}</h1>
    <p class="lead">LionCity Planner · 第 ${curation.day} 天故事线完整报告${vibe ? ` · ${escapeHtml(vibe)}` : ''}</p>
    <div class="summary"><strong>整日摘要</strong><p>${escapeHtml(curation.summary)}</p></div>
    ${sections}
    ${unusedBlock}
    <footer>按故事线顺序生成 · ${new Date().toLocaleString('zh-CN')}</footer>
  </div>
</body>
</html>`;
}

export function downloadDayReportHtml(html: string, day: number) {
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `新加坡_Day${day}_故事线报告.html`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function printDayReport(html: string) {
  const w = window.open('', '_blank');
  if (!w) {
    alert('请允许弹出窗口以打印报告');
    return;
  }
  w.document.write(html);
  w.document.close();
  w.onload = () => w.print();
}

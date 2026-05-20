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

function photoGridHtml(photos: Photo[]): string {
  if (!photos.length) return '';
  const cells = photos
    .map(
      p =>
        `<figure><img src="${p.url}" alt="${escapeHtml(p.locationName || '')}" /><figcaption>${escapeHtml(p.locationName || '')}</figcaption></figure>`
    )
    .join('');
  const layout =
    photos.length === 1
      ? 'solo'
      : photos.length === 2
        ? 'duo'
        : photos.length === 3
          ? 'trio'
          : photos.length === 4
            ? 'quad'
            : 'album';
  return `<div class="spread-photos spread-photos--${layout}">${cells}</div>`;
}

function buildPostSection(post: CuratedPost, photos: Photo[], chapter: number): string {
  const tags = post.hashtags?.length ? `<p class="tags">${escapeHtml(post.hashtags.join(' '))}</p>` : '';
  const note = [post.collageRationale, post.layoutHint].filter(Boolean).join(' ');
  const epigraph = [post.timeSlot, post.theme, post.mood].filter(Boolean).map(escapeHtml).join(' · ');
  return `
    <section class="spread">
      <div class="spread-head"><span class="chapter">Chapter ${chapter}</span></div>
      <h3>${escapeHtml(post.title)}</h3>
      <p class="epigraph">${epigraph}</p>
      ${photoGridHtml(photos)}
      ${note ? `<blockquote class="whisper">${escapeHtml(note)}</blockquote>` : ''}
      <p class="verse">${escapeHtml(post.caption)}</p>
      ${tags}
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
    .map((post, i) => {
      const photos = post.photoIds
        .map(id => photosById.get(id))
        .filter((p): p is Photo => Boolean(p));
      return buildPostSection(post, photos, i + 1);
    })
    .join('');

  const unused = (curation.unusedPhotoIds || [])
    .map(id => photosById.get(id))
    .filter((p): p is Photo => Boolean(p));
  const unusedBlock =
    unused.length > 0
      ? `<footer class="orphans"><p class="orphans-label">散页</p><div class="orphans-grid">${unused.map(p => `<figure><img src="${p.url}" alt="" /><figcaption>${escapeHtml(p.locationName || '')}</figcaption></figure>`).join('')}</div></footer>`
      : '';

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <title>Day ${curation.day} · ${escapeHtml(dayTitle)}</title>
  <style>
    * { box-sizing: border-box; }
    body { font-family: "Playfair Display", Georgia, "PingFang SC", serif; background: #f9f7f2; color: #1a1a1a; margin: 0; padding: 48px 28px; line-height: 1.65; }
    .wrap { max-width: 680px; margin: 0 auto; }
    .cover { text-align: center; padding-bottom: 48px; margin-bottom: 48px; border-bottom: 1px solid #e5e1d8; }
    .series { font-family: Inter, sans-serif; font-size: 0.65rem; letter-spacing: 0.28em; text-transform: uppercase; color: #c52f2f; font-weight: 600; }
    .day { font-family: Inter, sans-serif; font-size: 0.7rem; letter-spacing: 0.2em; color: #999; margin: 12px 0 8px; }
    h1 { font-size: 2.4rem; font-weight: 400; margin: 0; letter-spacing: -0.02em; }
    .vibe { font-family: Inter, sans-serif; font-size: 0.8rem; color: #888; font-style: italic; margin-top: 12px; }
    .rule { width: 48px; height: 1px; background: #c52f2f; margin: 28px auto; opacity: 0.5; }
    .lead { font-size: 1.05rem; font-style: italic; color: #444; line-height: 1.85; max-width: 520px; margin: 0 auto; }
    .spread { margin-bottom: 56px; page-break-inside: avoid; }
    .chapter { font-family: Inter, sans-serif; font-size: 0.6rem; letter-spacing: 0.22em; text-transform: uppercase; color: #c52f2f; font-weight: 600; }
    h3 { font-size: 1.6rem; font-weight: 400; margin: 8px 0 6px; }
    .epigraph { font-family: Inter, sans-serif; font-size: 0.72rem; color: #888; margin: 0 0 20px; }
    .spread-photos { display: grid; gap: 6px; margin-bottom: 20px; }
    .spread-photos figure { margin: 0; overflow: hidden; background: #ebe6dc; position: relative; }
    .spread-photos img { width: 100%; height: 100%; object-fit: cover; display: block; }
    .spread-photos figcaption { font-family: Inter, sans-serif; font-size: 0.55rem; position: absolute; bottom: 0; left: 0; right: 0; padding: 4px 6px; color: #fff; background: linear-gradient(transparent, rgba(0,0,0,0.5)); }
    .spread-photos--solo figure { aspect-ratio: 4/5; max-height: 420px; }
    .spread-photos--duo { grid-template-columns: 1fr 1fr; }
    .spread-photos--duo figure { aspect-ratio: 3/4; }
    .spread-photos--trio { grid-template-columns: 1.15fr 0.85fr; }
    .spread-photos--trio figure:first-child { grid-row: span 2; min-height: 280px; }
    .spread-photos--quad { grid-template-columns: 1fr 1fr; }
    .spread-photos--quad figure { aspect-ratio: 1; }
    .spread-photos--album { grid-template-columns: repeat(3, 1fr); }
    .spread-photos--album figure { aspect-ratio: 1; }
    .whisper { margin: 0 0 16px; padding-left: 14px; border-left: 2px solid #e5e1d8; font-style: italic; color: #666; font-size: 0.92rem; }
    .verse { font-size: 1rem; line-height: 1.9; margin: 0; white-space: pre-wrap; }
    .tags { font-family: Inter, sans-serif; font-size: 0.65rem; color: #c52f2f; opacity: 0.8; margin-top: 12px; letter-spacing: 0.06em; }
    .orphans { margin-top: 48px; padding-top: 32px; border-top: 1px dashed #e5e1d8; text-align: center; }
    .orphans-label { font-family: Inter, sans-serif; font-size: 0.6rem; letter-spacing: 0.2em; text-transform: uppercase; color: #aaa; }
    .orphans-grid { display: flex; flex-wrap: wrap; justify-content: center; gap: 10px; margin-top: 16px; }
    .orphans-grid figure { width: 72px; margin: 0; }
    .orphans-grid img { width: 100%; aspect-ratio: 1; object-fit: cover; }
    .colophon { text-align: center; font-family: Inter, sans-serif; font-size: 0.6rem; letter-spacing: 0.25em; color: #ccc; margin-top: 48px; }
    @media print { body { padding: 16px; } .spread { break-inside: avoid; } }
  </style>
</head>
<body>
  <div class="wrap">
    <header class="cover">
      <p class="series">LionCity · Travel Folio</p>
      <p class="day">Day ${String(curation.day).padStart(2, '0')}</p>
      <h1>${escapeHtml(dayTitle)}</h1>
      ${vibe ? `<p class="vibe">${escapeHtml(vibe)}</p>` : ''}
      <div class="rule"></div>
      <p class="lead">${escapeHtml(curation.summary)}</p>
    </header>
    ${sections}
    ${unusedBlock}
    <p class="colophon">— 狮城行记 · ${new Date().getFullYear()} —</p>
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

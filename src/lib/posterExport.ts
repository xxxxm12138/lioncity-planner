/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Photo, CollageLayout } from '../types';
import { loadImage, downloadDataUrl } from './imageUtils';

export const COLLAGE_LAYOUT_LABELS: Record<CollageLayout, string> = {
  grid_3x3: '九宫格拼图',
  hero_2x2: '主图 + 四宫格',
  triptych_vertical: '三竖图并列',
  duo_balance: '人景双拼',
  filmstrip: '胶片横条',
  single_hero: '单图封面',
  blur_bg_stack: '模糊背景 · 叠放',
  blur_bg_scatter: '模糊背景 · 散落',
};

/** Pick a layout that varies by photo count (not always 3-column). */
export function pickAutoCollageLayout(count: number): CollageLayout {
  if (count <= 1) return 'single_hero';
  if (count === 2) return 'duo_balance';
  if (count === 3) return 'blur_bg_stack';
  if (count <= 5) return 'blur_bg_scatter';
  if (count <= 8) return 'hero_2x2';
  return 'grid_3x3';
}

function layoutSeed(photos: Photo[]): number {
  let s = photos.length * 17;
  for (const p of photos) {
    for (let i = 0; i < p.id.length; i++) s = (s + p.id.charCodeAt(i) * (i + 3)) % 9973;
  }
  return s;
}

export async function exportCollagePoster(photos: Photo[], title = 'Singapore Memory') {
  const layout = pickAutoCollageLayout(photos.length);
  return exportCuratedCollage(photos, layout, title);
}

export async function exportCuratedCollage(
  photos: Photo[],
  layout: CollageLayout,
  title = 'Singapore Memory'
) {
  const images = await Promise.all(photos.slice(0, 9).map(p => loadImage(p.url)));
  if (images.length === 0) return;

  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const pad = 48;
  const innerW = 1080 - pad * 2;
  const seed = layoutSeed(photos);

  switch (layout) {
    case 'single_hero': {
      canvas.width = 1080;
      canvas.height = 1350;
      fillBg(ctx, canvas);
      drawTitle(ctx, title, pad, 72);
      drawCover(ctx, images[0], pad, 160, innerW, 1120);
      break;
    }
    case 'grid_3x3': {
      const n = Math.min(9, images.length);
      const cols = 3;
      const gap = 8;
      const cell = Math.floor((innerW - gap * (cols - 1)) / cols);
      canvas.width = pad * 2 + cell * cols + gap * (cols - 1);
      canvas.height = pad * 2 + 80 + cell * cols + gap * (cols - 1);
      fillBg(ctx, canvas);
      drawTitle(ctx, title, pad, 56);
      const startY = 100;
      for (let i = 0; i < n; i++) {
        const col = i % cols;
        const row = Math.floor(i / cols);
        drawCover(ctx, images[i], pad + col * (cell + gap), startY + row * (cell + gap), cell, cell);
      }
      break;
    }
    case 'triptych_vertical': {
      const n = Math.min(3, images.length);
      canvas.width = 1080;
      canvas.height = 1440;
      fillBg(ctx, canvas);
      drawTitle(ctx, title, pad, 72);
      const gap = 12;
      const colW = (innerW - gap * (n - 1)) / n;
      const top = 150;
      const h = 1240;
      for (let i = 0; i < n; i++) {
        drawCover(ctx, images[i], pad + i * (colW + gap), top, colW, h);
      }
      break;
    }
    case 'duo_balance': {
      canvas.width = 1080;
      canvas.height = 1200;
      fillBg(ctx, canvas);
      drawTitle(ctx, title, pad, 72);
      const gap = 16;
      const half = (innerW - gap) / 2;
      drawCover(ctx, images[0], pad, 140, half, 1000);
      drawCover(ctx, images[1] || images[0], pad + half + gap, 140, half, 1000);
      break;
    }
    case 'filmstrip': {
      canvas.width = 1080;
      canvas.height = 520;
      fillBg(ctx, canvas);
      drawTitle(ctx, title, pad, 48);
      const n = Math.min(5, images.length);
      const gap = 10;
      const stripY = 100;
      const stripH = 380;
      const tileW = (innerW - gap * (n - 1)) / n;
      for (let i = 0; i < n; i++) {
        drawCover(ctx, images[i], pad + i * (tileW + gap), stripY, tileW, stripH);
      }
      break;
    }
    case 'blur_bg_stack':
      drawBlurBgCollage(ctx, canvas, images, title, seed, 'stack');
      break;
    case 'blur_bg_scatter':
      drawBlurBgCollage(ctx, canvas, images, title, seed, 'scatter');
      break;
    case 'hero_2x2':
    default: {
      canvas.width = 1080;
      canvas.height = 1440;
      fillBg(ctx, canvas);
      drawTitle(ctx, title, pad, 72);
      drawCover(ctx, images[0], pad, 150, innerW, 640);
      const gap = 12;
      const tile = (innerW - gap) / 2;
      const tileY = 820;
      for (let i = 1; i <= 4; i++) {
        const img = images[i];
        const col = (i - 1) % 2;
        const row = Math.floor((i - 1) / 2);
        const x = pad + col * (tile + gap);
        const y = tileY + row * (tile + gap);
        if (img) drawCover(ctx, img, x, y, tile, tile);
        else {
          ctx.fillStyle = '#e8e8e8';
          ctx.fillRect(x, y, tile, tile);
        }
      }
      break;
    }
  }

  const layoutTag = COLLAGE_LAYOUT_LABELS[layout] || layout;
  downloadDataUrl(
    canvas.toDataURL('image/jpeg', 0.95),
    `新加坡_${layoutTag}_${Date.now()}.jpg`
  );
}

/** Blurred hero background + foreground photo cards with rotation & shadow. */
function drawBlurBgCollage(
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  images: HTMLImageElement[],
  title: string,
  seed: number,
  mode: 'stack' | 'scatter'
) {
  canvas.width = 1080;
  canvas.height = 1440;

  const bgIndex = pickBackgroundIndex(images, seed);
  drawBlurredBackground(ctx, canvas, images[bgIndex]);

  drawTitleOnBlur(ctx, title, 56, 88);

  const fg = images.map((img, i) => ({ img, i })).filter(x => x.i !== bgIndex);
  const ordered = [...fg.map(x => x.img), ...images.filter((_, i) => i === bgIndex)].slice(0, 8);
  const cards = ordered.length > 0 ? ordered : images;

  const layouts = mode === 'stack' ? stackCardLayouts(cards.length, seed) : scatterCardLayouts(cards.length, seed);
  for (let i = 0; i < Math.min(cards.length, layouts.length); i++) {
    const L = layouts[i];
    drawPhotoCard(ctx, cards[i], L.x, L.y, L.w, L.h, L.rot);
  }
}

function pickBackgroundIndex(images: HTMLImageElement[], seed: number): number {
  let best = 0;
  let bestScore = -1;
  for (let i = 0; i < images.length; i++) {
    const img = images[i];
    const ratio = img.width / img.height;
    const landscape = ratio >= 1.1 ? 2 : ratio >= 0.85 ? 1 : 0;
    const area = img.width * img.height;
    const score = landscape * 1e6 + area + (seed + i) % 7;
    if (score > bestScore) {
      bestScore = score;
      best = i;
    }
  }
  return best;
}

type CardLayout = { x: number; y: number; w: number; h: number; rot: number };

function stackCardLayouts(count: number, seed: number): CardLayout[] {
  const baseY = 320;
  if (count <= 1) {
    return [{ x: 140, y: baseY + 80, w: 800, h: 720, rot: (seed % 5 - 2) * 0.008 }];
  }
  if (count === 2) {
    return [
      { x: 80, y: baseY + 120, w: 520, h: 620, rot: -0.05 },
      { x: 420, y: baseY + 40, w: 560, h: 680, rot: 0.06 },
    ];
  }
  if (count === 3) {
    return [
      { x: 60, y: baseY + 200, w: 420, h: 500, rot: -0.07 },
      { x: 340, y: baseY + 60, w: 480, h: 580, rot: 0.05 },
      { x: 520, y: baseY + 380, w: 460, h: 520, rot: -0.03 },
    ];
  }
  return scatterCardLayouts(Math.min(count, 5), seed + 1);
}

function scatterCardLayouts(count: number, seed: number): CardLayout[] {
  const slots: CardLayout[] = [
    { x: 72, y: 280, w: 380, h: 460, rot: -0.08 },
    { x: 420, y: 240, w: 420, h: 520, rot: 0.06 },
    { x: 620, y: 520, w: 360, h: 440, rot: -0.04 },
    { x: 180, y: 720, w: 340, h: 400, rot: 0.07 },
    { x: 480, y: 780, w: 400, h: 480, rot: -0.05 },
    { x: 260, y: 400, w: 300, h: 360, rot: 0.03 },
  ];
  const n = Math.min(count, slots.length);
  const out: CardLayout[] = [];
  for (let i = 0; i < n; i++) {
    const slot = slots[(i + seed) % slots.length];
    const jitter = ((seed + i * 11) % 9 - 4) * 6;
    out.push({
      ...slot,
      x: slot.x + jitter,
      y: slot.y + jitter * 0.6,
      rot: slot.rot + ((seed + i) % 5 - 2) * 0.015,
    });
  }
  return out;
}

function drawBlurredBackground(
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  img: HTMLImageElement
) {
  const w = canvas.width;
  const h = canvas.height;
  const off = document.createElement('canvas');
  off.width = w;
  off.height = h;
  const octx = off.getContext('2d');
  if (!octx) return;

  octx.filter = 'blur(32px) saturate(1.12)';
  const scale = 1.2;
  drawCover(octx, img, -w * 0.1, -h * 0.1, w * scale, h * scale);
  ctx.drawImage(off, 0, 0);

  const grd = ctx.createLinearGradient(0, 0, 0, h);
  grd.addColorStop(0, 'rgba(248,247,242,0.55)');
  grd.addColorStop(0.35, 'rgba(248,247,242,0.2)');
  grd.addColorStop(1, 'rgba(26,26,26,0.35)');
  ctx.fillStyle = grd;
  ctx.fillRect(0, 0, w, h);
}

function drawPhotoCard(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  x: number,
  y: number,
  w: number,
  h: number,
  rotation: number
) {
  const pad = 10;
  const radius = 14;
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.32)';
  ctx.shadowBlur = 28;
  ctx.shadowOffsetY = 12;
  ctx.translate(x + w / 2, y + h / 2);
  ctx.rotate(rotation);
  ctx.fillStyle = '#fff';
  roundRect(ctx, -w / 2, -h / 2, w, h, radius);
  ctx.fill();
  ctx.shadowColor = 'transparent';
  ctx.beginPath();
  roundRect(ctx, -w / 2 + pad, -h / 2 + pad, w - pad * 2, h - pad * 2, radius - 4);
  ctx.clip();
  drawCover(ctx, img, -w / 2 + pad, -h / 2 + pad, w - pad * 2, h - pad * 2);
  ctx.restore();
}

function drawTitleOnBlur(ctx: CanvasRenderingContext2D, title: string, x: number, y: number) {
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.35)';
  ctx.shadowBlur = 8;
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 48px serif';
  ctx.fillText(title.slice(0, 24), x, y);
  ctx.font = '22px sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.88)';
  ctx.fillText('LionCity Planner', x, y + 40);
  ctx.restore();
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  const rad = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rad, y);
  ctx.arcTo(x + w, y, x + w, y + h, rad);
  ctx.arcTo(x + w, y + h, x, y + h, rad);
  ctx.arcTo(x, y + h, x, y, rad);
  ctx.arcTo(x, y, x + w, y, rad);
  ctx.closePath();
}

export async function exportMono(photo: Photo, index: number) {
  const img = await loadImage(photo.url);
  const canvas = document.createElement('canvas');
  canvas.width = img.width;
  canvas.height = img.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.drawImage(img, 0, 0);
  const id = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const d = id.data;
  for (let i = 0; i < d.length; i += 4) {
    const g = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
    d[i] = d[i + 1] = d[i + 2] = g;
  }
  ctx.putImageData(id, 0, 0);
  downloadDataUrl(canvas.toDataURL('image/jpeg', 0.92), `新加坡_黑白_${String(index + 1).padStart(2, '0')}.jpg`);
}

export async function exportTextCard(photo: Photo, caption: string, index: number) {
  const img = await loadImage(photo.url);
  const canvas = document.createElement('canvas');
  canvas.width = 1080;
  canvas.height = 1350;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  ctx.fillStyle = '#f8f7f2';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  drawCover(ctx, img, 60, 60, 960, 960);

  ctx.fillStyle = '#1a1a1a';
  ctx.font = '36px serif';
  wrapText(ctx, caption, 60, 1080, 1180, 44);

  downloadDataUrl(canvas.toDataURL('image/jpeg', 0.94), `新加坡_文案卡_${String(index + 1).padStart(2, '0')}.jpg`);
}

function fillBg(ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement) {
  ctx.fillStyle = '#f8f7f2';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
}

function drawTitle(ctx: CanvasRenderingContext2D, title: string, x: number, y: number) {
  ctx.fillStyle = '#c52f2f';
  ctx.font = 'bold 44px serif';
  ctx.fillText(title.slice(0, 28), x, y);
  ctx.fillStyle = '#888';
  ctx.font = '22px sans-serif';
  ctx.fillText('LionCity Planner', x, y + 36);
}

function drawCover(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  dx: number,
  dy: number,
  dw: number,
  dh: number
) {
  const ratio = img.width / img.height;
  const target = dw / dh;
  let sx = 0, sy = 0, sw = img.width, sh = img.height;
  if (ratio > target) {
    sw = img.height * target;
    sx = (img.width - sw) / 2;
  } else {
    sh = img.width / target;
    sy = (img.height - sh) / 2;
  }
  ctx.drawImage(img, sx, sy, sw, sh, dx, dy, dw, dh);
}

function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number
) {
  const chars = [...text];
  let line = '';
  let cy = y;
  for (const ch of chars) {
    const test = line + ch;
    if (ctx.measureText(test).width > maxWidth && line) {
      ctx.fillText(line, x, cy);
      line = ch;
      cy += lineHeight;
    } else {
      line = test;
    }
  }
  if (line) ctx.fillText(line, x, cy);
}

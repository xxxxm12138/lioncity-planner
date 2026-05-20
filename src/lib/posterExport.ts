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
};

export async function exportCollagePoster(photos: Photo[], title = 'Singapore Memory') {
  return exportCuratedCollage(photos, 'hero_2x2', title);
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
      const cell = Math.floor((1080 - pad * 2 - gap * (cols - 1)) / cols);
      canvas.width = pad * 2 + cell * cols + gap * (cols - 1);
      canvas.height = pad * 2 + 80 + cell * cols + gap * (cols - 1);
      fillBg(ctx, canvas);
      drawTitle(ctx, title, pad, 56);
      const startY = 100;
      for (let i = 0; i < n; i++) {
        const col = i % cols;
        const row = Math.floor(i / cols);
        const x = pad + col * (cell + gap);
        const y = startY + row * (cell + gap);
        drawCover(ctx, images[i], x, y, cell, cell);
      }
      break;
    }
    case 'triptych_vertical': {
      canvas.width = 1080;
      canvas.height = 1440;
      fillBg(ctx, canvas);
      drawTitle(ctx, title, pad, 72);
      const gap = 12;
      const colW = (innerW - gap * 2) / 3;
      const top = 150;
      const h = 1240;
      for (let i = 0; i < 3; i++) {
        const img = images[i] || images[0];
        drawCover(ctx, img, pad + i * (colW + gap), top, colW, h);
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
      const top = 140;
      const h = 1000;
      drawCover(ctx, images[0], pad, top, half, h);
      drawCover(ctx, images[1] || images[0], pad + half + gap, top, half, h);
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
        if (!img) {
          ctx.fillStyle = '#e8e8e8';
          ctx.fillRect(x, y, tile, tile);
        } else {
          drawCover(ctx, img, x, y, tile, tile);
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

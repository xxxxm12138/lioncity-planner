/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Photo } from '../types';
import { loadImage, downloadDataUrl } from './imageUtils';

export async function exportCollagePoster(photos: Photo[], title = 'Singapore Memory') {
  const images = await Promise.all(photos.slice(0, 5).map(p => loadImage(p.url)));
  const canvas = document.createElement('canvas');
  canvas.width = 1080;
  canvas.height = 1440;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  ctx.fillStyle = '#f8f7f2';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#c52f2f';
  ctx.font = 'bold 52px serif';
  ctx.fillText(title, 60, 100);
  ctx.fillStyle = '#666';
  ctx.font = '28px sans-serif';
  ctx.fillText('LionCity Planner', 60, 145);

  const hero = images[0];
  const heroY = 190;
  const heroH = 690;
  if (hero) drawCover(ctx, hero, 60, heroY, 960, heroH);

  const gap = 16;
  const tileSize = (960 - gap) / 2;
  const tileY = 920;
  for (let i = 1; i <= 4; i++) {
    const img = images[i];
    const col = (i - 1) % 2;
    const row = Math.floor((i - 1) / 2);
    const x = 60 + col * (tileSize + gap);
    const y = tileY + row * (tileSize + gap);
    if (!img) {
      ctx.fillStyle = '#e8e8e8';
      ctx.fillRect(x, y, tileSize, tileSize);
    } else {
      drawCover(ctx, img, x, y, tileSize, tileSize);
    }
  }

  downloadDataUrl(canvas.toDataURL('image/jpeg', 0.95), `新加坡_海报_${Date.now()}.jpg`);
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

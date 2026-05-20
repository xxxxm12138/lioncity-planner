/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Photo, PhotoCurationResult } from '../types';

const STORAGE_KEY = 'lioncity_curation_cache_v1';

type CacheEntry = {
  result: PhotoCurationResult;
  photoIds: string[];
  context: string;
  cachedAt: number;
};

type CacheStore = Record<string, CacheEntry>;

function readStore(): CacheStore {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as CacheStore;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function writeStore(store: CacheStore): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch {
    // Quota exceeded — drop oldest half and retry once
    const keys = Object.keys(store).sort(
      (a, b) => (store[a].cachedAt ?? 0) - (store[b].cachedAt ?? 0)
    );
    const trimmed: CacheStore = {};
    keys.slice(Math.floor(keys.length / 2)).forEach(k => {
      trimmed[k] = store[k];
    });
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
    } catch {
      /* ignore */
    }
  }
}

/** Stable key from day + sorted photo ids (same set = same key regardless of order). */
export function buildCurationCacheKey(day: number, photoIds: string[]): string {
  const sorted = [...photoIds].sort();
  return `${day}:${sorted.join('|')}`;
}

export function getCachedCuration(
  day: number,
  photos: Photo[],
  tripContext = ''
): PhotoCurationResult | null {
  const photoIds = photos.map(p => p.id);
  const key = buildCurationCacheKey(day, photoIds);
  const entry = readStore()[key];
  if (!entry) return null;

  const sameIds =
    entry.photoIds.length === photoIds.length &&
    [...entry.photoIds].sort().join('|') === [...photoIds].sort().join('|');
  if (!sameIds || entry.result.day !== day) return null;

  // Same photos but itinerary text changed — still return cache; user can force re-run
  if (entry.context !== tripContext) {
    return { ...entry.result, day };
  }

  return { ...entry.result, day };
}

export function setCachedCuration(
  day: number,
  photos: Photo[],
  tripContext: string,
  result: PhotoCurationResult
): void {
  const photoIds = photos.map(p => p.id);
  const key = buildCurationCacheKey(day, photoIds);
  const store = readStore();
  store[key] = {
    result: { ...result, day },
    photoIds,
    context: tripContext,
    cachedAt: Date.now(),
  };
  writeStore(store);
}

export function clearCachedCuration(day: number, photos: Photo[]): void {
  const key = buildCurationCacheKey(day, photos.map(p => p.id));
  const store = readStore();
  delete store[key];
  writeStore(store);
}

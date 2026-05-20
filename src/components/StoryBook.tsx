/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { CuratedPost, Photo, PhotoCurationResult, Itinerary } from '../types';
import { Copy } from 'lucide-react';

type StoryBookProps = {
  curation: PhotoCurationResult;
  itinerary: Itinerary;
  photosForPost: (post: CuratedPost) => Photo[];
  photosById?: Map<string, Photo>;
  showCopyActions?: boolean;
  onCopyCaption?: (post: CuratedPost) => void;
  onOpenReport?: () => void;
};

function chapterNumeral(n: number): string {
  const romans = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'];
  return romans[n - 1] || String(n);
}

function SpreadPhotos({ photos }: { photos: Photo[] }) {
  const n = photos.length;
  if (n === 0) {
    return (
      <div className="storybook-photos-empty font-sans text-[11px] text-gray-400 italic py-12 text-center border border-dashed border-editorial-border rounded-sm">
        此页待以影像填满
      </div>
    );
  }

  const img = (p: Photo, className: string) => (
    <div key={p.id} className={`storybook-photo ${className}`}>
      <img src={p.url} alt={p.locationName || ''} loading="lazy" />
      {p.locationName && (
        <span className="storybook-photo-caption font-sans">{p.locationName}</span>
      )}
    </div>
  );

  if (n === 1) {
    return <div className="storybook-photos storybook-photos--solo">{img(photos[0], 'storybook-photo--hero')}</div>;
  }
  if (n === 2) {
    return (
      <div className="storybook-photos storybook-photos--duo">
        {photos.map(p => img(p, 'storybook-photo--half'))}
      </div>
    );
  }
  if (n === 3) {
    return (
      <div className="storybook-photos storybook-photos--trio">
        {img(photos[0], 'storybook-photo--trio-main')}
        <div className="storybook-photos--trio-stack">
          {img(photos[1], 'storybook-photo--trio-sub')}
          {img(photos[2], 'storybook-photo--trio-sub')}
        </div>
      </div>
    );
  }
  if (n === 4) {
    return (
      <div className="storybook-photos storybook-photos--quad">
        {photos.map(p => img(p, 'storybook-photo--quad'))}
      </div>
    );
  }
  if (n <= 6) {
    return (
      <div className="storybook-photos storybook-photos--mosaic">
        {photos.map((p, i) => img(p, i === 0 ? 'storybook-photo--mosaic-lead' : 'storybook-photo--mosaic-cell'))}
      </div>
    );
  }

  return (
    <div className="storybook-photos storybook-photos--album">
      {photos.map(p => img(p, 'storybook-photo--album-cell'))}
    </div>
  );
}

function StorySpread({
  post,
  photos,
  index,
  total,
  showCopyActions,
  onCopyCaption,
}: {
  post: CuratedPost;
  photos: Photo[];
  index: number;
  total: number;
  showCopyActions?: boolean;
  onCopyCaption?: (post: CuratedPost) => void;
}) {
  const note = [post.collageRationale, post.layoutHint].filter(Boolean).join(' ');

  return (
    <article className="storybook-spread break-inside-avoid">
      <header className="storybook-spread-head">
        <span className="storybook-chapter font-sans">Chapter {chapterNumeral(index)}</span>
        <span className="storybook-folio font-sans">
          {index} / {total}
        </span>
      </header>

      <h3 className="storybook-spread-title">{post.title}</h3>
      <p className="storybook-spread-epigraph font-sans">
        {post.timeSlot}
        <span className="storybook-dot">·</span>
        {post.theme}
        {post.mood ? (
          <>
            <span className="storybook-dot">·</span>
            <em>{post.mood}</em>
          </>
        ) : null}
      </p>

      <SpreadPhotos photos={photos} />

      {note ? (
        <blockquote className="storybook-whisper">
          {note}
        </blockquote>
      ) : null}

      <p className="storybook-verse">{post.caption}</p>

      {post.hashtags?.length > 0 && (
        <p className="storybook-tags font-sans">{post.hashtags.join(' ')}</p>
      )}

      {showCopyActions && onCopyCaption && (
        <button
          type="button"
          onClick={() => onCopyCaption(post)}
          className="storybook-copy print:hidden font-sans"
          aria-label="复制配文"
        >
          <Copy className="w-3 h-3" />
        </button>
      )}
    </article>
  );
}

export default function StoryBook({
  curation,
  itinerary,
  photosForPost,
  photosById,
  showCopyActions = true,
  onCopyCaption,
  onOpenReport,
}: StoryBookProps) {
  const dayPlan = itinerary.days.find(d => d.day === curation.day);
  const dayTitle = dayPlan?.title || `第 ${curation.day} 天`;
  const vibe = itinerary.narrative?.vibe;
  const sorted = [...curation.posts].sort((a, b) => a.storylineOrder - b.storylineOrder);

  const unused =
    photosById && curation.unusedPhotoIds?.length
      ? curation.unusedPhotoIds
          .map(id => photosById.get(id))
          .filter((p): p is Photo => Boolean(p))
      : [];

  return (
    <div className="storybook">
      <header className="storybook-cover break-inside-avoid">
        <p className="storybook-series font-sans">LionCity · Travel Folio</p>
        <p className="storybook-day-index font-sans">Day {String(curation.day).padStart(2, '0')}</p>
        <h2 className="storybook-cover-title">{dayTitle}</h2>
        {vibe && <p className="storybook-cover-vibe font-sans">{vibe}</p>}
        <div className="storybook-cover-rule" aria-hidden />
        <p className="storybook-cover-lead">{curation.summary}</p>
        {sorted.length > 0 && (
          <p className="storybook-cover-meta font-sans">
            {sorted.length} 章叙事 · {sorted.reduce((n, p) => n + p.photoIds.length, 0)} 帧光影
          </p>
        )}
        {onOpenReport && (
          <button
            type="button"
            onClick={onOpenReport}
            className="storybook-to-report print:hidden font-sans"
          >
            翻阅完整卷册 →
          </button>
        )}
      </header>

      <div className="storybook-body">
        {sorted.map((post, i) => (
          <StorySpread
            key={post.id}
            post={post}
            photos={photosForPost(post)}
            index={i + 1}
            total={sorted.length}
            showCopyActions={showCopyActions}
            onCopyCaption={onCopyCaption}
          />
        ))}
      </div>

      {unused.length > 0 && (
        <footer className="storybook-orphans break-inside-avoid">
          <p className="storybook-orphans-label font-sans">散页 · 未入卷的镜头</p>
          <div className="storybook-orphans-grid">
            {unused.map(p => (
              <div key={p.id} className="storybook-orphan">
                <img src={p.url} alt="" />
                {p.locationName && (
                  <span className="font-sans">{p.locationName}</span>
                )}
              </div>
            ))}
          </div>
        </footer>
      )}

      <p className="storybook-colophon font-sans print:block">
        — 狮城行记 · {new Date().getFullYear()} —
      </p>
    </div>
  );
}

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useRef, useCallback, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Itinerary, Photo, CuratedPost, PhotoCurationResult, PostFormat } from '../types';
import { Camera, Download, Upload, X, BookOpen, Grid3X3, Plus, MapPin, Trash2, Image as AlbumPosterIcon, Sparkles, Loader2, Copy } from 'lucide-react';
import { Translations } from '../lib/i18n';
import { curateDayPhotos, fetchServerHasGemini } from '../lib/photoCurate';
import {
  exportCuratedCollage,
  exportMono,
  exportTextCard,
  COLLAGE_LAYOUT_LABELS,
  pickAutoCollageLayout,
} from '../lib/posterExport';
import type { CollageLayout } from '../types';

const FORMAT_LABELS: Record<PostFormat, string> = {
  grid: '九宫格',
  poster: '拼贴海报',
  mono: '黑白质感',
  text_card: '文案卡片',
  single_hero: '封面大片',
};

const POSTER_FRIENDLY_LAYOUTS: CollageLayout[] = [
  'blur_bg_stack',
  'blur_bg_scatter',
  'hero_2x2',
  'filmstrip',
  'triptych_vertical',
  'grid_3x3',
  'single_hero',
  'duo_balance',
];

function isPosterFriendlyPost(post: CuratedPost): boolean {
  if (post.photoIds.length === 0) return false;
  if (post.format === 'mono' || post.format === 'text_card') return false;
  if (post.format === 'poster' || post.format === 'single_hero') return true;
  return POSTER_FRIENDLY_LAYOUTS.includes(post.collageLayout);
}

interface AlbumProps {
  itinerary: Itinerary;
  t: Translations;
  onAddPhotos: (photos: Photo[]) => void;
  activeDay: number;
}

export default function Album(props?: AlbumProps) {
  const itinerary = props?.itinerary ?? { days: [], narrative: { foreword: '', epilogue: '', vibe: '' } };
  const onAddPhotos = props?.onAddPhotos ?? (() => {});
  const activeDay = props?.activeDay ?? 1;
  const [isDragging, setIsDragging] = useState(false);
  const [uploadDay, setUploadDay] = useState(activeDay || 1);
  const [selectedPhotos, setSelectedPhotos] = useState<Photo[]>([]);
  const [view, setView] = useState<'gallery' | 'grid' | 'poster' | 'curate'>('gallery');
  const [posterGenerating, setPosterGenerating] = useState(false);
  const [posterLayout, setPosterLayout] = useState<CollageLayout | 'auto'>('auto');
  const [posterTitle, setPosterTitle] = useState('Singapore Memory');
  const scrollRef = useRef<HTMLDivElement>(null);
  const [curating, setCurating] = useState(false);
  const [curateProgress, setCurateProgress] = useState<{ current: number; total: number } | null>(null);
  const [curation, setCuration] = useState<PhotoCurationResult | null>(null);
  const [curateError, setCurateError] = useState<string | null>(null);
  const [serverHasGemini, setServerHasGemini] = useState<boolean | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchServerHasGemini().then(setServerHasGemini);
  }, []);

  const allPhotos = itinerary.days.flatMap(d => d.photos || []);
  const photoById = useMemo(() => new Map(allPhotos.map(p => [p.id, p])), [allPhotos]);

  const dayPhotos = useMemo(() => {
    const fromDay = itinerary.days.find(d => d.day === uploadDay)?.photos;
    if (fromDay?.length) return fromDay;
    return allPhotos.filter(p => p.day === uploadDay);
  }, [itinerary.days, uploadDay, allPhotos]);

  const processFiles = useCallback((files: File[]) => {
    const imageFiles = files.filter(f => f.type.startsWith('image/'));
    if (imageFiles.length === 0) return;

    // URL.createObjectURL 瞬间完成，不读文件内容，零内存拷贝
    const newPhotos: Photo[] = imageFiles.map((file, i) => ({
      id: `${Date.now()}-${i}-${Math.random().toString(36).slice(2)}`,
      url: URL.createObjectURL(file),
      locationName: file.name.replace(/\.[^/.]+$/, '').replace(/微信图片_\d+/, ''),
      day: uploadDay,
    }));

    onAddPhotos(newPhotos);
  }, [uploadDay, onAddPhotos]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    processFiles(Array.from(e.dataTransfer.files));
  }, [processFiles]);

  const toggleSelect = (photo: Photo) => {
    setSelectedPhotos(prev => {
      if (prev.find(p => p.id === photo.id)) return prev.filter(p => p.id !== photo.id);
      if (prev.length >= 9) return prev;
      return [...prev, photo];
    });
  };

  const removeFromGrid = (photo: Photo) => {
    setSelectedPhotos(prev => prev.filter(p => p.id !== photo.id));
  };

  const getSelectIndex = (photo: Photo) =>
    selectedPhotos.findIndex(p => p.id === photo.id);

  const downloadPhoto = (photo: Photo, index: number) => {
    const a = document.createElement('a');
    a.href = photo.url;
    a.download = `新加坡_${String(index + 1).padStart(2, '0')}.jpg`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const downloadAll = () => {
    selectedPhotos.forEach((photo, i) => {
      setTimeout(() => downloadPhoto(photo, i), i * 250);
    });
  };

  const effectivePosterLayout =
    posterLayout === 'auto' ? pickAutoCollageLayout(selectedPhotos.length) : posterLayout;

  const downloadPoster = useCallback(async () => {
    if (selectedPhotos.length === 0) return;
    setPosterGenerating(true);
    try {
      const layout =
        posterLayout === 'auto' ? pickAutoCollageLayout(selectedPhotos.length) : posterLayout;
      await exportCuratedCollage(selectedPhotos, layout, posterTitle);
    } finally {
      setPosterGenerating(false);
    }
  }, [selectedPhotos, posterLayout, posterTitle]);

  const runCurate = async () => {
    if (dayPhotos.length === 0) return;
    setCurating(true);
    setCurateError(null);
    setCurateProgress(null);
    try {
      const dayPlan = itinerary.days.find(d => d.day === uploadDay);
      const context = dayPlan
        ? `Day ${dayPlan.day}: ${dayPlan.title}. Locations: ${dayPlan.locations.map(l => l.name).join(', ')}`
        : itinerary.narrative?.vibe;
      const result = await curateDayPhotos(dayPhotos, uploadDay, context, p => setCurateProgress(p));
      setCuration(result);
      setView('curate');
    } catch (e) {
      setCurateError(e instanceof Error ? e.message : '分析失败，请稍后重试');
    } finally {
      setCurating(false);
      setCurateProgress(null);
    }
  };

  const photosForPost = (post: CuratedPost) =>
    post.photoIds.map(id => photoById.get(id)).filter((p): p is Photo => Boolean(p));

  const applyPostToSelection = (post: CuratedPost) => {
    setSelectedPhotos(photosForPost(post).slice(0, 9));
  };

  const goToPosterFromPost = (post: CuratedPost) => {
    const photos = photosForPost(post);
    if (photos.length === 0) return;
    setSelectedPhotos(photos.slice(0, 9));
    setPosterLayout(post.collageLayout);
    setPosterTitle(post.title);
    setView('poster');
    requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
    });
  };

  const copyCaption = (post: CuratedPost) => {
    const text = `${post.caption}\n\n${post.hashtags.join(' ')}`;
    navigator.clipboard.writeText(text).catch(() => {});
  };

  const exportCuratedPost = async (post: CuratedPost) => {
    const photos = photosForPost(post);
    if (photos.length === 0) return;
    setPosterGenerating(true);
    try {
      switch (post.format) {
        case 'grid':
          if (post.collageLayout === 'grid_3x3' && photos.length >= 4) {
            await exportCuratedCollage(photos, 'grid_3x3', post.title);
          } else {
            photos.forEach((p, i) => setTimeout(() => downloadPhoto(p, i), i * 250));
          }
          break;
        case 'poster':
        case 'single_hero':
          await exportCuratedCollage(photos, post.collageLayout, post.title);
          break;
        case 'mono':
          for (let i = 0; i < photos.length; i++) await exportMono(photos[i], i);
          break;
        case 'text_card':
          await exportTextCard(photos[0], post.caption, 0);
          break;
        default:
          await exportCuratedCollage(photos, post.collageLayout, post.title);
      }
    } finally {
      setPosterGenerating(false);
    }
  };

  const curationGroups = useMemo(() => {
    if (!curation?.posts.length) return [];
    const groups: { theme: string; posts: CuratedPost[] }[] = [];
    for (const post of curation.posts) {
      const theme = post.theme || '其他';
      const last = groups[groups.length - 1];
      if (last?.theme === theme) last.posts.push(post);
      else groups.push({ theme, posts: [post] });
    }
    return groups;
  }, [curation]);

  const CELLS = Array.from({ length: 9 }, (_, i) => i);

  return (
    <motion.div ref={scrollRef} className="w-full h-full overflow-y-auto bg-editorial-bg font-serif">
      {/* Sticky header */}
      <div className="sticky top-0 z-20 bg-editorial-bg/95 backdrop-blur-md border-b border-editorial-border px-4 lg:px-8 py-3 flex items-center justify-between gap-4">
        {/* Tab switcher */}
        <div className="flex gap-0.5 bg-gray-100 p-1 rounded-full shrink-0">
          <button
            onClick={() => setView('gallery')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full font-sans text-[10px] font-bold uppercase tracking-widest transition-all ${
              view === 'gallery' ? 'bg-white shadow text-editorial-accent' : 'text-gray-400'
            }`}
          >
            <BookOpen className="w-3 h-3" />
            照片库
          </button>
          <button
            onClick={() => setView('grid')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full font-sans text-[10px] font-bold uppercase tracking-widest transition-all ${
              view === 'grid' ? 'bg-white shadow text-editorial-accent' : 'text-gray-400'
            }`}
          >
            <Grid3X3 className="w-3 h-3" />
            九宫格
            {selectedPhotos.length > 0 && (
              <span className="bg-editorial-accent text-white rounded-full w-4 h-4 flex items-center justify-center text-[9px] leading-none">
                {selectedPhotos.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setView('poster')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full font-sans text-[10px] font-bold uppercase tracking-widest transition-all ${
              view === 'poster' ? 'bg-white shadow text-editorial-accent' : 'text-gray-400'
            }`}
          >
            <AlbumPosterIcon className="w-3 h-3" />
            海报
          </button>
          <button
            onClick={() => setView('curate')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full font-sans text-[10px] font-bold uppercase tracking-widest transition-all ${
              view === 'curate' ? 'bg-white shadow text-editorial-accent' : 'text-gray-400'
            }`}
          >
            <Sparkles className="w-3 h-3" />
            智能编排
          </button>
        </div>

        {/* Right actions */}
        {(view === 'gallery' || view === 'curate') && (
          <div className="flex items-center gap-2 min-w-0">
            <span className="font-sans text-[10px] text-gray-400 shrink-0">{view === 'curate' ? '分析' : '上传到'}</span>
            <select
              value={uploadDay}
              onChange={e => setUploadDay(Number(e.target.value))}
              className="font-sans text-[10px] font-bold border border-editorial-border rounded-full px-3 py-1.5 bg-white outline-none focus:border-editorial-accent truncate max-w-[160px]"
            >
              {itinerary.days.length > 0
                ? itinerary.days.map(d => (
                    <option key={d.day} value={d.day}>Day {d.day} · {d.title}</option>
                  ))
                : [1, 2, 3].map(n => (
                    <option key={n} value={n}>第 {n} 天</option>
                  ))
              }
            </select>
          </div>
        )}

        {view === 'grid' && selectedPhotos.length > 0 && (
          <button
            onClick={downloadAll}
            className="flex items-center gap-2 bg-editorial-accent text-white px-4 py-2 rounded-full font-sans text-[10px] font-bold uppercase tracking-widest hover:opacity-90 active:scale-95 transition-all shrink-0"
          >
            <Download className="w-3 h-3" />
            下载 {selectedPhotos.length} 张
          </button>
        )}
        {view === 'poster' && selectedPhotos.length > 0 && (
          <button
            onClick={downloadPoster}
            disabled={posterGenerating}
            className="flex items-center gap-2 bg-editorial-text text-white px-4 py-2 rounded-full font-sans text-[10px] font-bold uppercase tracking-widest hover:opacity-90 active:scale-95 transition-all shrink-0 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Download className="w-3 h-3" />
            {posterGenerating ? '生成中...' : '下载海报'}
          </button>
        )}
        {view === 'curate' && (
          <button
            onClick={runCurate}
            disabled={curating || dayPhotos.length === 0}
            className="flex items-center gap-2 bg-editorial-accent text-white px-4 py-2 rounded-full font-sans text-[10px] font-bold uppercase tracking-widest hover:opacity-90 active:scale-95 transition-all shrink-0 disabled:opacity-50"
          >
            {curating ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
            {curating && curateProgress
              ? `分析中 ${curateProgress.current}/${curateProgress.total} 批…`
              : curating
                ? '分析中…'
                : `分析第 ${uploadDay} 天 (${dayPhotos.length} 张)`}
          </button>
        )}
      </div>

      <div className="p-4 lg:p-8">
        <AnimatePresence mode="wait">
          {view === 'gallery' && (
            <motion.div
              key="gallery"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
            >
              {/* Drag-drop upload zone */}
              <div
                onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setIsDragging(false); }}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`relative border-2 border-dashed rounded-2xl p-10 mb-8 text-center cursor-pointer transition-all select-none
                  ${isDragging
                    ? 'border-editorial-accent bg-editorial-accent/5 scale-[0.99]'
                    : 'border-gray-200 hover:border-editorial-accent hover:bg-gray-50/80'
                  }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={e => processFiles(Array.from(e.target.files || []))}
                />
                <Upload className={`w-8 h-8 mx-auto mb-3 transition-colors ${isDragging ? 'text-editorial-accent' : 'text-gray-300'}`} />
                <p className="font-sans font-bold text-sm text-gray-500">
                  {isDragging ? '松手即可上传' : '拖拽多张照片到这里批量导入'}
                </p>
                <p className="font-sans text-[11px] text-gray-300 mt-1">
                  或点击选择 · 支持 JPG / PNG / HEIC · 无数量限制
                </p>
              </div>

              {/* Photo gallery */}
              {allPhotos.length === 0 ? (
                <div className="text-center py-24">
                  <Camera className="w-14 h-14 text-gray-200 mx-auto mb-4" />
                  <p className="font-sans text-sm text-gray-400">还没有照片</p>
                  <p className="font-sans text-[11px] text-gray-300 mt-1 italic">上传后可智能编排：按场景/故事线分组，并生成九宫格、海报、黑白、文案卡</p>
                </div>
              ) : (
                <div className="space-y-10">
                  {itinerary.days.map(day => {
                    const dayPhotos = day.photos || [];
                    if (dayPhotos.length === 0) return null;
                    return (
                      <div key={day.day}>
                        <div className="flex items-baseline gap-3 mb-4">
                          <span className="text-4xl font-black text-editorial-accent/20 leading-none">0{day.day}</span>
                          <div>
                            <h3 className="text-xl tracking-tight leading-none">{day.title}</h3>
                            <p className="font-sans text-[10px] text-gray-400 mt-0.5">{dayPhotos.length} 张 · 点击勾选加入九宫格</p>
                          </div>
                        </div>
                        <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 gap-1.5">
                          {dayPhotos.map(photo => {
                            const selIdx = getSelectIndex(photo);
                            const isSelected = selIdx !== -1;
                            const atMax = selectedPhotos.length >= 9 && !isSelected;
                            return (
                              <motion.div
                                key={photo.id}
                                whileTap={{ scale: 0.94 }}
                                className={`relative aspect-square rounded-xl overflow-hidden cursor-pointer group ${atMax ? 'opacity-40' : ''}`}
                                onClick={() => !atMax && toggleSelect(photo)}
                              >
                                <img
                                  src={photo.url}
                                  alt=""
                                  className={`w-full h-full object-cover transition-all duration-300 ${isSelected ? 'brightness-70 scale-105' : 'group-hover:scale-105 group-hover:brightness-90'}`}
                                />
                                {isSelected && (
                                  <div className="absolute inset-0 flex items-start justify-end p-1.5">
                                    <div className="w-6 h-6 bg-editorial-accent rounded-full flex items-center justify-center text-white text-[11px] font-bold font-sans shadow-lg ring-2 ring-white">
                                      {selIdx + 1}
                                    </div>
                                  </div>
                                )}
                                {!isSelected && !atMax && (
                                  <div className="absolute inset-0 flex items-start justify-end p-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <div className="w-6 h-6 border-2 border-white/80 rounded-full bg-black/20 backdrop-blur-sm" />
                                  </div>
                                )}
                                {photo.locationName && (
                                  <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-2 translate-y-full group-hover:translate-y-0 transition-transform">
                                    <div className="flex items-center gap-1">
                                      <MapPin className="w-2.5 h-2.5 text-editorial-accent shrink-0" />
                                      <p className="font-sans text-[9px] text-white font-bold truncate">{photo.locationName}</p>
                                    </div>
                                  </div>
                                )}
                              </motion.div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </motion.div>
          )}

          {view === 'grid' && (
            <motion.div
              key="grid"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="max-w-sm mx-auto"
            >
              {selectedPhotos.length === 0 ? (
                <div className="text-center py-16">
                  <Grid3X3 className="w-12 h-12 text-gray-200 mx-auto mb-4" />
                  <p className="font-sans font-bold text-sm text-gray-400">还没有选照片</p>
                  <p className="font-sans text-[11px] text-gray-300 mt-1">去照片库点击勾选，最多选 9 张</p>
                  <button
                    onClick={() => setView('gallery')}
                    className="mt-6 px-6 py-2.5 border border-editorial-border rounded-full font-sans text-[10px] font-bold uppercase tracking-widest hover:border-editorial-accent hover:text-editorial-accent transition-colors"
                  >
                    前往照片库
                  </button>
                </div>
              ) : (
                <>
                  <p className="font-sans text-[10px] text-gray-400 text-center mb-5">
                    已选 <span className="text-editorial-accent font-bold">{selectedPhotos.length}</span>/9 张 · 点 × 可移除
                  </p>

                  {/* WeChat-style 3×3 grid */}
                  <div className="bg-[#f5f5f5] p-3 rounded-2xl shadow-inner">
                    <div className="grid grid-cols-3 gap-1">
                      {CELLS.map(i => {
                        const photo = selectedPhotos[i];
                        return (
                          <div
                            key={i}
                            className={`aspect-square rounded-lg overflow-hidden relative ${!photo ? 'bg-gray-200/60 border-2 border-dashed border-gray-300' : ''}`}
                          >
                            {photo ? (
                              <>
                                <img src={photo.url} alt="" className="w-full h-full object-cover" />
                                <button
                                  onClick={() => removeFromGrid(photo)}
                                  className="absolute top-1 right-1 w-5 h-5 bg-black/60 backdrop-blur-sm rounded-full flex items-center justify-center hover:bg-black/80 transition-colors"
                                >
                                  <X className="w-2.5 h-2.5 text-white" />
                                </button>
                                <div className="absolute bottom-1 left-1 w-5 h-5 bg-editorial-accent/90 rounded-full flex items-center justify-center text-white text-[9px] font-bold font-sans">
                                  {i + 1}
                                </div>
                              </>
                            ) : (
                              <button
                                onClick={() => setView('gallery')}
                                className="w-full h-full flex items-center justify-center hover:bg-gray-300/30 transition-colors"
                              >
                                <Plus className="w-5 h-5 text-gray-300" />
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Download & tips */}
                  <div className="mt-6 space-y-3">
                    <button
                      onClick={downloadAll}
                      className="w-full bg-editorial-text text-white py-4 rounded-2xl font-sans text-[11px] font-bold uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-black active:scale-[0.98] transition-all"
                    >
                      <Download className="w-4 h-4" />
                      下载全部 {selectedPhotos.length} 张照片
                    </button>

                    <div className="bg-editorial-accent/5 border border-editorial-accent/10 rounded-xl p-4 space-y-1.5">
                      <p className="font-sans text-[10px] font-bold text-editorial-accent uppercase tracking-widest">发朋友圈步骤</p>
                      <p className="font-sans text-[11px] text-gray-500">① 点击上方按钮，{selectedPhotos.length} 张图片将自动下载</p>
                      <p className="font-sans text-[11px] text-gray-500">② 打开微信 → 发现 → 朋友圈 → 相机图标</p>
                      <p className="font-sans text-[11px] text-gray-500">③ 选择刚下载的全部照片，微信自动排成九宫格</p>
                      {selectedPhotos.length < 9 && (
                        <p className="font-sans text-[11px] text-editorial-accent/70 italic">
                          · 目前选了 {selectedPhotos.length} 张，再选 {9 - selectedPhotos.length} 张可填满九宫格
                        </p>
                      )}
                    </div>

                    <button
                      onClick={() => setSelectedPhotos([])}
                      className="w-full flex items-center justify-center gap-2 py-3 border border-gray-200 rounded-2xl font-sans text-[10px] text-gray-400 hover:border-red-200 hover:text-red-400 transition-colors"
                    >
                      <Trash2 className="w-3 h-3" />
                      清空选择
                    </button>
                  </div>
                </>
              )}
            </motion.div>
          )}
          {view === 'poster' && (
            <motion.div
              key="poster"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="max-w-sm mx-auto"
            >
              {selectedPhotos.length === 0 ? (
                <div className="text-center py-16">
                  <AlbumPosterIcon className="w-12 h-12 text-gray-200 mx-auto mb-4" />
                  <p className="font-sans font-bold text-sm text-gray-400">先选照片再生成海报</p>
                  <p className="font-sans text-[11px] text-gray-300 mt-1">去照片库勾选 1~9 张即可</p>
                  <button
                    onClick={() => setView('gallery')}
                    className="mt-6 px-6 py-2.5 border border-editorial-border rounded-full font-sans text-[10px] font-bold uppercase tracking-widest hover:border-editorial-accent hover:text-editorial-accent transition-colors"
                  >
                    前往照片库
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="bg-white border border-editorial-border rounded-2xl p-4 shadow-sm">
                    <p className="text-lg font-serif text-editorial-accent tracking-tight line-clamp-2">{posterTitle}</p>
                    <p className="font-sans text-[11px] text-gray-400 mb-2">
                      已选 {selectedPhotos.length} 张 · 推荐：
                      <span className="text-editorial-accent font-bold">
                        {COLLAGE_LAYOUT_LABELS[effectivePosterLayout]}
                      </span>
                    </p>
                    <motion.div className="flex flex-wrap gap-1.5 mb-3">
                      {(['auto', 'blur_bg_stack', 'blur_bg_scatter', 'hero_2x2', 'grid_3x3'] as const).map(key => (
                        <button
                          key={key}
                          type="button"
                          onClick={() => setPosterLayout(key)}
                          className={`px-2.5 py-1 rounded-full font-sans text-[9px] font-bold border transition-colors ${
                            posterLayout === key
                              ? 'bg-editorial-accent text-white border-editorial-accent'
                              : 'border-editorial-border text-gray-500 hover:border-editorial-accent'
                          }`}
                        >
                          {key === 'auto' ? '自动' : COLLAGE_LAYOUT_LABELS[key]}
                        </button>
                      ))}
                    </motion.div>
                    <div className="grid grid-cols-3 gap-1.5">
                      {selectedPhotos.slice(0, 9).map((photo) => (
                        <img key={photo.id} src={photo.url} alt="" className="aspect-square w-full object-cover rounded-md" />
                      ))}
                    </div>
                  </div>
                  <button
                    onClick={downloadPoster}
                    disabled={posterGenerating}
                    className="w-full bg-editorial-text text-white py-4 rounded-2xl font-sans text-[11px] font-bold uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-black active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Download className="w-4 h-4" />
                    {posterGenerating ? '生成海报中...' : '生成并下载朋友圈海报'}
                  </button>
                </div>
              )}
            </motion.div>
          )}

          {view === 'curate' && (
            <motion.div
              key="curate"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="max-w-2xl mx-auto space-y-6"
            >
              <motion.div className="bg-white border border-editorial-border rounded-2xl p-5">
                <p className="font-sans text-[10px] uppercase tracking-widest text-editorial-accent font-bold mb-2">AI 旅行社交编排</p>
                <p className="text-sm text-gray-600 leading-relaxed">
                  上传当天照片后点「分析」。AI 会按<strong>主题</strong>（美食/地标/人物/夜景等）与<strong>时间线</strong>（上午→傍晚）分组，并给出<strong>拼图方案</strong>（色调和谐、人景搭配、主图位置），可一键导出拼图。
                </p>
                <p className="font-sans text-[11px] text-gray-400 mt-2">当前第 {uploadDay} 天共 {dayPhotos.length} 张（超过 24 张将自动分批，请耐心等待）</p>
                {serverHasGemini === false && (
                  <p className="mt-3 text-sm text-amber-700 font-sans bg-amber-50 border border-amber-200 rounded-lg p-3">
                    服务端未读到 <strong>GEMINI_API_KEY</strong>。你已在 Vercel 配置的话，请对该变量勾选 Production 后<strong>重新 Deploy</strong> 一次（敏感变量不会打进网页，只会在服务端 API 使用）。
                  </p>
                )}
                {serverHasGemini === true && (
                  <p className="mt-3 text-sm text-emerald-700 font-sans bg-emerald-50 border border-emerald-200 rounded-lg p-3">
                    已连接服务端 AI（密钥在 Vercel 安全运行，不会暴露在浏览器）。
                  </p>
                )}
                {curateError && <p className="mt-3 text-sm text-red-500 font-sans">{curateError}</p>}
              </motion.div>
              {curating ? (
                <motion.div className="text-center py-16 bg-white border border-editorial-border rounded-2xl">
                  <Loader2 className="w-10 h-10 text-editorial-accent animate-spin mx-auto mb-4" />
                  <p className="font-sans font-bold text-sm text-gray-600">
                    {curateProgress
                      ? `正在分析第 ${curateProgress.current}/${curateProgress.total} 批…`
                      : '正在准备照片…'}
                  </p>
                  <p className="font-sans text-[11px] text-gray-400 mt-2">照片较多时请等待 1~3 分钟</p>
                </motion.div>
              ) : !curation ? (
                <motion.div className="text-center py-12">
                  <Sparkles className="w-12 h-12 text-gray-200 mx-auto mb-4" />
                  <p className="font-sans text-sm text-gray-400">上传照片后点击右上角「分析第 {uploadDay} 天」</p>
                </motion.div>
              ) : (
                <>
                  <motion.p className="font-sans text-sm text-gray-600 bg-editorial-accent/5 border border-editorial-accent/10 rounded-xl p-4">
                    {curation.summary}
                    {curation.posts.length > 0 && (
                      <span className="block mt-2 font-bold text-editorial-accent">
                        共 {curation.posts.length} 条发布方案 ↓
                      </span>
                    )}
                  </motion.p>
                  {curation.posts.length === 0 ? (
                    <motion.div className="text-center py-10 bg-white border border-amber-200 rounded-2xl">
                      <p className="font-sans text-sm text-amber-800 mb-3">分析已完成，但没有生成可展示的卡片。</p>
                      <button
                        type="button"
                        onClick={runCurate}
                        disabled={curating}
                        className="px-4 py-2 rounded-full bg-editorial-accent text-white font-sans text-[11px] font-bold"
                      >
                        重新分析
                      </button>
                    </motion.div>
                  ) : (
                  <motion.div className="space-y-6">
                    {curationGroups.map(group => (
                      <div key={group.theme}>
                        <div className="flex items-center gap-2 mb-3 sticky top-24 z-10 bg-editorial-bg/90 py-1">
                          <span className="font-sans text-[10px] font-bold uppercase tracking-widest text-white bg-editorial-accent px-3 py-1 rounded-full">
                            主题 · {group.theme}
                          </span>
                          <span className="font-sans text-[10px] text-gray-400">{group.posts.length} 条时间线</span>
                        </div>
                        <div className="space-y-4">
                          {group.posts.map(post => {
                            const thumbs = photosForPost(post);
                            return (
                              <motion.div key={post.id} className="bg-white border border-editorial-border rounded-2xl p-4 shadow-sm">
                                <motion.div className="flex flex-wrap items-start justify-between gap-2 mb-2">
                                  <motion.div>
                                    <p className="text-lg tracking-tight">{post.title}</p>
                                    <p className="font-sans text-[10px] text-gray-500 mt-1">
                                      <span className="text-editorial-accent font-bold">{post.timeSlot}</span>
                                      {' · '}
                                      {post.scene} · {post.mood} · 故事线 #{post.storylineOrder}
                                    </p>
                                  </motion.div>
                                  <div className="flex flex-wrap gap-1 justify-end">
                                    <span className="font-sans text-[9px] font-bold uppercase tracking-widest bg-gray-100 text-gray-600 px-2 py-1 rounded-full">
                                      {COLLAGE_LAYOUT_LABELS[post.collageLayout]}
                                    </span>
                                    <span className="font-sans text-[9px] font-bold uppercase tracking-widest bg-editorial-accent/10 text-editorial-accent px-2 py-1 rounded-full">
                                      {FORMAT_LABELS[post.format]}
                                    </span>
                                  </div>
                                </motion.div>
                                <motion.div className="font-sans text-[11px] text-gray-600 bg-amber-50/80 border border-amber-100 rounded-xl p-3 mb-3 leading-relaxed">
                                  <p className="text-[9px] font-bold uppercase tracking-widest text-amber-800/80 mb-1">拼图方案</p>
                                  {post.collageRationale}
                                  {post.layoutHint && (
                                    <p className="text-gray-500 mt-1.5 text-[10px]">排版：{post.layoutHint}</p>
                                  )}
                                </motion.div>
                                <motion.div className="grid grid-cols-4 sm:grid-cols-6 gap-1 mb-3">
                                  {thumbs.map(p => (
                                    <img key={p.id} src={p.url} alt="" className="aspect-square object-cover rounded-md" />
                                  ))}
                                </motion.div>
                                <motion.p className="font-sans text-[12px] text-gray-700 leading-relaxed mb-1">{post.caption}</motion.p>
                                <motion.p className="font-sans text-[10px] text-editorial-accent/80 mb-4">{post.hashtags.join(' ')}</motion.p>
                                <motion.div className="flex flex-wrap gap-2">
                                  {isPosterFriendlyPost(post) && (
                                    <button
                                      type="button"
                                      onClick={() => goToPosterFromPost(post)}
                                      className="px-3 py-1.5 rounded-full bg-editorial-accent text-white font-sans text-[10px] font-bold flex items-center gap-1 hover:opacity-90"
                                    >
                                      <AlbumPosterIcon className="w-3 h-3" />
                                      去生成海报
                                    </button>
                                  )}
                                  <button type="button" onClick={() => applyPostToSelection(post)} className="px-3 py-1.5 rounded-full border border-editorial-border font-sans text-[10px] font-bold hover:border-editorial-accent hover:text-editorial-accent">载入九宫格</button>
                                  <button type="button" onClick={() => copyCaption(post)} className="px-3 py-1.5 rounded-full border border-editorial-border font-sans text-[10px] font-bold flex items-center gap-1 hover:border-editorial-accent"><Copy className="w-3 h-3" /> 复制文案</button>
                                  <button type="button" onClick={() => exportCuratedPost(post)} disabled={posterGenerating} className="px-3 py-1.5 rounded-full bg-editorial-text text-white font-sans text-[10px] font-bold flex items-center gap-1 disabled:opacity-50">
                                    <Download className="w-3 h-3" />
                                    {posterGenerating ? '生成中…' : `导出${COLLAGE_LAYOUT_LABELS[post.collageLayout]}`}
                                  </button>
                                </motion.div>
                              </motion.div>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </motion.div>
                  )}
                </>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

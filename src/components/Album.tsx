/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useRef, useCallback, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Itinerary, Photo, CuratedPost, PhotoCurationResult } from '../types';
import { Camera, Download, Upload, BookOpen, MapPin, Sparkles, Loader2, Copy, FileText, Printer } from 'lucide-react';
import { Translations } from '../lib/i18n';
import { curateDayPhotos, fetchServerHasGemini } from '../lib/photoCurate';
import { getCachedCuration } from '../lib/curationCache';
import { buildDayReportHtml, downloadDayReportHtml, printDayReport } from '../lib/dayReport';
import StoryBook from './StoryBook';

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
  const [view, setView] = useState<'gallery' | 'curate' | 'report'>('gallery');
  const [curating, setCurating] = useState(false);
  const [curateProgress, setCurateProgress] = useState<{ current: number; total: number } | null>(null);
  const [curation, setCuration] = useState<PhotoCurationResult | null>(null);
  const [curateError, setCurateError] = useState<string | null>(null);
  const [usedCache, setUsedCache] = useState(false);
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

  const tripContext = useMemo(() => {
    const dayPlan = itinerary.days.find(d => d.day === uploadDay);
    return dayPlan
      ? `Day ${dayPlan.day}: ${dayPlan.title}. Locations: ${dayPlan.locations.map(l => l.name).join(', ')}`
      : itinerary.narrative?.vibe || '';
  }, [itinerary, uploadDay]);

  const dayPhotoKey = useMemo(
    () => dayPhotos.map(p => p.id).sort().join('|'),
    [dayPhotos]
  );

  const hasCachedCuration = useMemo(
    () => Boolean(dayPhotos.length && getCachedCuration(uploadDay, dayPhotos, tripContext)),
    [uploadDay, dayPhotos, tripContext, dayPhotoKey]
  );

  useEffect(() => {
    if (dayPhotos.length === 0) {
      setCuration(null);
      setUsedCache(false);
      return;
    }
    const cached = getCachedCuration(uploadDay, dayPhotos, tripContext);
    setCuration(cached);
    setUsedCache(false);
  }, [uploadDay, dayPhotoKey, tripContext, dayPhotos]);

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

  const reportHtml = useMemo(() => {
    if (!curation) return null;
    return buildDayReportHtml({ curation, itinerary, photosById: photoById });
  }, [curation, itinerary, photoById]);

  const runCurate = async (forceRefresh = false) => {
    if (dayPhotos.length === 0) return;
    setCurateError(null);
    setCurateProgress(null);

    if (!forceRefresh) {
      const cached = getCachedCuration(uploadDay, dayPhotos, tripContext);
      if (cached) {
        setCuration(cached);
        setUsedCache(true);
        setView('report');
        return;
      }
    }

    setUsedCache(false);
    setCurating(true);
    try {
      const result = await curateDayPhotos(
        dayPhotos,
        uploadDay,
        tripContext,
        p => setCurateProgress(p),
        { forceRefresh }
      );
      setCuration(result);
      setView('report');
    } catch (e) {
      setCurateError(e instanceof Error ? e.message : '分析失败，请稍后重试');
    } finally {
      setCurating(false);
      setCurateProgress(null);
    }
  };

  const photosForPost = (post: CuratedPost) =>
    post.photoIds.map(id => photoById.get(id)).filter((p): p is Photo => Boolean(p));

  const copyCaption = (post: CuratedPost) => {
    const text = `${post.caption}\n\n${post.hashtags.join(' ')}`;
    navigator.clipboard.writeText(text).catch(() => {});
  };

  const copyFullReportText = () => {
    if (!curation) return;
    const sorted = [...curation.posts].sort((a, b) => a.storylineOrder - b.storylineOrder);
    const blocks = sorted.map(post => {
      const photos = photosForPost(post);
      const names = photos.map((p, i) => `图${i + 1} ${p.locationName}`).join('、');
      return `【故事线 #${post.storylineOrder}】${post.title}\n${post.theme} · ${post.timeSlot}\n照片：${names}\n说明：${post.collageRationale}\n配文：${post.caption}\n${post.hashtags.join(' ')}`;
    });
    const text = [curation.summary, '', ...blocks].join('\n\n');
    navigator.clipboard.writeText(text).catch(() => {});
  };

  return (
    <div className="w-full h-full overflow-y-auto overflow-x-hidden scrollbar-hide bg-editorial-bg font-serif">
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
            onClick={() => setView('curate')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full font-sans text-[10px] font-bold uppercase tracking-widest transition-all ${
              view === 'curate' ? 'bg-white shadow text-editorial-accent' : 'text-gray-400'
            }`}
          >
            <Sparkles className="w-3 h-3" />
            智能编排
          </button>
          <button
            onClick={() => setView('report')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full font-sans text-[10px] font-bold uppercase tracking-widest transition-all ${
              view === 'report' ? 'bg-white shadow text-editorial-accent' : 'text-gray-400'
            }`}
          >
            <FileText className="w-3 h-3" />
            完整报告
          </button>
        </div>

        {/* Right actions */}
        {(view === 'gallery' || view === 'curate' || view === 'report') && (
          <div className="flex items-center gap-2 min-w-0">
            <span className="font-sans text-[10px] text-gray-400 shrink-0">
              {view === 'curate' ? '分析' : view === 'report' ? '报告' : '上传到'}
            </span>
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

        {view === 'report' && curation && (
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => reportHtml && printDayReport(reportHtml)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-full border border-editorial-border font-sans text-[10px] font-bold hover:border-editorial-accent"
            >
              <Printer className="w-3 h-3" />
              打印
            </button>
            <button
              type="button"
              onClick={() => reportHtml && downloadDayReportHtml(reportHtml, curation.day)}
              className="flex items-center gap-1.5 bg-editorial-text text-white px-4 py-2 rounded-full font-sans text-[10px] font-bold"
            >
              <Download className="w-3 h-3" />
              下载报告
            </button>
          </div>
        )}
        {view === 'curate' && (
          <div className="flex items-center gap-2 shrink-0">
            {hasCachedCuration && (
              <button
                type="button"
                onClick={() => runCurate(true)}
                disabled={curating || dayPhotos.length === 0}
                className="px-3 py-2 rounded-full border border-editorial-border font-sans text-[10px] font-bold text-gray-600 hover:border-editorial-accent disabled:opacity-50"
              >
                重新分析
              </button>
            )}
            <button
              type="button"
              onClick={() => runCurate(false)}
              disabled={curating || dayPhotos.length === 0}
              className="flex items-center gap-2 bg-editorial-accent text-white px-4 py-2 rounded-full font-sans text-[10px] font-bold uppercase tracking-widest hover:opacity-90 active:scale-95 transition-all disabled:opacity-50"
            >
              {curating ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
              {curating && curateProgress
                ? `分析中 ${curateProgress.current}/${curateProgress.total} 批…`
                : curating
                  ? '分析中…'
                  : hasCachedCuration
                    ? `查看第 ${uploadDay} 天编排`
                    : `分析第 ${uploadDay} 天 (${dayPhotos.length} 张)`}
            </button>
          </div>
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
                  <p className="font-sans text-[11px] text-gray-300 mt-1 italic">上传后可智能编排：按主题与时间线告诉你哪些照片放一起</p>
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
                            <p className="font-sans text-[10px] text-gray-400 mt-0.5">{dayPhotos.length} 张</p>
                          </div>
                        </div>
                        <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 gap-1.5">
                          {dayPhotos.map(photo => (
                              <div
                                key={photo.id}
                                className="relative aspect-square rounded-xl overflow-hidden group"
                              >
                                <img
                                  src={photo.url}
                                  alt=""
                                  className="w-full h-full object-cover transition-all duration-300 group-hover:scale-105 group-hover:brightness-90"
                                />
                                {photo.locationName && (
                                  <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-2 translate-y-full group-hover:translate-y-0 transition-transform">
                                    <div className="flex items-center gap-1">
                                      <MapPin className="w-2.5 h-2.5 text-editorial-accent shrink-0" />
                                      <p className="font-sans text-[9px] text-white font-bold truncate">{photo.locationName}</p>
                                    </div>
                                  </div>
                                )}
                              </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
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
              className="max-w-3xl mx-auto"
            >
              {!curation && !curating && (
                <p className="text-center font-sans text-[10px] text-gray-400 tracking-widest uppercase mb-8 print:hidden">
                  将当日影像交给 AI，编成可翻阅的行记
                  {dayPhotos.length > 0 && ` · ${dayPhotos.length} 帧待读`}
                </p>
              )}
              {(hasCachedCuration || usedCache) && !curating && curation && (
                <p className="text-center font-sans text-[10px] text-gray-400 italic mb-6 print:hidden">
                  {usedCache ? '自本地卷册唤回' : '卷册已备，可翻阅或重新执笔'}
                </p>
              )}
              {curateError && (
                <p className="text-center text-sm text-red-500 font-sans mb-6">{curateError}</p>
              )}
              {serverHasGemini === false && !curation && (
                <p className="text-center font-sans text-[10px] text-amber-700/80 mb-6 max-w-md mx-auto">
                  未连接 AI 时将使用演示卷册；配置 GEMINI_API_KEY 后可获真实编排
                </p>
              )}
              {curating ? (
                <div className="storybook-cover text-center py-20">
                  <Loader2 className="w-8 h-8 text-editorial-accent/60 animate-spin mx-auto mb-6" />
                  <p className="text-xl italic text-gray-500">
                    {curateProgress
                      ? `翻阅底片中… ${curateProgress.current} / ${curateProgress.total}`
                      : '正在打开空白册页…'}
                  </p>
                  <p className="font-sans text-[10px] text-gray-300 mt-3 tracking-widest uppercase">
                    请稍候
                  </p>
                </div>
              ) : !curation ? (
                <div className="storybook-cover text-center py-16">
                  <Sparkles className="w-10 h-10 text-editorial-accent/25 mx-auto mb-6" />
                  <p className="text-2xl italic text-gray-400 leading-relaxed">
                    册页尚空
                  </p>
                  <p className="font-sans text-[10px] text-gray-300 mt-4 tracking-widest">
                    上传照片后，点右上角开始编排
                  </p>
                </div>
              ) : curation.posts.length === 0 ? (
                <div className="storybook-cover text-center py-12">
                  <p className="italic text-gray-500 mb-6">光影已至，叙事未成——请再试一次编排</p>
                  <button
                    type="button"
                    onClick={() => runCurate(true)}
                    disabled={curating}
                    className="font-sans text-[10px] font-bold tracking-widest uppercase text-editorial-accent border-b border-editorial-accent/30 pb-0.5"
                  >
                    重新执笔
                  </button>
                </div>
              ) : (
                <StoryBook
                  curation={curation}
                  itinerary={itinerary}
                  photosForPost={photosForPost}
                  photosById={photoById}
                  onCopyCaption={copyCaption}
                  onOpenReport={() => setView('report')}
                />
              )}
            </motion.div>
          )}

          {view === 'report' && (
            <motion.div
              key="report"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="max-w-3xl mx-auto"
            >
              {!curation ? (
                <div className="storybook-cover text-center py-16">
                  <FileText className="w-10 h-10 text-editorial-accent/25 mx-auto mb-6" />
                  <p className="text-xl italic text-gray-400 mb-6">卷册未立，请先完成智能编排</p>
                  <button
                    type="button"
                    onClick={() => setView('curate')}
                    className="font-sans text-[10px] font-bold tracking-widest uppercase text-editorial-accent"
                  >
                    前往编排 →
                  </button>
                </div>
              ) : (
                <div className="album-print-container">
                  <div className="flex justify-end gap-3 mb-4 print:hidden">
                    <button
                      type="button"
                      onClick={copyFullReportText}
                      className="font-sans text-[10px] text-gray-400 hover:text-editorial-accent flex items-center gap-1"
                    >
                      <Copy className="w-3 h-3" /> 复制全文
                    </button>
                  </div>
                  <StoryBook
                    curation={curation}
                    itinerary={itinerary}
                    photosForPost={photosForPost}
                    photosById={photoById}
                    onCopyCaption={copyCaption}
                  />
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

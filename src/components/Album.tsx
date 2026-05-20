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
import { buildDayReportHtml, downloadDayReportHtml, printDayReport } from '../lib/dayReport';

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

  const reportHtml = useMemo(() => {
    if (!curation) return null;
    return buildDayReportHtml({ curation, itinerary, photosById: photoById });
  }, [curation, itinerary, photoById]);

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
              className="max-w-2xl mx-auto space-y-6"
            >
              <motion.div className="bg-white border border-editorial-border rounded-2xl p-5">
                <p className="font-sans text-[10px] uppercase tracking-widest text-editorial-accent font-bold mb-2">AI 旅行社交编排</p>
                <p className="text-sm text-gray-600 leading-relaxed">
                  上传当天照片后点「分析」。AI 会按<strong>主题</strong>与<strong>时间线</strong>告诉你<strong>哪些照片应放在同一条故事</strong>里，并说明编组理由。完成后可到「完整报告」页查看整日文档。
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
                    {curation.posts.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setView('report')}
                        className="w-full py-3 rounded-2xl bg-editorial-text text-white font-sans text-[11px] font-bold flex items-center justify-center gap-2"
                      >
                        <FileText className="w-4 h-4" />
                        查看完整故事线报告
                      </button>
                    )}
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
                                </motion.div>
                                <div className="font-sans text-[11px] text-gray-600 bg-amber-50/80 border border-amber-100 rounded-xl p-3 mb-3 leading-relaxed">
                                  <p className="text-[9px] font-bold uppercase tracking-widest text-amber-800/80 mb-1">编组说明 · 建议放一起的照片</p>
                                  {post.collageRationale}
                                  {post.layoutHint && (
                                    <p className="text-gray-500 mt-1.5 text-[10px]">顺序提示：{post.layoutHint}</p>
                                  )}
                                </div>
                                <div className="grid grid-cols-4 sm:grid-cols-6 gap-1.5 mb-3">
                                  {thumbs.map((p, i) => (
                                    <div key={p.id} className="relative aspect-square rounded-md overflow-hidden">
                                      <img src={p.url} alt="" className="w-full h-full object-cover" />
                                      <span className="absolute top-0.5 left-0.5 w-5 h-5 bg-editorial-accent text-white text-[9px] font-bold font-sans rounded-full flex items-center justify-center">
                                        {i + 1}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                                <p className="font-sans text-[12px] text-gray-700 leading-relaxed mb-1">{post.caption}</p>
                                <p className="font-sans text-[10px] text-editorial-accent/80 mb-3">{post.hashtags.join(' ')}</p>
                                <button
                                  type="button"
                                  onClick={() => copyCaption(post)}
                                  className="px-3 py-1.5 rounded-full border border-editorial-border font-sans text-[10px] font-bold flex items-center gap-1 hover:border-editorial-accent"
                                >
                                  <Copy className="w-3 h-3" /> 复制本条文案
                                </button>
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

          {view === 'report' && (
            <motion.div
              key="report"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="max-w-2xl mx-auto space-y-4"
            >
              {!curation ? (
                <div className="text-center py-16 bg-white border border-editorial-border rounded-2xl p-8">
                  <FileText className="w-12 h-12 text-gray-200 mx-auto mb-4" />
                  <p className="font-sans text-sm text-gray-500 mb-4">请先在「智能编排」完成第 {uploadDay} 天分析</p>
                  <button
                    type="button"
                    onClick={() => setView('curate')}
                    className="px-6 py-2.5 rounded-full bg-editorial-accent text-white font-sans text-[11px] font-bold"
                  >
                    去智能编排
                  </button>
                </div>
              ) : (
                <>
                  <div className="flex flex-wrap gap-2 print:hidden">
                    <button
                      type="button"
                      onClick={copyFullReportText}
                      className="px-3 py-1.5 rounded-full border border-editorial-border font-sans text-[10px] font-bold flex items-center gap-1"
                    >
                      <Copy className="w-3 h-3" /> 复制全文
                    </button>
                  </div>
                  <div className="bg-white border border-editorial-border rounded-2xl p-6 space-y-8 album-print-container">
                    <div>
                      <p className="font-sans text-[10px] uppercase tracking-widest text-editorial-accent font-bold">完整故事线报告</p>
                      <h2 className="text-2xl tracking-tight mt-1">
                        {itinerary.days.find(d => d.day === curation.day)?.title || `第 ${curation.day} 天`}
                      </h2>
                      <p className="font-sans text-sm text-gray-600 mt-3 leading-relaxed">{curation.summary}</p>
                    </div>
                    {[...curation.posts]
                      .sort((a, b) => a.storylineOrder - b.storylineOrder)
                      .map(post => {
                        const thumbs = photosForPost(post);
                        return (
                          <section key={post.id} className="break-inside-avoid border-t border-editorial-border pt-6">
                            <p className="font-sans text-[10px] font-bold text-editorial-accent uppercase tracking-widest">
                              故事线 #{post.storylineOrder} · {post.theme} · {post.timeSlot}
                            </p>
                            <h3 className="text-xl tracking-tight mt-1">{post.title}</h3>
                            <p className="font-sans text-[11px] text-gray-400 mt-1">{post.scene} · {post.mood}</p>
                            <div className="mt-3 p-3 bg-amber-50/80 border border-amber-100 rounded-xl text-sm text-gray-700 leading-relaxed">
                              <strong className="block text-[10px] uppercase tracking-widest text-amber-800/90 mb-1">编组说明</strong>
                              {post.collageRationale}
                            </div>
                            <p className="font-sans text-[11px] font-bold text-gray-500 mt-3 mb-2">本组 {thumbs.length} 张照片（按建议顺序）</p>
                            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                              {thumbs.map((p, i) => (
                                <div key={p.id} className="relative aspect-square rounded-lg overflow-hidden">
                                  <img src={p.url} alt="" className="w-full h-full object-cover" />
                                  <span className="absolute top-1 left-1 min-w-[1.25rem] h-5 px-1 bg-editorial-accent text-white text-[9px] font-bold font-sans rounded-full flex items-center justify-center">
                                    {i + 1}
                                  </span>
                                  <span className="absolute bottom-0 inset-x-0 bg-black/50 text-white text-[8px] px-1 py-0.5 truncate font-sans">
                                    {p.locationName}
                                  </span>
                                </div>
                              ))}
                            </div>
                            <p className="font-sans text-sm text-gray-700 mt-4 leading-relaxed">{post.caption}</p>
                            <p className="font-sans text-[11px] text-editorial-accent/80 mt-1">{post.hashtags.join(' ')}</p>
                          </section>
                        );
                      })}
                    {(curation.unusedPhotoIds?.length ?? 0) > 0 && (
                      <section className="border-t border-dashed border-gray-200 pt-6">
                        <h3 className="font-sans text-sm font-bold text-gray-500">未编入故事线的照片</h3>
                        <ul className="mt-2 font-sans text-[11px] text-gray-500 list-disc pl-4 space-y-1">
                          {curation.unusedPhotoIds!.map(id => {
                            const p = photoById.get(id);
                            return p ? <li key={id}>{p.locationName}</li> : null;
                          })}
                        </ul>
                      </section>
                    )}
                  </div>
                </>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

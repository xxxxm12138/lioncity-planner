/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState } from 'react';
import Sidebar from './components/Sidebar';
import AppMap from './components/Map';
import Album from './components/Album';
import { generateItinerary } from './lib/gemini';
import { Itinerary, Photo } from './types';
import { Map as MapIcon, Image as ImageIcon, ListChecks, Globe } from 'lucide-react';
import { Locale, getTranslations } from './lib/i18n';


export default function App() {

  const [itinerary, setItinerary] = useState<Itinerary | null>(() => {
    try {
      const saved = localStorage.getItem('sg_planner_itinerary');
      return saved ? JSON.parse(saved) : null;
    } catch {
      localStorage.removeItem('sg_planner_itinerary');
      return null;
    }
  });
  const [loading, setLoading] = useState(false);
  const [activeDay, setActiveDay] = useState(1);
  const [currentView, setCurrentView] = useState<'map' | 'album'>('map');
  const [mobileTab, setMobileTab] = useState<'plan' | 'map' | 'album'>('plan');
  const [locale, setLocale] = useState<Locale>(() => {
    return (localStorage.getItem('sg_planner_locale') as Locale) || 'zh';
  });

  const t = getTranslations(locale);

  const toggleLocale = () => {
    const next = locale === 'zh' ? 'en' : 'zh';
    setLocale(next);
    localStorage.setItem('sg_planner_locale', next);
  };

  const handleGenerate = async (hotel: string, attractions: string, days: number) => {
    setLoading(true);
    try {
      const plan = await generateItinerary(hotel, attractions, days);
      setItinerary(plan);
      localStorage.setItem('sg_planner_itinerary', JSON.stringify(plan));
      setActiveDay(1);
      setCurrentView('map');
      setMobileTab('map');
    } catch (error) {
      console.error(error);
      alert(t.errorGenerate);
    } finally {
      setLoading(false);
    }
  };

  const handleAddPhoto = (photo: Photo) => {
    if (!itinerary) return;
    
    setItinerary(prev => {
      if (!prev) return prev;
      const updated = {
        ...prev,
        days: prev.days.map(d => {
          if (d.day === photo.day) {
            return { ...d, photos: [...(d.photos || []), photo] };
          }
          return d;
        })
      };
      localStorage.setItem('sg_planner_itinerary', JSON.stringify(updated));
      return updated;
    });
  };


  const handleBulkAddPhotos = (photos: Photo[]) => {
    setItinerary(prev => {
      const base = prev ?? { days: [], narrative: { foreword: '', epilogue: '', vibe: '' } };
      const byDay = new globalThis.Map<number, Photo[]>();
      photos.forEach(p => {
        if (!byDay.has(p.day)) byDay.set(p.day, []);
        byDay.get(p.day)!.push(p);
      });

      // 已有行程：追加到对应天；没有对应天：创建存根天
      let days = base.days.map(d => {
        const newPhotos = byDay.get(d.day) || [];
        byDay.delete(d.day);
        if (newPhotos.length === 0) return d;
        return { ...d, photos: [...(d.photos || []), ...newPhotos] };
      });
      // 剩余没有匹配行程天的照片 → 创建存根
      byDay.forEach((dayPhotos, dayNum) => {
        days.push({ day: dayNum, title: `第 ${dayNum} 天`, locations: [], photos: dayPhotos });
      });
      days.sort((a, b) => a.day - b.day);

      const updated = { ...base, days };
      try {
        const withoutPhotos = {
          ...updated,
          days: updated.days.map(d => ({ ...d, photos: [] })),
        };
        localStorage.setItem('sg_planner_itinerary', JSON.stringify(withoutPhotos));
      } catch {
        // localStorage 满了也不影响当前会话
      }
      return updated;
    });
  };

  const handleClearItinerary = () => {
    localStorage.removeItem('sg_planner_itinerary');
    localStorage.removeItem('sg_planner_hotel');
    localStorage.removeItem('sg_planner_attractions');
    localStorage.removeItem('sg_planner_days');
    setItinerary(null);
    setActiveDay(1);
    setCurrentView('map');
    setMobileTab('plan');
  };

  const dateStr = new Date().toLocaleDateString('en-US', { month: 'short', year: 'numeric' });

  return (
    <>
    <>
      {/* Desktop layout */}
      <div className="hidden lg:flex h-screen w-full bg-editorial-bg overflow-hidden font-serif">
        <div className="w-[450px] flex-shrink-0 h-full">
          <Sidebar 
            onGenerate={handleGenerate}
            onAddPhoto={handleAddPhoto}
            onClear={handleClearItinerary}
            itinerary={itinerary} 
            loading={loading} 
            activeDay={activeDay}
            setActiveDay={setActiveDay}
            t={t}
          />
        </div>
        <div className="flex-1 h-full relative p-10 flex flex-col">
          <header className="flex justify-between items-end border-b border-editorial-border pb-6 mb-8 z-10 sticky top-0 bg-editorial-bg/80 backdrop-blur-sm px-4">
              <div className="flex items-end gap-12">
                <div className="flex items-center p-1 bg-gray-100 rounded-sm mb-1">
                  <button 
                    onClick={() => setCurrentView('map')}
                    className={`flex items-center gap-2 px-4 py-2 transition-all font-sans text-[10px] font-bold uppercase tracking-widest ${currentView === 'map' ? 'bg-white shadow-sm text-editorial-accent' : 'text-gray-400 hover:text-editorial-text'}`}
                  >
                    <MapIcon className="w-3 h-3" />
                    {t.tabMap}
                  </button>
                  <button 
                    onClick={() => setCurrentView('album')}
                    className={`flex items-center gap-2 px-4 py-2 transition-all font-sans text-[10px] font-bold uppercase tracking-widest ${currentView === 'album' ? 'bg-white shadow-sm text-editorial-accent' : 'text-gray-400 hover:text-editorial-text'}`}
                  >
                    <ImageIcon className="w-3 h-3" />
                    {t.tabAlbum}
                  </button>
                </div>
              </div>
              <div className="flex items-end gap-6">
                <button
                  onClick={toggleLocale}
                  className="flex items-center gap-1.5 px-3 py-1.5 border border-editorial-border rounded-full font-sans text-[10px] font-bold uppercase tracking-widest hover:border-editorial-accent hover:text-editorial-accent transition-all mb-1"
                >
                  <Globe className="w-3 h-3" />
                  {locale === 'zh' ? 'EN' : '中'}
                </button>
                <div className="text-right font-sans">
                  <div className="text-[10px] uppercase tracking-widest opacity-40 mb-1 font-bold">{t.weather}</div>
                  <div className="text-2xl font-light tracking-tighter text-editorial-accent">31°C / Humidity 82%</div>
                </div>
              </div>
          </header>

          <div className="flex-1 relative rounded-sm border border-editorial-border overflow-hidden bg-white shadow-sm">
              {currentView === 'map' ? (
                <>
                  <AppMap itinerary={itinerary} activeDay={activeDay} t={t} />
                  <div className="absolute bottom-6 left-6 font-sans text-[9px] tracking-[0.2em] uppercase opacity-40 font-bold pointer-events-none">
                    {t.schematicView} — {activeDay > 0 ? t.circuitDay(activeDay) : t.globalOverview}
                  </div>
                </>
              ) : (
                <Album
                  itinerary={itinerary ?? { days: [], narrative: { foreword: '', epilogue: '', vibe: '' } }}
                  t={t}
                  onAddPhotos={handleBulkAddPhotos}
                  activeDay={activeDay}
                />
              )}
          </div>

          {itinerary && (
              <div className="flex justify-center mt-8 pointer-events-none z-20">
                  <div className="bg-white px-8 py-4 rounded-full shadow-lg border border-editorial-border flex items-center gap-10 pointer-events-auto">
                      {itinerary.days.map(d => (
                          <button
                              key={d.day}
                              onClick={() => setActiveDay(d.day)}
                              className={`flex flex-col items-center gap-0.5 transition-all group ${
                                  activeDay === d.day ? 'scale-110' : 'opacity-30 hover:opacity-100'
                              }`}
                          >
                              <span className="font-sans text-[8px] uppercase font-black tracking-widest text-editorial-accent">{t.day}</span>
                              <span className="text-3xl tracking-tighter font-serif text-editorial-text">{d.day}</span>
                              <div className={`h-1 bg-editorial-accent transition-all ${activeDay === d.day ? 'w-full' : 'w-0'}`} />
                          </button>
                      ))}
                  </div>
              </div>
          )}
        </div>
      </div>

      {/* Mobile layout */}
      <div className="flex lg:hidden flex-col h-screen w-full bg-editorial-bg overflow-hidden font-serif">
        <header className="flex-shrink-0 px-4 pt-3 pb-2 border-b border-editorial-border bg-editorial-bg/95 backdrop-blur-md z-30">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl tracking-tighter leading-none text-editorial-text">
                {t.title} <span className="italic">{t.titleItalic}</span>
              </h1>
              <p className="font-sans text-[8px] uppercase tracking-[0.2em] opacity-40 font-bold mt-0.5">
                {t.subtitleMobile(itinerary?.days.length || 3, dateStr)}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={toggleLocale}
                className="w-7 h-7 rounded-full border border-editorial-border flex items-center justify-center font-sans text-[9px] font-black hover:border-editorial-accent hover:text-editorial-accent transition-all"
              >
                {locale === 'zh' ? 'EN' : '中'}
              </button>
              {itinerary && itinerary.days.map(d => (
                <button
                  key={d.day}
                  onClick={() => setActiveDay(d.day)}
                  className={`w-7 h-7 rounded-full text-[10px] font-sans font-black transition-all border ${
                    activeDay === d.day 
                      ? 'bg-editorial-accent text-white border-editorial-accent' 
                      : 'bg-white text-editorial-text border-editorial-border'
                  }`}
                >
                  {d.day}
                </button>
              ))}
            </div>
          </div>
        </header>

        <div className="flex-1 overflow-hidden relative">
          {mobileTab === 'plan' && (
            <div className="h-full overflow-y-auto">
              <Sidebar 
                onGenerate={handleGenerate}
                onAddPhoto={handleAddPhoto}
                onClear={handleClearItinerary}
                itinerary={itinerary} 
                loading={loading} 
                activeDay={activeDay}
                setActiveDay={setActiveDay}
                mobile
                t={t}
              />
            </div>
          )}
          {mobileTab === 'map' && (
            <div className="h-full relative">
              <AppMap itinerary={itinerary} activeDay={activeDay} t={t} />
            </div>
          )}
          {mobileTab === 'album' && (
            <div className="h-full overflow-y-auto">
              <Album
                itinerary={itinerary ?? { days: [], narrative: { foreword: '', epilogue: '', vibe: '' } }}
                t={t}
                onAddPhotos={handleBulkAddPhotos}
                activeDay={activeDay}
              />
            </div>
          )}
        </div>

        <nav className="flex-shrink-0 border-t border-editorial-border bg-white/95 backdrop-blur-md px-2 pb-[env(safe-area-inset-bottom)] z-30">
          <div className="flex items-center justify-around py-2">
            <button
              onClick={() => setMobileTab('plan')}
              className={`flex flex-col items-center gap-0.5 px-4 py-1.5 rounded-lg transition-all ${
                mobileTab === 'plan' ? 'text-editorial-accent' : 'text-gray-400'
              }`}
            >
              <ListChecks className="w-5 h-5" />
              <span className="text-[9px] font-sans font-bold uppercase tracking-wider">{t.tabPlan}</span>
            </button>
            <button
              onClick={() => setMobileTab('map')}
              className={`flex flex-col items-center gap-0.5 px-4 py-1.5 rounded-lg transition-all ${
                mobileTab === 'map' ? 'text-editorial-accent' : 'text-gray-400'
              }`}
            >
              <MapIcon className="w-5 h-5" />
              <span className="text-[9px] font-sans font-bold uppercase tracking-wider">{t.tabMap}</span>
            </button>
            <button
              onClick={() => setMobileTab('album')}
              className={`flex flex-col items-center gap-0.5 px-4 py-1.5 rounded-lg transition-all ${
                mobileTab === 'album' ? 'text-editorial-accent' : 'text-gray-400'
              }`}
            >
              <ImageIcon className="w-5 h-5" />
              <span className="text-[9px] font-sans font-bold uppercase tracking-wider">{t.tabAlbum}</span>
            </button>
          </div>
        </nav>
      </div>
    </>
    </>
  );
}

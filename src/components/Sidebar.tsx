/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Plane, MapPin, Hotel, Calendar, Loader2, Sparkles, ChevronRight, Navigation, Utensils, Footprints, Train, Briefcase, Camera } from 'lucide-react';
import { Itinerary, Photo } from '../types';
import { Translations } from '../lib/i18n';

interface SidebarProps {
  onGenerate: (hotel: string, attractions: string, days: number) => Promise<void>;
  onAddPhoto?: (photo: Photo) => void;
  onClear?: () => void;
  itinerary: Itinerary | null;
  loading: boolean;
  activeDay: number;
  setActiveDay: (day: number) => void;
  mobile?: boolean;
  t: Translations;
}

const DEFAULT_HOTEL = `第1天（5月17日）：Ebisu Hotel
第2天（5月18日）：K2 Guest House`;

const DEFAULT_ATTRACTIONS = `第1天（5月17日）：从樟宜机场入境，在机场和Jewel星耀樟宜逛逛后，前往滨海湾花园游览云雾林（Cloud Forest）和花穹（Flower Dome），傍晚去鱼尾狮公园（Merlion Park）。
第2天（5月18日）：参观新加坡国立大学（NUS），游览理学院（Faculty of Science）和University Town。`;

const DEFAULT_DAYS = 2;

export default function Sidebar({ onGenerate, onAddPhoto, onClear, itinerary, loading, activeDay, setActiveDay, mobile, t }: SidebarProps) {
  const [hotelInput, setHotelInput] = useState(() => localStorage.getItem('sg_planner_hotel') || DEFAULT_HOTEL);
  const [attractionsInput, setAttractionsInput] = useState(() => localStorage.getItem('sg_planner_attractions') || DEFAULT_ATTRACTIONS);
  const [daysInput, setDaysInput] = useState(() => Number(localStorage.getItem('sg_planner_days')) || DEFAULT_DAYS);
  const [showForm, setShowForm] = useState(!itinerary);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>, locationName: string, day: number) => {
    const files = e.target.files;
    if (files && onAddPhoto) {
      Array.from(files).forEach(file => {
        const reader = new FileReader();
        reader.onloadend = () => {
          const photo: Photo = {
            id: Math.random().toString(36).substr(2, 9),
            url: reader.result as string,
            locationName,
            day
          };
          onAddPhoto(photo);
        };
        reader.readAsDataURL(file);
      });
    }
  };

  const handleReset = () => {
    if (confirm(t.clearConfirm)) {
      if (onClear) {
        onClear();
      }
      setHotelInput(DEFAULT_HOTEL);
      setAttractionsInput(DEFAULT_ATTRACTIONS);
      setDaysInput(DEFAULT_DAYS);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    localStorage.setItem('sg_planner_hotel', hotelInput);
    localStorage.setItem('sg_planner_attractions', attractionsInput);
    localStorage.setItem('sg_planner_days', String(daysInput));
    onGenerate(hotelInput, attractionsInput, daysInput);
    setShowForm(false);
  };

  const activeDayPlan = itinerary?.days.find(d => d.day === activeDay);

  return (
    <div className={`h-full bg-editorial-bg flex flex-col ${mobile ? '' : 'border-r border-editorial-border'} relative z-10 font-serif`}>
      <div className={`${mobile ? 'p-4' : 'p-8'} border-b border-editorial-border bg-editorial-bg/80 backdrop-blur-md sticky top-0 z-20`}>
        <div className="flex flex-col gap-1 mb-2">
          <div className="flex justify-between items-start">
            <h1 className={`${mobile ? 'text-3xl' : 'text-5xl'} tracking-tighter leading-none text-editorial-text`}>
              {t.title} <span className="italic font-normal">{t.titleItalic}</span>
            </h1>
            <div className="flex gap-4 items-center">
              {itinerary && !showForm && (
                <button 
                  onClick={() => setShowForm(true)}
                  className="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-400 hover:text-editorial-accent"
                  title="Modify Inputs"
                >
                  <Sparkles className="w-4 h-4" />
                </button>
              )}
              {!itinerary && (
                <button 
                  onClick={handleReset}
                  className="text-[9px] font-sans font-bold text-gray-300 hover:text-editorial-accent uppercase tracking-widest mt-2"
                >
                  {t.clear}
                </button>
              )}
            </div>
          </div>
          <p className="font-sans text-[10px] uppercase tracking-[0.3em] text-editorial-text/40 font-bold">
            A Smart Travel Circuit — {new Date().getFullYear()}
          </p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar">
        <AnimatePresence mode="wait">
          {showForm || !itinerary ? (
            <motion.div
              key="form"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className={`${mobile ? 'p-4 space-y-6' : 'p-8 space-y-10'}`}
            >
              <div className="space-y-8">
                <div>
                  <label className="flex items-center gap-2 text-[10px] font-bold text-editorial-accent uppercase tracking-widest mb-3">
                    <Hotel className="w-3 h-3" />
                    {t.hotelLabel}
                  </label>
                  <input
                    type="text"
                    placeholder={t.hotelPlaceholder}
                    className="w-full px-0 py-3 bg-transparent border-b border-editorial-border focus:border-editorial-accent outline-none transition-all placeholder:text-gray-300 font-sans text-lg tracking-tight"
                    value={hotelInput}
                    onChange={(e) => setHotelInput(e.target.value)}
                  />
                </div>

                <div>
                  <label className="flex items-center gap-2 text-[10px] font-bold text-editorial-accent uppercase tracking-widest mb-3">
                    <MapPin className="w-3 h-3" />
                    {t.attractionsLabel}
                  </label>
                  <textarea
                    placeholder={t.attractionsPlaceholder}
                    className="w-full px-0 py-3 bg-transparent border-b border-editorial-border focus:border-editorial-accent outline-none transition-all placeholder:text-gray-300 font-sans text-lg tracking-tight min-h-[100px] resize-none"
                    value={attractionsInput}
                    onChange={(e) => setAttractionsInput(e.target.value)}
                  />
                </div>

                <div>
                  <label className="flex items-center gap-2 text-[10px] font-bold text-editorial-accent uppercase tracking-widest mb-3">
                    <Calendar className="w-3 h-3" />
                    {t.daysLabel}
                  </label>
                  <div className="flex items-center gap-2">
                    {[1, 2, 3, 4, 5].map(d => (
                      <button
                        key={d}
                        onClick={() => setDaysInput(d)}
                        className={`w-10 h-10 rounded-full font-sans font-bold transition-all border ${
                          daysInput === d 
                            ? 'bg-editorial-accent text-white border-editorial-accent shadow-lg shadow-red-100' 
                            : 'bg-white text-editorial-text border-editorial-border hover:border-editorial-accent'
                        }`}
                      >
                        {d}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <button
                onClick={handleSubmit}
                disabled={loading || !hotelInput || !attractionsInput}
                className="w-full bg-editorial-text text-white py-5 rounded-sm font-sans text-xs uppercase tracking-widest font-bold flex items-center justify-center gap-3 hover:bg-black transition-all disabled:opacity-30 active:scale-[0.98]"
              >
                {loading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    {t.generateBtn}
                  </>
                )}
              </button>

              {itinerary && (
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="w-full py-4 border border-editorial-border text-editorial-text font-sans text-xs font-black uppercase tracking-[0.3em] hover:bg-gray-50 transition-all flex items-center justify-center gap-3 mt-4"
                >
                  {t.viewCurrentPlan}
                </button>
              )}
            </motion.div>
          ) : (
            <motion.div
              key="itinerary"
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              className="px-0 py-6"
            >
              <div className="px-8 flex items-center justify-between mb-10">
                <button 
                  onClick={() => setShowForm(true)}
                  className="text-[10px] font-bold text-editorial-accent italic hover:underline uppercase tracking-widest transition-colors font-sans"
                >
                  {t.editPlan}
                </button>
                <div className="flex items-center gap-2">
                  {itinerary.days.map(d => (
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

              {activeDayPlan && (
                <div className="space-y-10">
                  <div className="px-8 border-l-4 border-editorial-accent">
                    <div className="font-sans text-[10px] uppercase tracking-[0.2em] text-editorial-accent font-bold mb-1 italic">
                      Day 0{activeDayPlan.day} — {activeDayPlan.title}
                    </div>
                    <h2 className="text-4xl tracking-tighter leading-none mb-4">{t.dailyNarrative}</h2>
                    {activeDayPlan.luggageTip && (
                      <div className="bg-editorial-accent/5 p-4 rounded-sm border border-editorial-accent/10 flex items-start gap-3">
                        <Briefcase className="w-4 h-4 text-editorial-accent shrink-0 mt-0.5" />
                        <p className="font-sans text-xs font-semibold text-editorial-accent italic leading-relaxed">
                          {activeDayPlan.luggageTip}
                        </p>
                      </div>
                    )}
                  </div>

                  <div className="relative">
                    <div className="absolute left-[39px] top-6 bottom-6 w-px border-l border-editorial-border border-dashed" />
                    
                    <div className="space-y-10 px-8">
                       <div className="flex gap-6 relative group">
                        <div className="w-6 h-6 rounded-full bg-editorial-text border border-editorial-text flex items-center justify-center z-10 shrink-0 mt-1">
                           <Hotel className="w-3 h-3 text-white" />
                        </div>
                        <div className="flex-1 pb-4 border-b border-editorial-border">
                          <h4 className="text-xl tracking-tight leading-tight mb-1">{activeDayPlan.hotel?.name || t.searchingBase}</h4>
                          <p className="font-sans text-[10px] font-bold text-editorial-text opacity-40 uppercase tracking-widest">{t.baseOfOperations}</p>
                        </div>
                      </div>

                      {activeDayPlan.locations.map((loc, idx) => (
                        <div key={idx} className="flex gap-6 relative group">
                          <div className="w-6 h-6 rounded-full bg-white border border-editorial-text flex items-center justify-center z-10 shrink-0 mt-1 shadow-sm transition-all group-hover:bg-editorial-accent group-hover:border-editorial-accent group-hover:scale-110">
                            <span className="text-editorial-text group-hover:text-white text-[10px] font-sans font-black">{idx + 1}</span>
                          </div>
                          <div className="flex-1 pb-4 border-b border-editorial-border group-last:border-0">
                            <div className="flex items-start gap-3 justify-between mb-2">
                              <h4 className="text-xl tracking-tight leading-[1.1]">{loc.name}</h4>
                              <span className="font-sans text-[10px] font-bold uppercase tracking-widest text-editorial-accent italic whitespace-nowrap">
                                {loc.time || t.scheduled}
                              </span>
                            </div>
                            
                            <p className="font-sans text-sm text-gray-400 leading-relaxed italic pr-4 mb-4">
                              {loc.description || t.defaultDescription}
                            </p>

                            <div className="flex flex-wrap gap-x-6 gap-y-3">
                              {loc.transport && (
                                <div className="flex items-center gap-2 font-sans text-xs font-bold text-editorial-text/60">
                                  <Train className="w-3.5 h-3.5 text-editorial-accent" />
                                  <span>{loc.transport}</span>
                                </div>
                              )}
                              {loc.activity && (
                                <div className="flex items-center gap-2 font-sans text-xs font-bold text-editorial-text/60">
                                  <Footprints className="w-3.5 h-3.5 text-editorial-accent" />
                                  <span>{loc.activity}</span>
                                </div>
                              )}
                              {loc.food && (
                                <div className="flex items-center gap-2 font-sans text-xs font-bold text-editorial-text/60">
                                  <Utensils className="w-3.5 h-3.5 text-editorial-accent" />
                                  <span>{t.foodRecommend}{loc.food}</span>
                                </div>
                              )}
                              <label className="flex items-center gap-2 font-sans text-xs font-bold text-editorial-accent cursor-pointer hover:opacity-80 transition-opacity">
                                <Camera className="w-3.5 h-3.5" />
                                <span>{t.uploadPhoto}</span>
                                <input 
                                  type="file" 
                                  accept="image/*" 
                                  multiple
                                  className="hidden" 
                                  onChange={(e) => handleFileUpload(e, loc.name, activeDay)}
                                />
                              </label>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {!itinerary && !loading && (
        <div className="p-8 border-t border-editorial-border">
          <div className="font-sans text-[9px] uppercase tracking-[0.4em] text-editorial-text/30 leading-loose text-center whitespace-pre-line">
            {t.footer}
          </div>
        </div>
      )}
    </div>
  );
}

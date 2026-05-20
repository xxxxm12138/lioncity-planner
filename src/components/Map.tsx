/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { APIProvider, Map, AdvancedMarker, InfoWindow, useMap, useMapsLibrary } from '@vis.gl/react-google-maps';
import { Hotel, Star, ShoppingBag, Utensils, AlertCircle, X, Loader2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Location, Itinerary } from '../types';
import { Translations } from '../lib/i18n';

const API_KEY = process.env.GOOGLE_MAPS_PLATFORM_KEY || '';

interface MapProps {
  itinerary: Itinerary | null;
  activeDay: number;
  t: Translations;
}

const PlannerMap = ({ itinerary, activeDay, t }: MapProps) => {
  const map = useMap();
  const placesLib = useMapsLibrary('places');
  const [selectedLocation, setSelectedLocation] = useState<Location | null>(null);
  const [nearbyRestaurants, setNearbyRestaurants] = useState<google.maps.places.PlaceResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [placesError, setPlacesError] = useState<string | null>(null);

  const currentDay = itinerary?.days.find(d => d.day === activeDay);
  const currentLocations = currentDay?.locations || [];
  const hotel = currentDay?.hotel;
  
  const pathLocations = hotel ? [hotel, ...currentLocations] : currentLocations;

  useEffect(() => {
    if (!placesLib || !map || !selectedLocation) {
      setNearbyRestaurants([]);
      setPlacesError(null);
      return;
    }

    setSearching(true);
    const service = new google.maps.places.PlacesService(map);
    const request: google.maps.places.PlaceSearchRequest = {
      location: { lat: selectedLocation.lat, lng: selectedLocation.lng },
      radius: 3000,
      type: 'restaurant'
    };

    service.nearbySearch(request, (results, status) => {
      if (status === google.maps.places.PlacesServiceStatus.OK && results) {
        const topRated = results
          .filter(r => (r.rating || 0) >= 4.0)
          .sort((a, b) => (b.rating || 0) - (a.rating || 0))
          .slice(0, 4);
        setNearbyRestaurants(topRated);
        setPlacesError(null);
      } else {
        setNearbyRestaurants([]);
        if (status === 'REQUEST_DENIED') {
          setPlacesError(t.apiPermissionError);
        } else {
          setPlacesError(null);
        }
      }
      setSearching(false);
    });
  }, [placesLib, map, selectedLocation]);

  useEffect(() => {
    if (!map || pathLocations.length < 1) return;

    const bounds = new google.maps.LatLngBounds();
    pathLocations.forEach(loc => bounds.extend({ lat: loc.lat, lng: loc.lng }));
    map.fitBounds(bounds, 80);
  }, [map, itinerary, activeDay]);

  return (
    <>
      {hotel && (
        <AdvancedMarker 
          position={{ lat: hotel.lat, lng: hotel.lng }} 
          title={hotel.name}
          onClick={() => setSelectedLocation(hotel)}
        >
          <div className="bg-editorial-text text-white p-1.5 rounded-full shadow-xl border-2 border-white ring-4 ring-editorial-text/10 cursor-pointer">
            <Hotel className="w-4 h-4" />
          </div>
        </AdvancedMarker>
      )}

      {currentLocations.map((loc, idx) => (
        <AdvancedMarker 
          key={`${loc.name}-${idx}`} 
          position={{ lat: loc.lat, lng: loc.lng }} 
          title={loc.name}
          onClick={() => setSelectedLocation(loc)}
        >
          <div className="bg-editorial-accent text-white rounded-full w-7 h-7 flex items-center justify-center font-sans font-black text-[10px] shadow-lg border-2 border-white ring-4 ring-editorial-accent/10 transition-all hover:scale-125 cursor-pointer">
            {idx + 1}
          </div>
        </AdvancedMarker>
      ))}

      {selectedLocation && (
        <InfoWindow
          position={{ lat: selectedLocation.lat, lng: selectedLocation.lng }}
          onCloseClick={() => setSelectedLocation(null)}
          headerDisabled
        >
          <div className="max-w-[280px] p-2 font-serif text-editorial-text">
            <div className="flex items-start justify-between mb-3">
              <h3 className="text-xl tracking-tight leading-tight pr-2">{selectedLocation.name}</h3>
              <button 
                onClick={() => setSelectedLocation(null)}
                className="p-1 hover:bg-gray-100 rounded-full transition-colors"
              >
                <X className="w-4 h-4 text-gray-400" />
              </button>
            </div>
            
            <p className="font-sans text-xs text-gray-500 italic mb-4 leading-relaxed">
              {selectedLocation.description}
            </p>

            <div className="space-y-4 pt-4 border-t border-editorial-border">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-[10px] uppercase font-black tracking-widest text-[#000]">
                    <Utensils className="w-3 h-3" />
                    {t.nearbyFood}
                  </div>
                  {searching && <Loader2 className="w-3 h-3 animate-spin text-gray-300" />}
                </div>
                
                <div className="space-y-2">
                  {nearbyRestaurants.length > 0 ? (
                    nearbyRestaurants.map((place, i) => (
                      <a 
                        key={i} 
                        href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(place.name || '')}&query_place_id=${place.place_id}`}
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="flex items-start justify-between gap-2 group cursor-pointer hover:bg-gray-50 p-1 -m-1 rounded-sm transition-colors"
                      >
                        <div className="flex-1">
                          <div className="font-sans text-[11px] font-bold leading-tight group-hover:text-editorial-accent transition-colors">
                            {place.name}
                          </div>
                          <div className="flex items-center gap-1 mt-0.5">
                            <span className="text-[9px] font-bold text-orange-500">{place.rating}</span>
                            <div className="flex gap-0.5">
                              {[...Array(5)].map((_, j) => (
                                <Star 
                                  key={j} 
                                  className={`w-2 h-2 ${j < Math.floor(place.rating || 0) ? 'fill-orange-500 text-orange-500' : 'text-gray-200'}`} 
                                />
                              ))}
                            </div>
                            <span className="text-[9px] text-gray-400 font-medium">({place.user_ratings_total})</span>
                          </div>
                        </div>
                        <div className="text-[9px] font-bold text-gray-300 whitespace-nowrap pt-0.5">
                          {place.price_level ? '$'.repeat(place.price_level) : ''}
                        </div>
                      </a>
                    ))
                  ) : placesError ? (
                    <div className="bg-red-50 p-3 rounded-sm text-center border border-red-100">
                      <p className="font-sans text-[10px] text-red-500 font-bold italic">{placesError}</p>
                    </div>
                  ) : !searching ? (
                    <div className="bg-gray-50 p-3 rounded-sm text-center">
                      <p className="font-sans text-[10px] text-gray-400 font-medium italic">{t.noRecommend}</p>
                    </div>
                  ) : null}
                </div>
              </div>

              {selectedLocation.funPoints && (
                <div className="space-y-1">
                  <div className="flex items-center gap-1.5 text-[10px] uppercase font-black tracking-widest text-editorial-accent">
                    <Star className="w-3 h-3 fill-current" />
                    {t.funPoints}
                  </div>
                  <p className="font-sans text-[11px] leading-relaxed font-medium">{selectedLocation.funPoints}</p>
                </div>
              )}

              {selectedLocation.food && (
                <div className="space-y-1">
                  <div className="flex items-center gap-1.5 text-[10px] uppercase font-black tracking-widest text-editorial-accent">
                    <Utensils className="w-3 h-3" />
                    {t.foodLabel}
                  </div>
                  <p className="font-sans text-[11px] leading-relaxed font-medium">{selectedLocation.food}</p>
                </div>
              )}

              {selectedLocation.souvenirs && (
                <div className="space-y-1">
                  <div className="flex items-center gap-1.5 text-[10px] uppercase font-black tracking-widest text-editorial-accent">
                    <ShoppingBag className="w-3 h-3" />
                    {t.souvenirsLabel}
                  </div>
                  <p className="font-sans text-[11px] leading-relaxed font-medium">{selectedLocation.souvenirs}</p>
                </div>
              )}

              {selectedLocation.tips && (
                <div className="space-y-1">
                  <div className="flex items-center gap-1.5 text-[10px] uppercase font-black tracking-widest text-emerald-600">
                    <AlertCircle className="w-3 h-3" />
                    {t.tipsLabel}
                  </div>
                  <p className="font-sans text-[11px] leading-relaxed font-medium text-emerald-700">{selectedLocation.tips}</p>
                </div>
              )}
            </div>
          </div>
        </InfoWindow>
      )}
    </>
  );
};

export default function AppMap({ itinerary, activeDay, t }: MapProps) {
  const hasValidKey = Boolean(API_KEY) && API_KEY !== 'YOUR_API_KEY';

  if (!hasValidKey) {
    return (
      <div className="flex items-center justify-center h-full bg-editorial-bg p-6 font-serif">
        <div className="max-w-md w-full bg-white rounded-sm shadow-sm p-10 border border-editorial-border text-center">
          <h2 className="text-3xl tracking-tighter text-editorial-text mb-4">{t.apiKeyRequired}</h2>
          <p className="font-sans text-sm text-gray-500 mb-8 italic">
            {t.apiKeyDesc}
          </p>
          <div className="text-left space-y-4 mb-8 bg-editorial-bg p-6 border border-editorial-border font-sans">
            <p className="text-[10px] uppercase tracking-widest font-bold text-editorial-accent">{t.setupRegistry}</p>
            <ol className="list-decimal list-inside space-y-2 text-[11px] text-gray-600 font-medium">
              <li>{t.step1}</li>
              <li>{t.step2}</li>
              <li>{t.step3}</li>
              <li>{t.step4}</li>
            </ol>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-full relative">
      <APIProvider apiKey={API_KEY} version="weekly">
        <Map
          defaultCenter={{ lat: 1.3521, lng: 103.8198 }} 
          defaultZoom={12}
          mapId="DEMO_MAP_ID"
          className="w-full h-full grayscale-[0.2] contrast-[1.1]"
          internalUsageAttributionIds={['gmp_mcp_codeassist_v1_aistudio']}
          disableDefaultUI={true}
          zoomControl={true}
        >
          <PlannerMap itinerary={itinerary} activeDay={activeDay} t={t} />
        </Map>
      </APIProvider>
    </div>
  );
}

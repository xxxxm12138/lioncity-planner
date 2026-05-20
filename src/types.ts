/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface Location {
  name: string;
  lat: number;
  lng: number;
  description?: string;
  time?: string;
  activity?: string; // Main activity at this spot
  food?: string; // Recommended food nearby
  transport?: string; // Mode of transport to reach here
  tips?: string; // Travel caveats or notes
  funPoints?: string; // Must-see/do specifics
  souvenirs?: string; // Local specialties/gifts
}

export interface Photo {
  id: string;
  url: string; // Base64 or Blob URL
  locationName: string;
  day: number;
}

/** How this group should be published on social (WeChat Moments, etc.) */
export type PostFormat = 'grid' | 'poster' | 'mono' | 'text_card' | 'single_hero';

export interface CuratedPost {
  id: string;
  title: string;
  scene: string;
  mood: string;
  storylineOrder: number;
  format: PostFormat;
  caption: string;
  hashtags: string[];
  photoIds: string[];
  layoutHint?: string;
}

export interface PhotoCurationResult {
  day: number;
  summary: string;
  posts: CuratedPost[];
  unusedPhotoIds?: string[];
}

export interface DayPlan {
  day: number;
  title: string;
  locations: Location[];
  hotel?: Location;
  luggageTip?: string; // Tip for luggage handling on this day
  photos?: Photo[];
}

export interface Itinerary {
  days: DayPlan[];
  narrative?: {
    foreword: string;
    epilogue: string;
    vibe: string;
  };
}

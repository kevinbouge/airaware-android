import type { RiskCategoryId } from '../models/environment';

export const SCORE_THRESHOLDS: { max: number; category: RiskCategoryId }[] = [
  { max: 25, category: 'low' },
  { max: 50, category: 'moderate' },
  { max: 75, category: 'high' },
  { max: 100, category: 'veryHigh' },
];

export const ENVIRONMENTAL_WEIGHTS = {
  pollen: 0.5,
  regulatedPollution: 0.25,
  atmosphericIrritants: 0.1,
  mold: 0.15,
} as const;

export const PERSONALIZED_WEIGHTS = {
  pollen: 0.5,
  regulatedPollution: 0.25,
  atmosphericIrritants: 0.1,
  mold: 0.15,
  uv: 0.1,
} as const;

export const ATMOSPHERIC_IRRITANT_WEIGHTS = {
  carbonMonoxide: 0.35,
  aerosolOpticalDepth: 0.3,
  dust: 0.2,
  wildfirePm10: 0.15,
} as const;

export const MOLD_WEIGHTS = {
  relativeHumidity: 0.3,
  leafWetness: 0.25,
  precipitation: 0.2,
  temperature: 0.15,
  wind: 0.1,
} as const;

export const POLLEN_THRESHOLDS = {
  alder: [
    { value: 10, score: 25 },
    { value: 50, score: 50 },
    { value: 250, score: 75 },
    { value: 500, score: 100 },
  ],
  birch: [
    { value: 10, score: 25 },
    { value: 50, score: 50 },
    { value: 250, score: 75 },
    { value: 500, score: 100 },
  ],
  grass: [
    { value: 5, score: 25 },
    { value: 20, score: 50 },
    { value: 100, score: 75 },
    { value: 250, score: 100 },
  ],
  mugwort: [
    { value: 5, score: 25 },
    { value: 20, score: 50 },
    { value: 100, score: 75 },
    { value: 250, score: 100 },
  ],
  olive: [
    { value: 10, score: 25 },
    { value: 50, score: 50 },
    { value: 250, score: 75 },
    { value: 500, score: 100 },
  ],
  ragweed: [
    { value: 5, score: 25 },
    { value: 20, score: 50 },
    { value: 100, score: 75 },
    { value: 250, score: 100 },
  ],
} as const;

export const RAW_POLLUTANT_THRESHOLDS = {
  pm25: [
    { value: 5, score: 20 },
    { value: 15, score: 50 },
    { value: 35, score: 75 },
    { value: 75, score: 100 },
  ],
  pm10: [
    { value: 15, score: 20 },
    { value: 45, score: 50 },
    { value: 100, score: 75 },
    { value: 200, score: 100 },
  ],
  nitrogenDioxide: [
    { value: 25, score: 20 },
    { value: 100, score: 50 },
    { value: 200, score: 75 },
    { value: 400, score: 100 },
  ],
  ozone: [
    { value: 60, score: 20 },
    { value: 120, score: 50 },
    { value: 180, score: 75 },
    { value: 240, score: 100 },
  ],
  sulphurDioxide: [
    { value: 40, score: 20 },
    { value: 125, score: 50 },
    { value: 350, score: 75 },
    { value: 500, score: 100 },
  ],
  carbonMonoxide: [
    { value: 250, score: 20 },
    { value: 1000, score: 50 },
    { value: 3000, score: 75 },
    { value: 6000, score: 100 },
  ],
  aerosolOpticalDepth: [
    { value: 0.1, score: 20 },
    { value: 0.3, score: 50 },
    { value: 0.7, score: 75 },
    { value: 1.2, score: 100 },
  ],
  dust: [
    { value: 20, score: 20 },
    { value: 80, score: 50 },
    { value: 200, score: 75 },
    { value: 400, score: 100 },
  ],
  wildfirePm10: [
    { value: 5, score: 20 },
    { value: 20, score: 50 },
    { value: 50, score: 75 },
    { value: 100, score: 100 },
  ],
} as const;

export const CACHE_SCHEMA_VERSION = 1;
export const ENVIRONMENT_PROVIDER_FRESHNESS_MS = 30 * 60 * 1000;
export const VEGETATION_CACHE_SCHEMA_VERSION = 1;
export const VEGETATION_CACHE_STALE_AFTER_MS = 14 * 24 * 60 * 60 * 1000;
export const NEARBY_VEGETATION_RADIUS_METERS = 2000;
export const DATA_DETAIL_CACHE_SCHEMA_VERSION = 1;
export const DATA_DETAIL_CACHE_STALE_AFTER_MS = 6 * 60 * 60 * 1000;
export const REQUEST_TIMEOUT_MS = 15000;
export const OUTDOOR_WINDOW_MIN_COMPLETENESS = 0.5;
export const LOCATION_CACHE_MATCH_RADIUS_METERS = 1000;

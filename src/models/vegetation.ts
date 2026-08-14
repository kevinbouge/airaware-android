import type { Coordinates } from './environment';

export type VegetationCategoryId =
  'woodland' | 'grassland' | 'meadow' | 'orchard' | 'scrub' | 'parkland' | 'farmland';

export type VegetationTaxonId = 'birch' | 'alder' | 'olive';

export interface VegetationFeatureSummary {
  present: boolean;
  featureCount: number;
  nearestMeters: number | null;
}

export interface VegetationTaxonSummary {
  featureCount: number;
  nearestMeters: number | null;
}

export interface NormalizedVegetationContext {
  provider: 'openstreetmap';
  coordinates: Coordinates;
  radiusMeters: 2000;
  fetchedAt: string;
  categories: Record<VegetationCategoryId, VegetationFeatureSummary>;
  mappedTaxa: Record<VegetationTaxonId, VegetationTaxonSummary>;
  attribution: 'OpenStreetMap contributors';
  completeness: 'unknown';
}

export interface CachedVegetationContext {
  metadata: {
    version: number;
    savedAt: string;
    cacheKey: string;
  };
  data: NormalizedVegetationContext;
}

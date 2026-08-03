import {
  VEGETATION_CACHE_SCHEMA_VERSION,
  VEGETATION_CACHE_STALE_AFTER_MS,
} from '../core/constants';
import type { Coordinates } from '../models/environment';
import type { CachedVegetationContext, NormalizedVegetationContext } from '../models/vegetation';

function roundedCoordinate(value: number): string {
  return value.toFixed(2);
}

export function vegetationCacheKey(coordinates: Coordinates, radiusMeters: number): string {
  return [
    VEGETATION_CACHE_SCHEMA_VERSION,
    roundedCoordinate(coordinates.latitude),
    roundedCoordinate(coordinates.longitude),
    radiusMeters,
  ].join(':');
}

export function vegetationCacheEnvelope(
  data: NormalizedVegetationContext,
): CachedVegetationContext {
  return {
    metadata: {
      version: VEGETATION_CACHE_SCHEMA_VERSION,
      savedAt: new Date().toISOString(),
      cacheKey: vegetationCacheKey(data.coordinates, data.radiusMeters),
    },
    data,
  };
}

function vegetationCacheMatches(
  cache: CachedVegetationContext | null,
  coordinates: Coordinates,
  radiusMeters: number,
): boolean {
  if (!cache || cache.metadata.version !== VEGETATION_CACHE_SCHEMA_VERSION) return false;
  return cache.metadata.cacheKey === vegetationCacheKey(coordinates, radiusMeters);
}

export function vegetationCacheExpired(cache: CachedVegetationContext, now = new Date()): boolean {
  const savedAt = Date.parse(cache.metadata.savedAt);
  if (!Number.isFinite(savedAt)) return true;

  return now.getTime() - savedAt > VEGETATION_CACHE_STALE_AFTER_MS;
}

export function vegetationCacheForRequest(
  cache: CachedVegetationContext | null,
  coordinates: Coordinates,
  radiusMeters: number,
): CachedVegetationContext | null {
  return vegetationCacheMatches(cache, coordinates, radiusMeters) ? cache : null;
}

import {
  NEARBY_VEGETATION_RADIUS_METERS,
  VEGETATION_CACHE_SCHEMA_VERSION,
  VEGETATION_CACHE_STALE_AFTER_MS,
} from '../core/constants';
import type { Coordinates } from '../models/environment';
import type { CachedVegetationContext, NormalizedVegetationContext } from '../models/vegetation';
import { millisecondsBetween } from '../utils/time';

function roundedCoordinate(value: number): string {
  return value.toFixed(5);
}

export function vegetationCacheKey(coordinates: Coordinates): string {
  return [
    VEGETATION_CACHE_SCHEMA_VERSION,
    roundedCoordinate(coordinates.latitude),
    roundedCoordinate(coordinates.longitude),
    NEARBY_VEGETATION_RADIUS_METERS,
  ].join(':');
}

export function vegetationCacheEnvelope(
  data: NormalizedVegetationContext,
): CachedVegetationContext {
  return {
    metadata: {
      version: VEGETATION_CACHE_SCHEMA_VERSION,
      savedAt: new Date().toISOString(),
      cacheKey: vegetationCacheKey(data.coordinates),
    },
    data,
  };
}

function vegetationCacheMatches(
  cache: CachedVegetationContext | null,
  coordinates: Coordinates,
): boolean {
  if (!cache || cache.metadata.version !== VEGETATION_CACHE_SCHEMA_VERSION) return false;
  if (cache.data.radiusMeters !== NEARBY_VEGETATION_RADIUS_METERS) return false;
  return cache.metadata.cacheKey === vegetationCacheKey(coordinates);
}

export function vegetationCacheExpired(cache: CachedVegetationContext, now = new Date()): boolean {
  const savedAt = Date.parse(cache.metadata.savedAt);
  if (!Number.isFinite(savedAt)) return true;

  return millisecondsBetween(now, savedAt) > VEGETATION_CACHE_STALE_AFTER_MS;
}

export function vegetationCacheForRequest(
  caches: readonly CachedVegetationContext[],
  coordinates: Coordinates,
): CachedVegetationContext | null {
  return caches.find((cache) => vegetationCacheMatches(cache, coordinates)) ?? null;
}

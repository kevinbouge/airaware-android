import { LOCATION_CACHE_MATCH_RADIUS_METERS } from '../core/constants';
import type { Coordinates, NormalizedEnvironment } from '../models/environment';
import { coordinatesWithin } from '../utils/geo';

export function cacheForCoordinates(
  environment: NormalizedEnvironment | null,
  coordinates: Coordinates | null,
): NormalizedEnvironment | null {
  if (!environment || !coordinates) return null;

  return coordinatesWithin(environment.coordinates, coordinates, LOCATION_CACHE_MATCH_RADIUS_METERS)
    ? environment
    : null;
}

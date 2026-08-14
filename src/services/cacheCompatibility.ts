import { LOCATION_CACHE_MATCH_RADIUS_METERS } from '../core/constants';
import type { ActivityDomainId } from '../models/activities';
import type { Coordinates, NormalizedEnvironment } from '../models/environment';
import { coordinatesWithin } from '../utils/geo';

function cacheHasActivityDomains(
  environment: NormalizedEnvironment,
  requiredActivityDomains: readonly ActivityDomainId[],
): boolean {
  if (requiredActivityDomains.length === 0) return true;

  const cachedDomains = new Set(environment.metadata.requestedActivityDomains ?? []);
  return requiredActivityDomains.every((domainId) => cachedDomains.has(domainId));
}

export function cacheForCoordinates(
  environment: NormalizedEnvironment | null,
  coordinates: Coordinates | null,
): NormalizedEnvironment | null {
  if (!environment || !coordinates) return null;

  if (
    !coordinatesWithin(environment.coordinates, coordinates, LOCATION_CACHE_MATCH_RADIUS_METERS)
  ) {
    return null;
  }

  return environment;
}

export function cacheForActivityDomains(
  environment: NormalizedEnvironment | null,
  coordinates: Coordinates | null,
  requiredActivityDomains: readonly ActivityDomainId[],
): NormalizedEnvironment | null {
  const matchingEnvironment = cacheForCoordinates(environment, coordinates);
  if (!matchingEnvironment) return null;

  return cacheHasActivityDomains(matchingEnvironment, requiredActivityDomains)
    ? matchingEnvironment
    : null;
}

import { LOCATION_CACHE_MATCH_RADIUS_METERS } from '../core/constants';
import { airQualityVariableCoverageFor } from '../api/openMeteoAirQuality';
import { weatherVariableCoverageFor } from '../api/openMeteoWeather';
import type { ActivityDomainId } from '../models/activities';
import type { Coordinates, NormalizedEnvironment } from '../models/environment';
import { coordinatesWithin } from '../utils/geo';

function cacheHasRequiredVariables(
  environment: NormalizedEnvironment,
  requiredActivityDomains: readonly ActivityDomainId[],
): boolean {
  const requiredWeatherVariables = weatherVariableCoverageFor(requiredActivityDomains);
  const requiredAirQualityVariables = airQualityVariableCoverageFor(requiredActivityDomains);
  if (requiredWeatherVariables.length === 0 && requiredAirQualityVariables.length === 0) {
    return true;
  }

  const cachedWeatherVariables = new Set(environment.metadata.requestedWeatherVariables ?? []);
  const cachedAirQualityVariables = new Set(
    environment.metadata.requestedAirQualityVariables ?? [],
  );

  return (
    requiredWeatherVariables.every((variable) => cachedWeatherVariables.has(variable)) &&
    requiredAirQualityVariables.every((variable) => cachedAirQualityVariables.has(variable))
  );
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

  return cacheHasRequiredVariables(matchingEnvironment, requiredActivityDomains)
    ? matchingEnvironment
    : null;
}

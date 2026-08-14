import { differenceInMilliseconds } from 'date-fns';
import { forecastDayLimit } from '../capabilities/forecast';
import {
  ENVIRONMENT_PROVIDER_FRESHNESS_MS,
  LOCATION_CACHE_MATCH_RADIUS_METERS,
} from '../core/constants';
import { airQualityVariableCoverageFor } from '../api/openMeteoAirQuality';
import { weatherVariableCoverageFor } from '../api/openMeteoWeather';
import type { AppCapabilities } from '../capabilities/types';
import type { ActivityDomainId } from '../models/activities';
import type { Coordinates, NormalizedEnvironment } from '../models/environment';
import { coordinatesWithin } from '../utils/geo';

type EnvironmentalProviderKind = 'airQuality' | 'weather';

export interface EnvironmentRefreshPolicyInput {
  environment: NormalizedEnvironment | null;
  coordinates: Coordinates | null;
  capabilities: AppCapabilities;
  requiredActivityDomains: readonly ActivityDomainId[];
  force?: boolean | undefined;
  now?: Date | undefined;
}

export interface EnvironmentRefreshPolicyResult {
  usableCache: NormalizedEnvironment | null;
  fetchAirQuality: boolean;
  fetchWeather: boolean;
  needsRefresh: boolean;
}

function providerFetchedAt(
  environment: NormalizedEnvironment,
  provider: EnvironmentalProviderKind,
): string | null {
  return provider === 'airQuality'
    ? environment.metadata.airQualityFetchedAt
    : environment.metadata.weatherFetchedAt;
}

function providerDataIsFresh(
  environment: NormalizedEnvironment,
  provider: EnvironmentalProviderKind,
  now: Date,
): boolean {
  const fetchedAt = providerFetchedAt(environment, provider);
  if (!fetchedAt) return false;

  const fetchedTime = Date.parse(fetchedAt);
  if (!Number.isFinite(fetchedTime)) return false;

  return differenceInMilliseconds(now, new Date(fetchedTime)) <= ENVIRONMENT_PROVIDER_FRESHNESS_MS;
}

function providerRequiredVariables(
  requiredActivityDomains: readonly ActivityDomainId[],
  provider: EnvironmentalProviderKind,
): string[] {
  return provider === 'airQuality'
    ? airQualityVariableCoverageFor(requiredActivityDomains)
    : weatherVariableCoverageFor(requiredActivityDomains);
}

function providerHasRequiredCoverage(
  environment: NormalizedEnvironment,
  provider: EnvironmentalProviderKind,
  requiredActivityDomains: readonly ActivityDomainId[],
): boolean {
  const requiredVariables = providerRequiredVariables(requiredActivityDomains, provider);
  if (requiredVariables.length === 0) return true;

  const cachedVariables = new Set(
    provider === 'airQuality'
      ? (environment.metadata.requestedAirQualityVariables ?? [])
      : (environment.metadata.requestedWeatherVariables ?? []),
  );
  return requiredVariables.every((variable) => cachedVariables.has(variable));
}

function forecastCoverageIsComplete(
  environment: NormalizedEnvironment,
  capabilities: AppCapabilities,
): boolean {
  return environment.forecastDays.length >= forecastDayLimit(capabilities);
}

function providerNeedsRefresh(input: {
  environment: NormalizedEnvironment;
  provider: EnvironmentalProviderKind;
  capabilities: AppCapabilities;
  requiredActivityDomains: readonly ActivityDomainId[];
  force: boolean;
  now: Date;
}): boolean {
  if (input.force) return true;
  if (!forecastCoverageIsComplete(input.environment, input.capabilities)) return true;
  if (!providerDataIsFresh(input.environment, input.provider, input.now)) return true;
  return !providerHasRequiredCoverage(
    input.environment,
    input.provider,
    input.requiredActivityDomains,
  );
}

export function environmentRefreshPolicy(
  input: EnvironmentRefreshPolicyInput,
): EnvironmentRefreshPolicyResult {
  const force = input.force === true;
  const now = input.now ?? new Date();
  const cacheMatchesLocation =
    input.environment !== null &&
    input.coordinates !== null &&
    coordinatesWithin(
      input.environment.coordinates,
      input.coordinates,
      LOCATION_CACHE_MATCH_RADIUS_METERS,
    );
  const usableCache = cacheMatchesLocation ? input.environment : null;

  if (!usableCache) {
    return {
      usableCache: null,
      fetchAirQuality: input.coordinates !== null,
      fetchWeather: input.coordinates !== null,
      needsRefresh: input.coordinates !== null,
    };
  }

  const fetchAirQuality = providerNeedsRefresh({
    environment: usableCache,
    provider: 'airQuality',
    capabilities: input.capabilities,
    requiredActivityDomains: input.requiredActivityDomains,
    force,
    now,
  });
  const fetchWeather = providerNeedsRefresh({
    environment: usableCache,
    provider: 'weather',
    capabilities: input.capabilities,
    requiredActivityDomains: input.requiredActivityDomains,
    force,
    now,
  });

  return {
    usableCache,
    fetchAirQuality,
    fetchWeather,
    needsRefresh: fetchAirQuality || fetchWeather,
  };
}

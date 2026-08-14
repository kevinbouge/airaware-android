import type { EnvironmentalProviderClient } from './environmentProviders';
import { queryClient, providerStaleTimes } from './queryClient';
import { airAwareQueryKeys } from './queryKeys';
import type { ActivityDomainId } from '../models/activities';
import type { Coordinates } from '../models/environment';
import {
  airQualityVariableCoverageFor,
  type NormalizedAirQuality,
} from '../api/openMeteoAirQuality';
import { type NormalizedWeather, weatherVariableCoverageFor } from '../api/openMeteoWeather';
import { fetchVegetationContext } from '../api/openStreetMapVegetation';
import type { NormalizedVegetationContext } from '../models/vegetation';

function clearIfForced(queryKey: readonly unknown[], force?: boolean): void {
  if (force) {
    queryClient.removeQueries({ queryKey, exact: true });
  }
}

export async function fetchAirQualityQuery(input: {
  provider: EnvironmentalProviderClient;
  coordinates: Coordinates;
  enabledActivities: readonly ActivityDomainId[];
  force?: boolean;
}): Promise<NormalizedAirQuality> {
  const variables = airQualityVariableCoverageFor(input.enabledActivities);
  const queryKey = airAwareQueryKeys.airQuality(input.provider.id, input.coordinates, variables);
  clearIfForced(queryKey, input.force);

  return queryClient.fetchQuery({
    queryKey,
    staleTime: providerStaleTimes.airQuality,
    queryFn: () =>
      input.provider.fetchAirQuality(input.coordinates, {
        enabledActivities: input.enabledActivities,
      }),
  });
}

export async function fetchWeatherQuery(input: {
  provider: EnvironmentalProviderClient;
  coordinates: Coordinates;
  enabledActivities: readonly ActivityDomainId[];
  force?: boolean;
}): Promise<NormalizedWeather> {
  const variables = weatherVariableCoverageFor(input.enabledActivities);
  const queryKey = airAwareQueryKeys.weather(input.provider.id, input.coordinates, variables);
  clearIfForced(queryKey, input.force);

  return queryClient.fetchQuery({
    queryKey,
    staleTime: providerStaleTimes.weather,
    queryFn: () =>
      input.provider.fetchWeather(input.coordinates, {
        enabledActivities: input.enabledActivities,
      }),
  });
}

export async function fetchVegetationQuery(input: {
  coordinates: Coordinates;
  force?: boolean;
}): Promise<NormalizedVegetationContext> {
  const queryKey = airAwareQueryKeys.vegetation(input.coordinates);
  clearIfForced(queryKey, input.force);

  return queryClient.fetchQuery({
    queryKey,
    staleTime: providerStaleTimes.vegetation,
    queryFn: () => fetchVegetationContext(input.coordinates),
  });
}

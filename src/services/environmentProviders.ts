import { fetchAirQuality, type NormalizedAirQuality } from '../api/openMeteoAirQuality';
import { fetchWeather, type NormalizedWeather } from '../api/openMeteoWeather';
import type { AppCapabilities, ProviderId } from '../capabilities/types';
import type { ActivityDomainId } from '../models/activities';
import type { Coordinates } from '../models/environment';

interface EnvironmentalProviderRequestOptions {
  enabledActivities?: readonly ActivityDomainId[];
}

export interface EnvironmentalProviderClient {
  id: ProviderId;
  fetchAirQuality: (
    coordinates: Coordinates,
    options?: EnvironmentalProviderRequestOptions,
  ) => Promise<NormalizedAirQuality>;
  fetchWeather: (
    coordinates: Coordinates,
    options?: EnvironmentalProviderRequestOptions,
  ) => Promise<NormalizedWeather>;
}

const OPEN_METEO_PROVIDER: EnvironmentalProviderClient = {
  id: 'open-meteo',
  fetchAirQuality,
  fetchWeather,
};

const PROVIDERS: Record<ProviderId, EnvironmentalProviderClient> = {
  'open-meteo': OPEN_METEO_PROVIDER,
};

export function activeEnvironmentalProvider(
  capabilities: AppCapabilities,
): EnvironmentalProviderClient {
  const provider = PROVIDERS[capabilities.providers.defaultProvider];

  if (!provider || !capabilities.providers.availableProviders.includes(provider.id)) {
    throw new Error('Configured environmental provider is unavailable');
  }

  return provider;
}

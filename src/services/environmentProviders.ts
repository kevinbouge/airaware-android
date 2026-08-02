import { fetchAirQuality, type NormalizedAirQuality } from '../api/openMeteoAirQuality';
import { fetchWeather, type NormalizedWeather } from '../api/openMeteoWeather';
import type { AppCapabilities, ProviderId } from '../capabilities/types';
import type { Coordinates } from '../models/environment';

export interface EnvironmentalProviderClient {
  id: ProviderId;
  fetchAirQuality: (coordinates: Coordinates) => Promise<NormalizedAirQuality>;
  fetchWeather: (coordinates: Coordinates) => Promise<NormalizedWeather>;
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

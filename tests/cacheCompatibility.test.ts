import { calculateMoldPotential } from '../src/core/moldPotential';
import { airQualityVariableCoverageFor } from '../src/api/openMeteoAirQuality';
import { weatherVariableCoverageFor } from '../src/api/openMeteoWeather';
import { cacheForActivityDomains, cacheForCoordinates } from '../src/services/cacheCompatibility';
import type { NormalizedEnvironment } from '../src/models/environment';

function environmentAt(latitude: number, longitude: number): NormalizedEnvironment {
  const weather = {
    temperature: 20,
    relativeHumidity: 60,
    dewPoint: 12,
    precipitation: 0,
    windSpeed: 3,
    windDirection: null,
    windGusts: null,
    visibility: null,
    leafWetnessProbability: 30,
  };

  return {
    provider: 'open-meteo',
    coordinates: { latitude, longitude },
    placeName: 'Cached place',
    fetchedAt: '2026-08-01T12:00:00Z',
    current: {
      timestamp: '2026-08-01T12:00:00Z',
      pollen: { alder: null, birch: null, grass: 10, mugwort: null, olive: null, ragweed: null },
      regulatedPollutants: {
        pm25: null,
        pm10: null,
        nitrogenDioxide: null,
        ozone: null,
        sulphurDioxide: null,
      },
      pollutantAqi: {
        pm25: null,
        pm10: null,
        nitrogenDioxide: null,
        ozone: null,
        sulphurDioxide: null,
      },
      aqiLabel: 'EU AQI',
      atmosphericIrritants: {
        carbonMonoxide: null,
        aerosolOpticalDepth: null,
        dust: null,
        wildfirePm10: null,
      },
      weather,
      moldPotential: calculateMoldPotential(weather),
      uvIndex: null,
    },
    hourly: [],
    forecastDays: [],
    metadata: {
      timezone: 'Europe/Prague',
      airQualityFetchedAt: '2026-08-01T12:00:00Z',
      weatherFetchedAt: '2026-08-01T12:00:00Z',
      airQualitySource: 'fresh',
      weatherSource: 'fresh',
      requestedAirQualityVariables: airQualityVariableCoverageFor([]),
      requestedWeatherVariables: weatherVariableCoverageFor([]),
      partial: false,
    },
  };
}

describe('cache compatibility', () => {
  it('allows nearby cache fallback for the same effective location', () => {
    const cache = environmentAt(50.0755, 14.4378);

    expect(cacheForCoordinates(cache, { latitude: 50.076, longitude: 14.438 })).toBe(cache);
  });

  it('rejects cache fallback from another location', () => {
    const cache = environmentAt(50.0755, 14.4378);

    expect(cacheForCoordinates(cache, { latitude: 48.8566, longitude: 2.3522 })).toBeNull();
  });

  it('keeps core cache fallback independent from professional activity coverage', () => {
    const cache = environmentAt(50.0755, 14.4378);
    cache.metadata.requestedActivityDomains = ['photography'];

    expect(cacheForCoordinates(cache, { latitude: 50.076, longitude: 14.438 })).toBe(cache);
  });

  it('requires cached activity domains only for professional-complete fallback requests', () => {
    const cache = environmentAt(50.0755, 14.4378);
    cache.metadata.requestedActivityDomains = ['photography'];
    cache.metadata.requestedAirQualityVariables = airQualityVariableCoverageFor(['photography']);
    cache.metadata.requestedWeatherVariables = weatherVariableCoverageFor(['photography']);

    expect(
      cacheForActivityDomains(cache, { latitude: 50.076, longitude: 14.438 }, ['photography']),
    ).toBe(cache);
    expect(
      cacheForActivityDomains(cache, { latitude: 50.076, longitude: 14.438 }, ['agriculture']),
    ).toBeNull();
  });

  it('does not accept domain labels without matching provider variable coverage', () => {
    const cache = environmentAt(50.0755, 14.4378);
    cache.metadata.requestedActivityDomains = ['agriculture'];
    cache.metadata.requestedAirQualityVariables = [];
    cache.metadata.requestedWeatherVariables = [];

    expect(
      cacheForActivityDomains(cache, { latitude: 50.076, longitude: 14.438 }, ['agriculture']),
    ).toBeNull();
  });
});

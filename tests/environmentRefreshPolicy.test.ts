import { FREE_CAPABILITIES, PRO_LIFETIME_CAPABILITIES } from '../src/capabilities/config';
import { ENVIRONMENT_PROVIDER_FRESHNESS_MS } from '../src/core/constants';
import { airQualityVariableCoverageFor } from '../src/api/openMeteoAirQuality';
import { weatherVariableCoverageFor } from '../src/api/openMeteoWeather';
import type { ActivityDomainId } from '../src/models/activities';
import type { Coordinates, NormalizedEnvironment } from '../src/models/environment';
import { environmentRefreshPolicy } from '../src/services/environmentRefreshPolicy';

const NOW = new Date('2026-08-14T12:00:00Z');
const PRAGUE: Coordinates = { latitude: 50.0755, longitude: 14.4378 };
const FAR_AWAY: Coordinates = { latitude: 48.8566, longitude: 2.3522 };

function isoAgo(milliseconds: number): string {
  return new Date(NOW.getTime() - milliseconds).toISOString();
}

function environment(input?: {
  coordinates?: Coordinates;
  airQualityFetchedAt?: string | null;
  weatherFetchedAt?: string | null;
  forecastDays?: number;
  requestedActivityDomains?: readonly ActivityDomainId[];
  requestedAirQualityVariables?: readonly string[];
  requestedWeatherVariables?: readonly string[];
}): NormalizedEnvironment {
  const requestedDomains = input?.requestedActivityDomains ?? [];
  return {
    provider: 'open-meteo',
    coordinates: input?.coordinates ?? PRAGUE,
    placeName: 'Prague',
    fetchedAt: NOW.toISOString(),
    current: {
      timestamp: NOW.toISOString(),
      pollen: {
        alder: null,
        birch: null,
        grass: null,
        mugwort: null,
        olive: null,
        ragweed: null,
      },
      airQuality: {
        pm25: null,
        pm10: null,
        nitrogenDioxide: null,
        ozone: null,
        sulphurDioxide: null,
        carbonMonoxide: null,
        aerosolOpticalDepth: null,
        dust: null,
        wildfirePm10: null,
      },
      weather: {
        temperature: null,
        relativeHumidity: null,
        precipitation: null,
        windSpeed: null,
        uvIndex: null,
        leafWetness: null,
      },
      mold: { potential: null },
      extended: {
        airQuality: {
          carbonDioxide: null,
          ammonia: null,
          methane: null,
          nitrogenMonoxide: null,
          formaldehyde: null,
          nonMethaneVolatileOrganicCompounds: null,
        },
        weather: {
          pressureMsl: null,
          surfacePressure: null,
          visibility: null,
          cloudCover: null,
          cloudCoverLow: null,
          cloudCoverMid: null,
          cloudCoverHigh: null,
          dewPoint: null,
          wetBulbTemperature: null,
          windGusts: null,
          shortwaveRadiation: null,
          directNormalIrradiance: null,
          diffuseRadiation: null,
          sunshineDuration: null,
          cape: null,
          apparentTemperature: null,
          precipitationProbability: null,
          soilTemperature: null,
          soilMoisture: null,
          et0: null,
          vapourPressureDeficit: null,
        },
      },
    },
    hourly: [],
    forecastDays: Array.from({ length: input?.forecastDays ?? 7 }, (_, index) => ({
      date: `2026-08-${String(14 + index).padStart(2, '0')}`,
      label: `Day ${index + 1}`,
      score: null,
    })),
    metadata: {
      timezone: 'Europe/Prague',
      airQualityFetchedAt:
        input?.airQualityFetchedAt ?? isoAgo(ENVIRONMENT_PROVIDER_FRESHNESS_MS / 2),
      weatherFetchedAt: input?.weatherFetchedAt ?? isoAgo(ENVIRONMENT_PROVIDER_FRESHNESS_MS / 2),
      airQualitySource: 'fresh',
      weatherSource: 'fresh',
      requestedActivityDomains: [...requestedDomains],
      requestedAirQualityVariables: [
        ...(input?.requestedAirQualityVariables ?? airQualityVariableCoverageFor(requestedDomains)),
      ],
      requestedWeatherVariables: [
        ...(input?.requestedWeatherVariables ?? weatherVariableCoverageFor(requestedDomains)),
      ],
      partial: false,
    },
  } as unknown as NormalizedEnvironment;
}

describe('environment refresh policy', () => {
  it('fetches both Open-Meteo providers when cache is missing', () => {
    expect(
      environmentRefreshPolicy({
        environment: null,
        coordinates: PRAGUE,
        capabilities: FREE_CAPABILITIES,
        requiredActivityDomains: [],
        now: NOW,
      }),
    ).toEqual({
      usableCache: null,
      fetchAirQuality: true,
      fetchWeather: true,
      needsRefresh: true,
    });
  });

  it('does not fetch providers when fresh cache is complete for the active location', () => {
    const cached = environment({ forecastDays: 7 });

    expect(
      environmentRefreshPolicy({
        environment: cached,
        coordinates: PRAGUE,
        capabilities: PRO_LIFETIME_CAPABILITIES,
        requiredActivityDomains: [],
        now: NOW,
      }),
    ).toEqual({
      usableCache: cached,
      fetchAirQuality: false,
      fetchWeather: false,
      needsRefresh: false,
    });
  });

  it('does not reuse fresh cache from a different location', () => {
    const result = environmentRefreshPolicy({
      environment: environment({ coordinates: FAR_AWAY }),
      coordinates: PRAGUE,
      capabilities: FREE_CAPABILITIES,
      requiredActivityDomains: [],
      now: NOW,
    });

    expect(result.usableCache).toBeNull();
    expect(result.fetchAirQuality).toBe(true);
    expect(result.fetchWeather).toBe(true);
  });

  it('refreshes only stale Weather when Air Quality is still fresh', () => {
    const result = environmentRefreshPolicy({
      environment: environment({
        weatherFetchedAt: isoAgo(ENVIRONMENT_PROVIDER_FRESHNESS_MS + 1),
      }),
      coordinates: PRAGUE,
      capabilities: FREE_CAPABILITIES,
      requiredActivityDomains: [],
      now: NOW,
    });

    expect(result.fetchAirQuality).toBe(false);
    expect(result.fetchWeather).toBe(true);
  });

  it('refreshes only stale Air Quality when Weather is still fresh', () => {
    const result = environmentRefreshPolicy({
      environment: environment({
        airQualityFetchedAt: isoAgo(ENVIRONMENT_PROVIDER_FRESHNESS_MS + 1),
      }),
      coordinates: PRAGUE,
      capabilities: FREE_CAPABILITIES,
      requiredActivityDomains: [],
      now: NOW,
    });

    expect(result.fetchAirQuality).toBe(true);
    expect(result.fetchWeather).toBe(false);
  });

  it('refreshes when the active forecast capability needs more cached days', () => {
    const result = environmentRefreshPolicy({
      environment: environment({ forecastDays: 3 }),
      coordinates: PRAGUE,
      capabilities: PRO_LIFETIME_CAPABILITIES,
      requiredActivityDomains: [],
      now: NOW,
    });

    expect(result.fetchAirQuality).toBe(true);
    expect(result.fetchWeather).toBe(true);
  });

  it('refreshes Weather when a newly enabled professional domain is missing from coverage', () => {
    const result = environmentRefreshPolicy({
      environment: environment({ requestedActivityDomains: ['photography'] }),
      coordinates: PRAGUE,
      capabilities: PRO_LIFETIME_CAPABILITIES,
      requiredActivityDomains: ['photography', 'agriculture'],
      now: NOW,
    });

    expect(result.fetchAirQuality).toBe(false);
    expect(result.fetchWeather).toBe(true);
  });

  it('does not treat legacy domain metadata as provider variable coverage', () => {
    const result = environmentRefreshPolicy({
      environment: environment({
        requestedActivityDomains: ['agriculture'],
        requestedAirQualityVariables: [],
        requestedWeatherVariables: [],
      }),
      coordinates: PRAGUE,
      capabilities: PRO_LIFETIME_CAPABILITIES,
      requiredActivityDomains: ['agriculture'],
      now: NOW,
    });

    expect(result.fetchWeather).toBe(true);
  });

  it('does not refresh when disabled domains reduce the requested variable set', () => {
    const result = environmentRefreshPolicy({
      environment: environment({ requestedActivityDomains: ['photography', 'agriculture'] }),
      coordinates: PRAGUE,
      capabilities: PRO_LIFETIME_CAPABILITIES,
      requiredActivityDomains: ['photography'],
      now: NOW,
    });

    expect(result.fetchAirQuality).toBe(false);
    expect(result.fetchWeather).toBe(false);
  });

  it('manual refresh bypasses freshness and coverage checks', () => {
    const result = environmentRefreshPolicy({
      environment: environment({ requestedActivityDomains: ['agriculture'] }),
      coordinates: PRAGUE,
      capabilities: PRO_LIFETIME_CAPABILITIES,
      requiredActivityDomains: ['agriculture'],
      force: true,
      now: NOW,
    });

    expect(result.fetchAirQuality).toBe(true);
    expect(result.fetchWeather).toBe(true);
  });
});

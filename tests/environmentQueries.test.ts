import { ENVIRONMENT_PROVIDER_FRESHNESS_MS } from '../src/core/constants';
import { queryClient, providerStaleTimes } from '../src/services/queryClient';
import { airAwareQueryKeys } from '../src/services/queryKeys';
import { fetchWeatherQuery } from '../src/services/environmentQueries';
import type { EnvironmentalProviderClient } from '../src/services/environmentProviders';
import type { NormalizedAirQuality } from '../src/api/openMeteoAirQuality';
import type { NormalizedWeather } from '../src/api/openMeteoWeather';

const coordinates = { latitude: 50.087, longitude: 14.421 };

function airQuality(): NormalizedAirQuality {
  return {
    coordinates,
    fetchedAt: '2026-08-14T12:00:00Z',
    timezone: 'Europe/Prague',
    current: {
      timestamp: '2026-08-14T12:00:00+02:00',
      pollen: { alder: null, birch: null, grass: 10, mugwort: null, olive: null, ragweed: null },
      regulatedPollutants: {
        pm25: 6,
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
      extended: {
        carbonDioxide: null,
        ammonia: null,
        methane: null,
        nitrogenMonoxide: null,
        formaldehyde: null,
        nonMethaneVolatileOrganicCompounds: null,
      },
    },
    hourly: [],
    partial: false,
  };
}

function weather(): NormalizedWeather {
  return {
    coordinates,
    fetchedAt: '2026-08-14T12:00:00Z',
    timezone: 'Europe/Prague',
    current: {
      timestamp: '2026-08-14T12:00:00+02:00',
      temperature: 20,
      relativeHumidity: 50,
      dewPoint: 10,
      precipitation: 0,
      windSpeed: 2,
      windDirection: 90,
      windGusts: 4,
      visibility: 20000,
      leafWetnessProbability: null,
      uvIndex: 4,
      extended: {
        pressureMsl: null,
        surfacePressure: null,
        visibility: 20000,
        cloudCover: null,
        cloudCoverLow: null,
        cloudCoverMid: null,
        cloudCoverHigh: null,
        dewPoint: 10,
        wetBulbTemperature: null,
        windGusts: 4,
        shortwaveRadiation: null,
        directNormalIrradiance: null,
        diffuseRadiation: null,
        sunshineDuration: null,
        cape: null,
      },
    },
    hourly: [],
    daily: [],
    partial: false,
  };
}

function provider(): EnvironmentalProviderClient {
  return {
    id: 'open-meteo',
    fetchAirQuality: jest.fn(async () => airQuality()),
    fetchWeather: jest.fn(async () => weather()),
  };
}

describe('environment queries', () => {
  it('uses stable location-aware, variable-set-aware query keys', () => {
    expect(
      airAwareQueryKeys.weather('open-meteo', coordinates, [
        'temperature_2m',
        'wind_speed_10m',
        'temperature_2m',
      ]),
    ).toEqual(
      airAwareQueryKeys.weather('open-meteo', coordinates, ['wind_speed_10m', 'temperature_2m']),
    );
    expect(airAwareQueryKeys.weather('open-meteo', coordinates, ['temperature_2m'])).not.toEqual(
      airAwareQueryKeys.weather('open-meteo', coordinates, ['temperature_2m', 'wind_speed_10m']),
    );
    expect(
      airAwareQueryKeys.weather('open-meteo', { latitude: 48.8566, longitude: 2.3522 }, []),
    ).not.toEqual(airAwareQueryKeys.weather('open-meteo', coordinates, []));
    expect(
      airAwareQueryKeys.weather('open-meteo', { latitude: 50.0871, longitude: 14.4211 }, []),
    ).not.toEqual(
      airAwareQueryKeys.weather('open-meteo', { latitude: 50.0889, longitude: 14.4229 }, []),
    );
  });

  it('configures provider-specific stale times', () => {
    expect(providerStaleTimes.airQuality).toBeGreaterThan(0);
    expect(providerStaleTimes.weather).toBe(providerStaleTimes.airQuality);
    expect(providerStaleTimes.vegetation).toBeGreaterThan(providerStaleTimes.weather);
    expect(providerStaleTimes.dataDetailForecast).toBe(ENVIRONMENT_PROVIDER_FRESHNESS_MS);
    expect(providerStaleTimes.dataDetailHistory).toBeGreaterThan(
      providerStaleTimes.dataDetailForecast,
    );
  });

  it('keeps reconnect refetch disabled so app refresh policy remains authoritative', () => {
    expect(queryClient.getDefaultOptions().queries?.refetchOnReconnect).toBe(false);
  });

  it('deduplicates concurrent equivalent provider requests', async () => {
    const client = provider();
    const [first, second] = await Promise.all([
      fetchWeatherQuery({ provider: client, coordinates, enabledActivities: ['photography'] }),
      fetchWeatherQuery({ provider: client, coordinates, enabledActivities: ['photography'] }),
    ]);

    expect(first).toBe(second);
    expect(client.fetchWeather).toHaveBeenCalledTimes(1);
  });

  it('does not reuse a narrower variable query for a broader request', async () => {
    const client = provider();
    await fetchWeatherQuery({ provider: client, coordinates, enabledActivities: [] });
    await fetchWeatherQuery({
      provider: client,
      coordinates,
      enabledActivities: ['photography', 'agriculture'],
    });

    expect(client.fetchWeather).toHaveBeenCalledTimes(2);
  });

  it('force refresh bypasses fresh query data', async () => {
    const client = provider();
    await fetchWeatherQuery({ provider: client, coordinates, enabledActivities: [] });
    await fetchWeatherQuery({ provider: client, coordinates, enabledActivities: [], force: true });

    expect(client.fetchWeather).toHaveBeenCalledTimes(2);
    expect(queryClient.getQueryCache().findAll()).toHaveLength(1);
  });
});

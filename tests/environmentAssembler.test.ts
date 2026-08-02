import type { NormalizedAirQuality } from '../src/api/openMeteoAirQuality';
import type { NormalizedWeather } from '../src/api/openMeteoWeather';
import { calculateMoldPotential } from '../src/core/moldPotential';
import { assembleEnvironment } from '../src/services/environmentAssembler';
import type { NormalizedEnvironment, WeatherContext } from '../src/models/environment';

const coordinates = { latitude: 50.0755, longitude: 14.4378 };

const weatherContext: WeatherContext = {
  temperature: 20,
  relativeHumidity: 65,
  dewPoint: 12,
  precipitation: 0,
  windSpeed: 3,
  windDirection: null,
  windGusts: null,
  visibility: null,
  leafWetnessProbability: 30,
};

function airQuality(fetchedAt: string): NormalizedAirQuality {
  return {
    coordinates,
    fetchedAt,
    timezone: 'Europe/Prague',
    current: {
      timestamp: '2026-08-01T12:00:00+02:00',
      pollen: { alder: null, birch: null, grass: 40, mugwort: null, olive: null, ragweed: null },
      regulatedPollutants: {
        pm25: 10,
        pm10: 20,
        nitrogenDioxide: 5,
        ozone: 30,
        sulphurDioxide: 2,
      },
      pollutantAqi: { pm25: 20, pm10: 15, nitrogenDioxide: 5, ozone: 30, sulphurDioxide: 2 },
      aqiLabel: 'EU AQI',
      atmosphericIrritants: {
        carbonMonoxide: 100,
        aerosolOpticalDepth: 0.1,
        dust: 10,
        wildfirePm10: null,
      },
    },
    hourly: [],
    partial: true,
  };
}

function weather(fetchedAt: string): NormalizedWeather {
  return {
    coordinates,
    fetchedAt,
    timezone: 'Europe/Prague',
    current: {
      timestamp: '2026-08-01T12:00:00+02:00',
      ...weatherContext,
      uvIndex: 6,
    },
    hourly: [],
    daily: [],
    partial: true,
  };
}

function fallbackEnvironment(): NormalizedEnvironment {
  const fallbackWeather = weather('2026-08-01T06:00:00Z');
  return {
    provider: 'open-meteo',
    coordinates,
    placeName: 'Prague',
    fetchedAt: '2026-08-01T06:00:00Z',
    current: {
      timestamp: '2026-08-01T06:00:00+02:00',
      pollen: { alder: null, birch: null, grass: 20, mugwort: null, olive: null, ragweed: null },
      regulatedPollutants: {
        pm25: 8,
        pm10: 16,
        nitrogenDioxide: 4,
        ozone: 20,
        sulphurDioxide: 1,
      },
      pollutantAqi: { pm25: 16, pm10: 12, nitrogenDioxide: 4, ozone: 20, sulphurDioxide: 1 },
      aqiLabel: 'EU AQI',
      atmosphericIrritants: {
        carbonMonoxide: 80,
        aerosolOpticalDepth: 0.08,
        dust: 8,
        wildfirePm10: null,
      },
      weather: fallbackWeather.current,
      moldPotential: calculateMoldPotential(fallbackWeather.current),
      uvIndex: 4,
    },
    hourly: [],
    forecastDays: [],
    metadata: {
      timezone: 'Europe/Prague',
      airQualityFetchedAt: '2026-08-01T06:00:00Z',
      weatherFetchedAt: fallbackWeather.fetchedAt,
      airQualitySource: 'fresh',
      weatherSource: 'fresh',
      partial: false,
    },
  };
}

describe('environment assembler', () => {
  it('marks air quality and weather freshness independently when weather falls back to cache', () => {
    const environment = assembleEnvironment({
      coordinates,
      placeName: 'Prague',
      airQuality: airQuality('2026-08-01T12:00:00Z'),
      weather: null,
      fallback: fallbackEnvironment(),
    });

    expect(environment.metadata.airQualitySource).toBe('fresh');
    expect(environment.metadata.weatherSource).toBe('cached');
    expect(environment.metadata.airQualityFetchedAt).toBe('2026-08-01T12:00:00Z');
    expect(environment.metadata.weatherFetchedAt).toBe('2026-08-01T06:00:00Z');
    expect(environment.current.weather.temperature).toBe(20);
  });
});

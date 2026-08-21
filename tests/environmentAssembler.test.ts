import type { NormalizedAirQuality } from '../src/api/openMeteoAirQuality';
import type { NormalizedWeather } from '../src/api/openMeteoWeather';
import { calculateMoldPotential } from '../src/core/moldPotential';
import { calculateEnvironmentalScore } from '../src/core/scoring';
import { assembleEnvironment } from '../src/services/environmentAssembler';
import type { NormalizedEnvironment, WeatherContext } from '../src/models/environment';

const coordinates = { latitude: 50.0755, longitude: 14.4378 };
const extendedAirQuality = {
  carbonDioxide: null,
  ammonia: null,
  methane: null,
  nitrogenMonoxide: null,
  formaldehyde: null,
  nonMethaneVolatileOrganicCompounds: null,
};
const extendedWeather = {
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
};

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
    atmosphericModel: 'auto',
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
      uvIndex: 5,
      extended: extendedAirQuality,
    },
    hourly: [],
    partial: true,
  };
}

function airQualityWithDailyHours(dayCount: number): NormalizedAirQuality {
  const base = airQuality('2026-08-01T12:00:00Z');
  return {
    ...base,
    hourly: Array.from({ length: dayCount }, (_, index) => ({
      ...base.current,
      timestamp: `2026-08-0${index + 1}T12:00:00+02:00`,
    })),
    partial: false,
  };
}

function airQualityHour(timestamp: string, grass: number): NormalizedAirQuality['hourly'][number] {
  const base = airQuality('2026-08-01T12:00:00Z');
  return {
    ...base.current,
    timestamp,
    pollen: { ...base.current.pollen, grass },
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
      extended: extendedWeather,
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
      extended: { airQuality: extendedAirQuality, weather: extendedWeather },
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

function fallbackEnvironmentWithHourlyWeather(): NormalizedEnvironment {
  const fallback = fallbackEnvironment();
  const oldWeather = {
    ...fallback.current,
    timestamp: '2026-07-31T12:00:00+02:00',
    weather: { ...weatherContext, temperature: 15 },
    moldPotential: calculateMoldPotential({ ...weatherContext, temperature: 15 }),
  };
  const matchingWeather = {
    ...fallback.current,
    timestamp: '2026-08-01T12:00:00+02:00',
    weather: { ...weatherContext, temperature: 25 },
    moldPotential: calculateMoldPotential({ ...weatherContext, temperature: 25 }),
  };

  return {
    ...fallback,
    hourly: [oldWeather, matchingWeather],
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

  it('keeps all provider forecast days before entitlement display limits are applied', () => {
    const environment = assembleEnvironment({
      coordinates,
      placeName: 'Prague',
      airQuality: airQualityWithDailyHours(7),
      weather: null,
    });

    expect(environment.forecastDays.map((day) => day.date)).toEqual([
      '2026-08-01',
      '2026-08-02',
      '2026-08-03',
      '2026-08-04',
      '2026-08-05',
      '2026-08-06',
      '2026-08-07',
    ]);
    expect(environment.forecastDays.every((day) => day.score?.available)).toBe(true);
  });

  it('does not score past hours as part of today forecast', () => {
    const yesterdayHigh = airQualityHour('2026-07-31T23:00:00+02:00', 500);
    const pastHigh = airQualityHour('2026-08-01T06:00:00+02:00', 400);
    const futureLow = airQualityHour('2026-08-01T13:00:00+02:00', 5);
    const tomorrowHigh = airQualityHour('2026-08-02T12:00:00+02:00', 300);
    const environment = assembleEnvironment({
      coordinates,
      placeName: 'Prague',
      airQuality: {
        ...airQuality('2026-08-01T12:00:00Z'),
        hourly: [yesterdayHigh, pastHigh, futureLow, tomorrowHigh],
        partial: false,
      },
      weather: null,
    });
    const assembledFutureLow = environment.hourly.find(
      (hour) => hour.timestamp === futureLow.timestamp,
    );
    const assembledTomorrowHigh = environment.hourly.find(
      (hour) => hour.timestamp === tomorrowHigh.timestamp,
    );

    expect(environment.forecastDays[0]?.date).toBe('2026-08-01');
    expect(environment.forecastDays.map((day) => day.date)).not.toContain('2026-07-31');
    expect(environment.forecastDays[0]?.score?.score).toBe(
      calculateEnvironmentalScore(assembledFutureLow!).score,
    );
    expect(environment.forecastDays[1]?.score?.score).toBe(
      calculateEnvironmentalScore(assembledTomorrowHigh!).score,
    );
  });

  it('preserves the cached current timestamp when both providers fall back to cache', () => {
    const environment = assembleEnvironment({
      coordinates,
      placeName: 'Prague',
      airQuality: null,
      weather: null,
      fallback: fallbackEnvironment(),
    });

    expect(environment.current.timestamp).toBe('2026-08-01T06:00:00+02:00');
    expect(environment.metadata.airQualitySource).toBe('cached');
    expect(environment.metadata.weatherSource).toBe('cached');
  });

  it('does not prepend stale fallback-only dates to a fresh hourly forecast', () => {
    const environment = assembleEnvironment({
      coordinates,
      placeName: 'Prague',
      airQuality: airQualityWithDailyHours(7),
      weather: null,
      fallback: fallbackEnvironmentWithHourlyWeather(),
    });

    expect(environment.hourly.map((hour) => hour.timestamp)).toEqual([
      '2026-08-01T12:00:00+02:00',
      '2026-08-02T12:00:00+02:00',
      '2026-08-03T12:00:00+02:00',
      '2026-08-04T12:00:00+02:00',
      '2026-08-05T12:00:00+02:00',
      '2026-08-06T12:00:00+02:00',
      '2026-08-07T12:00:00+02:00',
    ]);
    expect(environment.hourly[0]?.weather.temperature).toBe(25);
    expect(environment.forecastDays.map((day) => day.date)).toEqual([
      '2026-08-01',
      '2026-08-02',
      '2026-08-03',
      '2026-08-04',
      '2026-08-05',
      '2026-08-06',
      '2026-08-07',
    ]);
    expect(environment.forecastDays[0]?.label).toBe('Today');
    expect(environment.forecastDays[1]?.label).toBe('Tomorrow');
  });
});

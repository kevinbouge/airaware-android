import { buildDailySummary, formatDailySummary } from '../src/core/dailySummary';
import { calculateMoldPotential } from '../src/core/moldPotential';
import { calculatePersonalizedScore } from '../src/core/profileScoring';
import { calculateEnvironmentalScore } from '../src/core/scoring';
import type { NormalizedEnvironment } from '../src/models/environment';
import { DEFAULT_PROFILE, DEFAULT_SETTINGS } from '../src/models/profile';

const weather = {
  temperature: 20,
  relativeHumidity: 72,
  dewPoint: 16,
  precipitation: 2,
  windSpeed: 2,
  windDirection: null,
  windGusts: null,
  visibility: null,
  leafWetnessProbability: 60,
};

const environment: NormalizedEnvironment = {
  provider: 'open-meteo',
  coordinates: { latitude: 50.0755, longitude: 14.4378 },
  placeName: 'Prague',
  fetchedAt: '2026-08-01T12:00:00+02:00',
  current: {
    timestamp: '2026-08-01T12:00:00+02:00',
    pollen: { alder: null, birch: null, grass: 120, mugwort: null, olive: null, ragweed: null },
    regulatedPollutants: {
      pm25: 10,
      pm10: 20,
      nitrogenDioxide: 10,
      ozone: 40,
      sulphurDioxide: 2,
    },
    pollutantAqi: { pm25: 20, pm10: 30, nitrogenDioxide: 10, ozone: 45, sulphurDioxide: 3 },
    aqiLabel: 'EU AQI',
    atmosphericIrritants: {
      carbonMonoxide: 200,
      aerosolOpticalDepth: 0.1,
      dust: 20,
      wildfirePm10: null,
    },
    weather,
    moldPotential: calculateMoldPotential(weather),
    uvIndex: 8.4,
  },
  hourly: [
    {
      timestamp: '2026-08-01T11:00:00+02:00',
      pollen: { alder: null, birch: null, grass: 120, mugwort: null, olive: null, ragweed: null },
      regulatedPollutants: {
        pm25: 10,
        pm10: 20,
        nitrogenDioxide: 10,
        ozone: 40,
        sulphurDioxide: 2,
      },
      pollutantAqi: { pm25: 20, pm10: 30, nitrogenDioxide: 10, ozone: 45, sulphurDioxide: 3 },
      aqiLabel: 'EU AQI',
      atmosphericIrritants: {
        carbonMonoxide: 200,
        aerosolOpticalDepth: 0.1,
        dust: 20,
        wildfirePm10: null,
      },
      weather,
      moldPotential: calculateMoldPotential(weather),
      uvIndex: 11,
    },
    {
      timestamp: '2026-08-01T13:00:00+02:00',
      pollen: { alder: null, birch: null, grass: 120, mugwort: null, olive: null, ragweed: null },
      regulatedPollutants: {
        pm25: 10,
        pm10: 20,
        nitrogenDioxide: 10,
        ozone: 40,
        sulphurDioxide: 2,
      },
      pollutantAqi: { pm25: 20, pm10: 30, nitrogenDioxide: 10, ozone: 45, sulphurDioxide: 3 },
      aqiLabel: 'EU AQI',
      atmosphericIrritants: {
        carbonMonoxide: 200,
        aerosolOpticalDepth: 0.1,
        dust: 20,
        wildfirePm10: null,
      },
      weather,
      moldPotential: calculateMoldPotential(weather),
      uvIndex: 6.4,
    },
  ],
  forecastDays: [],
  metadata: {
    timezone: 'Europe/Prague',
    airQualityFetchedAt: '2026-08-01T12:00:00+02:00',
    weatherFetchedAt: '2026-08-01T12:00:00+02:00',
    airQualitySource: 'fresh',
    weatherSource: 'fresh',
    partial: false,
  },
};

describe('daily summary', () => {
  it('formats a compact privacy-safe text summary', () => {
    const profile = { ...DEFAULT_PROFILE, enabled: true };
    const summary = buildDailySummary({
      environment,
      personalizedScore: calculatePersonalizedScore(environment.current, profile),
      bestOutdoorWindow: {
        available: true,
        startTime: '2026-08-01T19:00:00+02:00',
        endTime: '2026-08-01T21:00:00+02:00',
        durationHours: 2,
        averageScore: 28,
        maximumScore: 31,
        category: 'low',
        completeness: 1,
      },
      settings: { ...DEFAULT_SETTINGS, summaryScore: 'environmental' },
      stale: false,
    });

    expect(summary).not.toBeNull();
    expect(calculateEnvironmentalScore(environment.current).available).toBe(true);
    const text = formatDailySummary(summary!);

    expect(text).toContain('😷 AirAware — Prague');
    expect(text).toContain('🎯 Environmental burden');
    expect(text).toContain('Grass pollen');
    expect(text).toContain('🌤️ Best outdoor window');
    expect(text).toContain('☀️ UV peak');
    expect(text).toContain('High at');
    expect(text).not.toContain('Very High');
    expect(text).toContain('📡 Data: Open-Meteo');
    expect(text).not.toContain('50.0755');
    expect(text).not.toContain('14.4378');
    expect(text).not.toContain('undefined');
    expect(text).not.toContain('NaN');
  });

  it('hides location when requested and marks cached data', () => {
    const summary = buildDailySummary({
      environment,
      personalizedScore: calculatePersonalizedScore(environment.current, DEFAULT_PROFILE),
      bestOutdoorWindow: null,
      settings: { ...DEFAULT_SETTINGS, summaryLocation: 'hidden' },
      stale: true,
    });
    const text = formatDailySummary(summary!);

    expect(text).toContain('😷 AirAware\n');
    expect(text).toContain('💾 Cached data');
  });
});

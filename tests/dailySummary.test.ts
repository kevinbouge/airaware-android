import {
  buildDailySummary,
  formatDailySummary,
  selectDailySummaryOutdoorWindow,
} from '../src/core/dailySummary';
import { calculateMoldPotential } from '../src/core/moldPotential';
import { calculatePersonalizedScore } from '../src/core/profileScoring';
import { calculateEnvironmentalScore } from '../src/core/scoring';
import type {
  NormalizedEnvironment,
  OutdoorWindow,
  PersonalizedScoreResult,
} from '../src/models/environment';
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
  function uvPersonalizedScore(): PersonalizedScoreResult {
    return {
      available: true,
      score: 90,
      displayScore: 90,
      category: 'veryHigh',
      components: {
        uv: {
          available: true,
          score: 90,
          displayScore: 90,
          category: 'veryHigh',
          missing: [],
          completeness: 1,
        },
      },
      effectiveWeights: { uv: 1 },
      missingComponents: [],
      selectedGroupCount: 1,
      availableGroupCount: 1,
      dominantComponent: 'uv',
    };
  }

  function windowAt(startTime: string): OutdoorWindow {
    return {
      available: true,
      startTime,
      endTime: '2026-08-01T21:00:00+02:00',
      durationHours: 2,
      averageScore: 28,
      maximumScore: 31,
      category: 'low',
      completeness: 1,
    };
  }

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
    expect(text).toContain('📡 Data: Open-Meteo, CAMS ENSEMBLE data providers');
    expect(text).not.toContain('50.0755');
    expect(text).not.toContain('14.4378');
    expect(text).not.toContain('undefined');
    expect(text).not.toContain('NaN');
  });

  it('labels best outdoor windows that start tomorrow', () => {
    const summary = buildDailySummary({
      environment,
      personalizedScore: calculatePersonalizedScore(environment.current, DEFAULT_PROFILE),
      bestOutdoorWindow: {
        available: true,
        startTime: '2026-08-02T06:00:00+02:00',
        endTime: '2026-08-02T08:00:00+02:00',
        durationHours: 2,
        averageScore: 24,
        maximumScore: 28,
        category: 'low',
        completeness: 1,
      },
      settings: { ...DEFAULT_SETTINGS, summaryScore: 'environmental' },
      stale: false,
    });

    expect(formatDailySummary(summary!)).toContain('06:00–08:00 (tomorrow)');
  });

  it('does not label best outdoor windows as tomorrow when only the end crosses midnight', () => {
    const summary = buildDailySummary({
      environment,
      personalizedScore: calculatePersonalizedScore(environment.current, DEFAULT_PROFILE),
      bestOutdoorWindow: {
        available: true,
        startTime: '2026-08-01T23:00:00+02:00',
        endTime: '2026-08-02T01:00:00+02:00',
        durationHours: 2,
        averageScore: 24,
        maximumScore: 28,
        category: 'low',
        completeness: 1,
      },
      settings: { ...DEFAULT_SETTINGS, summaryScore: 'environmental' },
      stale: false,
    });

    const text = formatDailySummary(summary!);

    expect(text).toContain('23:00–01:00');
    expect(text).not.toContain('(tomorrow)');
  });

  it('uses the selected summary score for the main factor', () => {
    const summary = buildDailySummary({
      environment,
      personalizedScore: uvPersonalizedScore(),
      bestOutdoorWindow: null,
      settings: { ...DEFAULT_SETTINGS, summaryScore: 'environmental' },
      stale: false,
    });

    expect(summary?.scoreLabel).toBe('Environmental burden');
    expect(summary?.mainFactorLabel).toBe('Grass pollen');
    expect(summary?.mainFactorGroup).toBe('pollen');
  });

  it('omits the UV peak when UV is unavailable to the active capabilities', () => {
    const summary = buildDailySummary({
      environment,
      personalizedScore: calculatePersonalizedScore(environment.current, DEFAULT_PROFILE),
      bestOutdoorWindow: null,
      settings: { ...DEFAULT_SETTINGS, summaryScore: 'environmental' },
      stale: false,
      includeUvPeak: false,
    });
    const text = formatDailySummary(summary!);

    expect(summary?.uvPeak).toBeNull();
    expect(text).not.toContain('UV peak');
  });

  it('selects the outdoor window from the selected summary score mode', () => {
    const environmentalWindow = windowAt('2026-08-01T18:00:00+02:00');
    const personalizedWindow = windowAt('2026-08-01T20:00:00+02:00');

    expect(
      selectDailySummaryOutdoorWindow({
        settings: { ...DEFAULT_SETTINGS, summaryScore: 'environmental' },
        personalizedScore: uvPersonalizedScore(),
        environmentalBestOutdoorWindow: environmentalWindow,
        personalizedBestOutdoorWindow: personalizedWindow,
      }),
    ).toBe(environmentalWindow);

    expect(
      selectDailySummaryOutdoorWindow({
        settings: { ...DEFAULT_SETTINGS, summaryScore: 'personalized' },
        personalizedScore: uvPersonalizedScore(),
        environmentalBestOutdoorWindow: environmentalWindow,
        personalizedBestOutdoorWindow: personalizedWindow,
      }),
    ).toBe(personalizedWindow);
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

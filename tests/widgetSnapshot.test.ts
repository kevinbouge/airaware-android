import { FREE_CAPABILITIES, PRO_LIFETIME_CAPABILITIES } from '../src/capabilities/config';
import { FREE_ENTITLEMENT, PRO_LIFETIME_ENTITLEMENT } from '../src/capabilities/entitlements';
import {
  advancedWidgetRenderModel,
  buildWidgetSnapshot,
  compactWidgetRenderModel,
} from '../src/core/widgetSnapshot';
import { calculateMoldPotential } from '../src/core/moldPotential';
import { calculateEnvironmentalScore } from '../src/core/scoring';
import { deriveEnvironmentState } from '../src/state/derivedEnvironment';
import type { HourlyEnvironmentalReading, NormalizedEnvironment } from '../src/models/environment';
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

function hour(
  timestamp: string,
  grass: number,
  ozoneAqi: number,
  uvIndex = 6,
): HourlyEnvironmentalReading {
  return {
    timestamp,
    pollen: { alder: null, birch: null, grass, mugwort: null, olive: null, ragweed: null },
    regulatedPollutants: {
      pm25: 10,
      pm10: 20,
      nitrogenDioxide: 10,
      ozone: 40,
      sulphurDioxide: 2,
    },
    pollutantAqi: {
      pm25: 20,
      pm10: 30,
      nitrogenDioxide: 10,
      ozone: ozoneAqi,
      sulphurDioxide: 3,
    },
    aqiLabel: 'EU AQI',
    atmosphericIrritants: {
      carbonMonoxide: 200,
      aerosolOpticalDepth: 0.1,
      dust: 20,
      wildfirePm10: null,
    },
    weather,
    moldPotential: calculateMoldPotential(weather),
    uvIndex,
  };
}

function environment(): NormalizedEnvironment {
  const hourly = [
    hour('2026-08-01T12:00:00+02:00', 120, 45, 8),
    hour('2026-08-01T13:00:00+02:00', 90, 35, 7),
    hour('2026-08-02T12:00:00+02:00', 40, 25, 4),
    hour('2026-08-03T12:00:00+02:00', 20, 15, 3),
    hour('2026-08-04T12:00:00+02:00', 60, 35, 6),
    hour('2026-08-05T12:00:00+02:00', 50, 30, 5),
    hour('2026-08-06T12:00:00+02:00', 30, 20, 4),
    hour('2026-08-07T12:00:00+02:00', 70, 40, 7),
  ];

  return {
    provider: 'open-meteo',
    coordinates: { latitude: 50.0755, longitude: 14.4378 },
    placeName: 'Prague',
    fetchedAt: '2026-08-01T12:00:00+02:00',
    current: {
      ...hourly[0]!,
      timestamp: '2026-08-01T12:00:00+02:00',
    },
    hourly,
    forecastDays: [
      { date: '2026-08-01', label: 'Today', score: calculateEnvironmentalScore(hourly[0]!) },
      { date: '2026-08-02', label: 'Tomorrow', score: calculateEnvironmentalScore(hourly[2]!) },
      { date: '2026-08-03', label: 'Day 3', score: calculateEnvironmentalScore(hourly[3]!) },
      { date: '2026-08-04', label: 'Day 4', score: calculateEnvironmentalScore(hourly[4]!) },
      { date: '2026-08-05', label: 'Day 5', score: calculateEnvironmentalScore(hourly[5]!) },
      { date: '2026-08-06', label: 'Day 6', score: calculateEnvironmentalScore(hourly[6]!) },
      { date: '2026-08-07', label: 'Day 7', score: calculateEnvironmentalScore(hourly[7]!) },
    ],
    metadata: {
      timezone: 'Europe/Prague',
      airQualityFetchedAt: '2026-08-01T12:00:00+02:00',
      weatherFetchedAt: '2026-08-01T12:00:00+02:00',
      airQualitySource: 'fresh',
      weatherSource: 'fresh',
      partial: false,
    },
  };
}

describe('widget snapshots', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-08-01T12:00:00+02:00'));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('builds a privacy-safe Free compact widget snapshot', () => {
    const env = environment();
    const derived = deriveEnvironmentState(env, DEFAULT_PROFILE, FREE_CAPABILITIES);
    const snapshot = buildWidgetSnapshot({
      environment: env,
      derived,
      settings: DEFAULT_SETTINGS,
      capabilities: FREE_CAPABILITIES,
      entitlement: FREE_ENTITLEMENT,
      stale: false,
      generatedAt: '2026-08-01T12:05:00+02:00',
    });
    const serialized = JSON.stringify(snapshot);

    expect(snapshot.compactAvailable).toBe(true);
    expect(snapshot.advancedAvailable).toBe(false);
    expect(snapshot.forecastDays).toHaveLength(3);
    expect(snapshot.mainFactorLabel).toBe('Grass pollen');
    expect(snapshot.uvCategoryLabel).toBe('Very High');
    expect(serialized).not.toContain('50.0755');
    expect(serialized).not.toContain('14.4378');
    expect(serialized).not.toContain('pollen_grass');
  });

  it('renders a useful Free compact widget and a locked advanced widget', () => {
    const env = environment();
    const snapshot = buildWidgetSnapshot({
      environment: env,
      derived: deriveEnvironmentState(env, DEFAULT_PROFILE, FREE_CAPABILITIES),
      settings: DEFAULT_SETTINGS,
      capabilities: FREE_CAPABILITIES,
      entitlement: FREE_ENTITLEMENT,
      stale: true,
    });

    expect(compactWidgetRenderModel(snapshot)).toMatchObject({
      destination: 'today',
      locked: false,
      mainFactorLine: 'Grass pollen',
      message: 'Cached data',
    });
    expect(advancedWidgetRenderModel(snapshot)).toMatchObject({
      destination: 'settings',
      locked: true,
      message: 'Extended home widget\nOpen AirAware to learn more',
    });
  });

  it('keeps seven Pro forecast days in the advanced widget snapshot and renders a compact subset', () => {
    const env = environment();
    const snapshot = buildWidgetSnapshot({
      environment: env,
      derived: deriveEnvironmentState(env, DEFAULT_PROFILE, PRO_LIFETIME_CAPABILITIES),
      settings: DEFAULT_SETTINGS,
      capabilities: PRO_LIFETIME_CAPABILITIES,
      entitlement: PRO_LIFETIME_ENTITLEMENT,
      stale: false,
    });
    const advanced = advancedWidgetRenderModel(snapshot);

    expect(snapshot.advancedAvailable).toBe(true);
    expect(snapshot.forecastDays).toHaveLength(7);
    expect(advanced.destination).toBe('forecast');
    expect(advanced.forecastLines).toHaveLength(4);
    expect(advanced.forecastLines.at(-1)).toContain('Day 4');
    expect(advanced.bestWindowLine).toContain('Best outdoor window');
  });

  it('keeps widget score selection aligned with headline fallback behavior', () => {
    const env = environment();
    const disabledProfile = { ...DEFAULT_PROFILE, enabled: false };
    const snapshot = buildWidgetSnapshot({
      environment: env,
      derived: deriveEnvironmentState(env, disabledProfile, PRO_LIFETIME_CAPABILITIES),
      settings: DEFAULT_SETTINGS,
      capabilities: PRO_LIFETIME_CAPABILITIES,
      entitlement: PRO_LIFETIME_ENTITLEMENT,
      stale: false,
    });

    expect(snapshot.headlineScore?.type).toBe('environmental');
    expect(snapshot.headlineScore?.label).toBe('Environmental burden');
  });

  it('handles first-run and missing data states without placeholders', () => {
    const snapshot = buildWidgetSnapshot({
      environment: null,
      derived: deriveEnvironmentState(null, DEFAULT_PROFILE, FREE_CAPABILITIES),
      settings: DEFAULT_SETTINGS,
      capabilities: FREE_CAPABILITIES,
      entitlement: FREE_ENTITLEMENT,
      stale: false,
    });

    expect(compactWidgetRenderModel(snapshot).message).toBe(
      'Open the app to load environmental data',
    );
    expect(JSON.stringify(snapshot)).not.toMatch(/undefined|null%|NaN/);
  });
});

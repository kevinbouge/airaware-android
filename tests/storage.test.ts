import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  loadEnvironmentCache,
  loadProfile,
  loadRiskNotificationTransitionState,
  loadSettings,
  saveRiskNotificationTransitionState,
  saveSettings,
} from '../src/storage/storage';
import { DEFAULT_SETTINGS } from '../src/models/profile';

describe('settings storage', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  it('persists collapsed Today section state', async () => {
    await saveSettings({
      ...DEFAULT_SETTINGS,
      collapsedSections: {
        'today.pollen': true,
        'today.regulatedPollution': false,
      },
    });

    const settings = await loadSettings();

    expect(settings.collapsedSections['today.pollen']).toBe(true);
    expect(settings.collapsedSections['today.regulatedPollution']).toBe(false);
  });

  it('migrates older settings without collapse state', async () => {
    await AsyncStorage.setItem(
      'airaware.settings.v1',
      JSON.stringify({
        locationMode: 'manual',
        manualLatitude: '50',
        manualLongitude: '14',
      }),
    );

    const settings = await loadSettings();

    expect(settings.locationMode).toBe('manual');
    expect(settings.collapsedSections).toEqual({});
    expect(settings.locationOnboardingComplete).toBe(false);
  });

  it('rejects invalid persisted settings values', async () => {
    await AsyncStorage.setItem(
      'airaware.settings.v1',
      JSON.stringify({
        locationMode: 'mars',
        refreshIntervalMinutes: 15,
        outdoorWindowDurationHours: 12,
        headlineScore: 'other',
        summaryScore: 'panel',
        summaryLocation: 'coordinates',
        locationOnboardingComplete: true,
        manualLatitude: 50,
        manualLongitude: null,
        collapsedSections: {
          'today.pollen': true,
          'today.uv': 'yes',
        },
      }),
    );

    const settings = await loadSettings();

    expect(settings.locationMode).toBe(DEFAULT_SETTINGS.locationMode);
    expect(settings.refreshIntervalMinutes).toBe(DEFAULT_SETTINGS.refreshIntervalMinutes);
    expect(settings.outdoorWindowDurationHours).toBe(DEFAULT_SETTINGS.outdoorWindowDurationHours);
    expect(settings.headlineScore).toBe(DEFAULT_SETTINGS.headlineScore);
    expect(settings.forecastScore).toBe(DEFAULT_SETTINGS.forecastScore);
    expect(settings.summaryScore).toBe(DEFAULT_SETTINGS.summaryScore);
    expect(settings.summaryLocation).toBe(DEFAULT_SETTINGS.summaryLocation);
    expect(settings.riskTransitionNotificationsEnabled).toBe(false);
    expect(settings.riskTransitionNotificationThreshold).toBe('highAndVeryHigh');
    expect(settings.locationOnboardingComplete).toBe(true);
    expect(settings.manualLatitude).toBe('');
    expect(settings.manualLongitude).toBe('');
    expect(settings.collapsedSections).toEqual({ 'today.pollen': true });
  });

  it('ignores unknown profile factors from storage', async () => {
    await AsyncStorage.setItem(
      'airaware.profile.v1',
      JSON.stringify({
        enabled: true,
        factors: {
          pollen_grass: false,
          unknown_factor: true,
        },
      }),
    );

    const profile = await loadProfile();

    expect(profile.enabled).toBe(true);
    expect(profile.factors.pollen_grass).toBe(false);
    expect(profile.factors).not.toHaveProperty('unknown_factor');
  });

  it('rejects malformed cached environment data', async () => {
    await AsyncStorage.setItem(
      'airaware.environment-cache.v1',
      JSON.stringify({
        metadata: {
          version: 1,
          savedAt: '2026-08-01T12:00:00Z',
          stale: false,
        },
        data: {
          provider: 'open-meteo',
          coordinates: { latitude: '50', longitude: 14 },
          current: {},
          hourly: [],
          forecastDays: [],
          metadata: {},
        },
      }),
    );

    await expect(loadEnvironmentCache()).resolves.toBeNull();
  });

  it('loads older valid environment caches without extended environmental data', async () => {
    await AsyncStorage.setItem(
      'airaware.environment-cache.v1',
      JSON.stringify({
        metadata: {
          version: 1,
          savedAt: '2026-08-01T12:00:00Z',
          stale: false,
        },
        data: {
          provider: 'open-meteo',
          coordinates: { latitude: 50, longitude: 14 },
          placeName: 'Prague',
          fetchedAt: '2026-08-01T12:00:00Z',
          current: {
            timestamp: '2026-08-01T12:00',
            pollen: {
              alder: null,
              birch: null,
              grass: 20,
              mugwort: null,
              olive: null,
              ragweed: null,
            },
            regulatedPollutants: {
              pm25: 8,
              pm10: 12,
              nitrogenDioxide: 10,
              ozone: 40,
              sulphurDioxide: 2,
            },
            pollutantAqi: {
              pm25: 18,
              pm10: 20,
              nitrogenDioxide: 10,
              ozone: 40,
              sulphurDioxide: 2,
            },
            aqiLabel: 'EU AQI',
            atmosphericIrritants: {
              carbonMonoxide: 300,
              aerosolOpticalDepth: 0.15,
              dust: 12,
              wildfirePm10: null,
            },
            weather: {
              temperature: 20,
              relativeHumidity: 70,
              dewPoint: 14,
              precipitation: 0,
              windSpeed: 5,
              windDirection: 180,
              windGusts: 28,
              visibility: 14000,
              leafWetnessProbability: 40,
            },
            moldPotential: {
              available: true,
              score: 50,
              displayScore: 50,
              category: 'moderate',
              completeness: 1,
              confidence: 1,
              components: {},
              missingComponents: [],
            },
            uvIndex: 7,
          },
          hourly: [],
          forecastDays: [],
          metadata: {
            timezone: 'Europe/Prague',
            airQualityFetchedAt: '2026-08-01T12:00:00Z',
            weatherFetchedAt: '2026-08-01T12:00:00Z',
            airQualitySource: 'fresh',
            weatherSource: 'fresh',
            partial: false,
          },
        },
      }),
    );

    const cache = await loadEnvironmentCache();

    expect(cache?.data.current.extended?.airQuality).toEqual({
      carbonDioxide: null,
      ammonia: null,
      methane: null,
      nitrogenMonoxide: null,
      formaldehyde: null,
      nonMethaneVolatileOrganicCompounds: null,
    });
    expect(cache?.data.current.extended?.weather.pressureMsl).toBeNull();
  });

  it('persists risk notification transition baseline state', async () => {
    await saveRiskNotificationTransitionState({
      version: 1,
      previousCategory: 'moderate',
      previousScoreType: 'environmental',
      locationKey: '50.076,14.438',
      profileFingerprint: null,
      lastObservationKey: '2026-08-01T12:00:00Z|2026-08-01T14:00:00+02:00',
      lastDeliveredObservationKey: null,
      evaluatedAt: '2026-08-01T12:00:00Z',
    });

    await expect(loadRiskNotificationTransitionState()).resolves.toMatchObject({
      previousCategory: 'moderate',
      previousScoreType: 'environmental',
      locationKey: '50.076,14.438',
    });
  });

  it('rejects invalid risk notification transition baseline state', async () => {
    await AsyncStorage.setItem(
      'airaware.risk-notification-transition.v1',
      JSON.stringify({
        version: 1,
        previousCategory: 'unavailable',
        previousScoreType: 'environmental',
        locationKey: '50.076,14.438',
        profileFingerprint: null,
        evaluatedAt: '2026-08-01T12:00:00Z',
      }),
    );

    await expect(loadRiskNotificationTransitionState()).resolves.toBeNull();
  });

  it('rejects incompatible risk notification transition schema versions', async () => {
    await AsyncStorage.setItem(
      'airaware.risk-notification-transition.v1',
      JSON.stringify({
        version: 999,
        previousCategory: 'high',
        previousScoreType: 'environmental',
        locationKey: '50.076,14.438',
        profileFingerprint: null,
        lastObservationKey: '2026-08-01T12:00:00Z|2026-08-01T14:00:00+02:00',
        lastDeliveredObservationKey: null,
        evaluatedAt: '2026-08-01T12:00:00Z',
      }),
    );

    await expect(loadRiskNotificationTransitionState()).resolves.toBeNull();
  });
});

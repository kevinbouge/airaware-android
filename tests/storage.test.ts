import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  loadEnvironmentCache,
  loadBillingEntitlementCache,
  loadDataDetailCache,
  loadProfile,
  loadRiskNotificationTransitionState,
  loadSettings,
  loadWidgetSnapshot,
  saveRiskNotificationTransitionState,
  saveBillingEntitlementCache,
  saveSettings,
  saveWidgetSnapshot,
} from '../src/storage/storage';
import { PRO_LIFETIME_ENTITLEMENT } from '../src/capabilities/entitlements';
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
        nearbyVegetationRadiusMeters: 3000,
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
    expect(settings.nearbyVegetationRadiusMeters).toBe(
      DEFAULT_SETTINGS.nearbyVegetationRadiusMeters,
    );
    expect('outdoorWindowDurationHours' in settings).toBe(false);
    expect('headlineScore' in settings).toBe(false);
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

  it('persists and validates widget snapshots separately from the environment cache', async () => {
    await saveWidgetSnapshot({
      version: 1,
      generatedAt: '2026-08-01T12:00:00Z',
      entitlementKind: 'free',
      compactAvailable: true,
      advancedAvailable: false,
      forecastDayLimit: 3,
      placeName: 'Prague',
      showPlaceName: true,
      stale: false,
      lastUpdatedAt: '2026-08-01T12:00:00Z',
      headlineScore: {
        type: 'environmental',
        label: 'Environmental burden',
        category: 'high',
        categoryLabel: 'High',
        score: 68,
        scoreLabel: '68%',
      },
      mainFactorLabel: 'Grass pollen',
      uvCategoryLabel: 'High',
      bestOutdoorWindowLabel: '19:00–21:00',
      forecastDays: [
        {
          label: 'Today',
          category: 'high',
          categoryLabel: 'High',
          scoreLabel: '68%',
        },
      ],
    });

    await expect(loadWidgetSnapshot()).resolves.toMatchObject({
      version: 1,
      data: {
        placeName: 'Prague',
        headlineScore: {
          categoryLabel: 'High',
        },
      },
    });
  });

  it('rejects corrupt widget snapshots', async () => {
    await AsyncStorage.setItem(
      'airaware.widget-snapshot.v1',
      JSON.stringify({
        version: 1,
        savedAt: '2026-08-01T12:00:00Z',
        data: {
          version: 1,
          generatedAt: '2026-08-01T12:00:00Z',
          entitlementKind: 'free',
          compactAvailable: true,
          advancedAvailable: false,
          forecastDayLimit: 3,
          placeName: { raw: 'Prague' },
          showPlaceName: true,
          stale: false,
          lastUpdatedAt: null,
          headlineScore: null,
          mainFactorLabel: null,
          uvCategoryLabel: null,
          bestOutdoorWindowLabel: null,
          forecastDays: [],
        },
      }),
    );

    await expect(loadWidgetSnapshot()).resolves.toBeNull();
  });

  it('persists and rejects invalid data detail timeline caches', async () => {
    await AsyncStorage.setItem(
      'airaware.data-detail-cache.v1:50.08,14.44:pm25:24h:2026-08-10',
      JSON.stringify({
        version: 1,
        savedAt: '2026-08-10T12:00:00Z',
        cacheKey: '50.08,14.44:pm25:24h:2026-08-10',
        data: {
          variableId: 'pm25',
          rangeId: '24h',
          generatedAt: '2026-08-10T12:00:00Z',
          coordinates: { latitude: 50.0755, longitude: 14.4378 },
          timezone: 'Europe/Prague',
          granularity: 'hourly',
          historyAvailable: true,
          forecastAvailable: true,
          partial: false,
          now: '2026-08-10T12:00:00Z',
          nowOffsetRatio: 0.5,
          points: [
            {
              id: 'history:2026-08-10T11:00:00Z',
              startTime: '2026-08-10T11:00:00Z',
              endTime: '2026-08-10T12:00:00Z',
              label: '2026-08-10 11:00',
              value: 8,
              source: 'history',
            },
          ],
          domain: { min: 0, max: 8 },
          summary: {
            current: null,
            minimum: 8,
            maximum: 8,
            average: 8,
          },
          error: null,
        },
      }),
    );

    await expect(loadDataDetailCache('50.08,14.44:pm25:24h:2026-08-10')).resolves.toMatchObject({
      data: { variableId: 'pm25', forecastTruncated: false, points: [{ value: 8 }] },
    });

    await AsyncStorage.setItem(
      'airaware.data-detail-cache.v1:bad',
      JSON.stringify({
        version: 1,
        savedAt: '2026-08-10T12:00:00Z',
        cacheKey: 'bad',
        data: {
          variableId: 'pm25',
          rangeId: '24h',
          coordinates: { latitude: '50', longitude: 14 },
        },
      }),
    );

    await expect(loadDataDetailCache('bad')).resolves.toBeNull();
  });

  it('persists only normalized billing entitlement cache metadata', async () => {
    await saveBillingEntitlementCache({
      version: 1,
      entitlement: PRO_LIFETIME_ENTITLEMENT,
      verifiedAt: '2026-08-03T10:00:00.000Z',
      source: 'revenuecat',
    });

    await expect(loadBillingEntitlementCache()).resolves.toMatchObject({
      entitlement: PRO_LIFETIME_ENTITLEMENT,
      verifiedAt: '2026-08-03T10:00:00.000Z',
      source: 'revenuecat',
    });
  });

  it('rejects invalid billing entitlement cache metadata', async () => {
    await AsyncStorage.setItem(
      'airaware.billing-entitlement-cache.v1',
      JSON.stringify({
        version: 1,
        entitlement: { kind: 'pro_lifetime' },
        verifiedAt: 'not-a-date',
        purchaseToken: 'must-not-be-stored',
        source: 'revenuecat',
      }),
    );

    await expect(loadBillingEntitlementCache()).resolves.toBeNull();
  });
});

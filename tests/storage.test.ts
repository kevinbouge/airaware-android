import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  loadEnvironmentCache,
  loadProfile,
  loadSettings,
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
});

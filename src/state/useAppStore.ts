import { Share } from 'react-native';
import { create } from 'zustand';
import { fetchAirQuality } from '../api/openMeteoAirQuality';
import { fetchWeather } from '../api/openMeteoWeather';
import { CACHE_SCHEMA_VERSION, CACHE_STALE_AFTER_MS } from '../core/constants';
import { buildDailySummary, formatDailySummary } from '../core/dailySummary';
import type { LocationInfo, NormalizedEnvironment } from '../models/environment';
import {
  DEFAULT_PROFILE,
  DEFAULT_SETTINGS,
  type AppSettings,
  type PersonalAllergyProfile,
} from '../models/profile';
import { deriveEnvironmentState } from './derivedEnvironment';
import { parseManualCoordinates, resolveLocation } from '../services/locationService';
import { assembleEnvironment } from '../services/environmentAssembler';
import { cacheForCoordinates } from '../services/cacheCompatibility';
import {
  loadEnvironmentCache,
  loadProfile,
  loadSettings,
  saveEnvironmentCache,
  saveProfile,
  saveSettings,
} from '../storage/storage';
import { settingsForProfileState } from './settingsPolicy';

interface AppStore {
  hydrated: boolean;
  loading: boolean;
  sharing: boolean;
  stale: boolean;
  error: string | null;
  shareMessage: string | null;
  location: LocationInfo;
  settings: AppSettings;
  profile: PersonalAllergyProfile;
  environment: NormalizedEnvironment | null;
  hydrate: () => Promise<void>;
  refresh: () => Promise<void>;
  updateSettings: (settings: Partial<AppSettings>) => Promise<void>;
  updateProfile: (profile: Partial<PersonalAllergyProfile>) => Promise<void>;
  toggleProfileFactor: (factor: keyof PersonalAllergyProfile['factors']) => Promise<void>;
  shareDailySummary: () => Promise<void>;
}

const emptyLocation: LocationInfo = {
  coordinates: null,
  placeName: null,
  mode: 'automatic',
  permissionStatus: 'unknown',
};

function staleFrom(savedAt: string | null): boolean {
  if (!savedAt) return false;
  return Date.now() - Date.parse(savedAt) > CACHE_STALE_AFTER_MS;
}

async function persistSuccessfulEnvironment(environment: NormalizedEnvironment) {
  await saveEnvironmentCache({
    metadata: {
      version: CACHE_SCHEMA_VERSION,
      savedAt: new Date().toISOString(),
      stale: false,
    },
    data: environment,
  });
}

let settingsSaveQueue = Promise.resolve();
let profileSaveQueue = Promise.resolve();
let pendingSettings: AppSettings | null = null;
let settingsSaveTimeout: ReturnType<typeof setTimeout> | null = null;

function scheduleSettingsSave(settings: AppSettings): void {
  pendingSettings = settings;
  if (settingsSaveTimeout) {
    clearTimeout(settingsSaveTimeout);
  }

  settingsSaveTimeout = setTimeout(() => {
    const settingsToSave = pendingSettings;
    pendingSettings = null;
    settingsSaveTimeout = null;

    if (!settingsToSave) return;

    settingsSaveQueue = settingsSaveQueue
      .catch((error) => console.warn('AirAware: previous settings save failed', error))
      .then(() => saveSettings(settingsToSave))
      .catch((error) => console.warn('AirAware: settings save failed', error));
  }, 300);
}

function enqueueProfileSave(profile: PersonalAllergyProfile): Promise<void> {
  profileSaveQueue = profileSaveQueue
    .catch((error) => console.warn('AirAware: previous profile save failed', error))
    .then(() => saveProfile(profile));
  return profileSaveQueue;
}

export const useAppStore = create<AppStore>((set, get) => ({
  hydrated: false,
  loading: false,
  sharing: false,
  stale: false,
  error: null,
  shareMessage: null,
  location: emptyLocation,
  settings: DEFAULT_SETTINGS,
  profile: DEFAULT_PROFILE,
  environment: null,

  hydrate: async () => {
    const [storedSettings, profile, cache] = await Promise.all([
      loadSettings(),
      loadProfile(),
      loadEnvironmentCache(),
    ]);
    const settings = settingsForProfileState(storedSettings, profile);
    const environment = cache?.data ?? null;

    if (settings !== storedSettings) {
      scheduleSettingsSave(settings);
    }

    set({
      hydrated: true,
      settings,
      profile,
      environment,
      stale: staleFrom(cache?.metadata.savedAt ?? null),
      location: environment
        ? {
            coordinates: environment.coordinates,
            placeName: environment.placeName,
            mode: settings.locationMode,
            permissionStatus: 'unknown',
          }
        : emptyLocation,
    });
  },

  refresh: async () => {
    if (get().loading) return;

    set({ loading: true, error: null, shareMessage: null });
    const settings = get().settings;
    const cached = get().environment;

    try {
      const location = await resolveLocation(settings);

      if (!location.coordinates) {
        throw new Error('Location is unavailable. Add manual coordinates in Settings.');
      }

      const cachedForLocation = cacheForCoordinates(cached, location.coordinates);

      const [airResult, weatherResult] = await Promise.allSettled([
        fetchAirQuality(location.coordinates),
        fetchWeather(location.coordinates),
      ]);
      const airQuality = airResult.status === 'fulfilled' ? airResult.value : null;
      const weather = weatherResult.status === 'fulfilled' ? weatherResult.value : null;

      if (!airQuality && !weather && !cachedForLocation) {
        throw new Error('Open-Meteo data is unavailable.');
      }

      const environment = assembleEnvironment({
        coordinates: location.coordinates,
        placeName: location.placeName,
        airQuality,
        weather,
        fallback: cachedForLocation,
      });

      await persistSuccessfulEnvironment(environment);
      set({
        loading: false,
        stale: airQuality === null || weather === null,
        location,
        environment,
      });
    } catch (error) {
      console.warn('AirAware: refresh failed', error);
      const cache = await loadEnvironmentCache();
      const requestedCoordinates =
        settings.locationMode === 'manual' ? parseManualCoordinates(settings) : null;
      const environment =
        cacheForCoordinates(cache?.data ?? null, requestedCoordinates) ??
        cacheForCoordinates(cached, requestedCoordinates) ??
        (requestedCoordinates ? null : (cache?.data ?? cached));

      set({
        loading: false,
        stale: environment !== null,
        error: environment
          ? requestedCoordinates
            ? 'Showing cached environmental data.'
            : 'Showing cached environmental data. Current location could not be verified.'
          : 'No environmental data is available.',
        environment: environment ?? null,
      });
    }
  },

  updateSettings: async (settingsPatch) => {
    const settings = settingsForProfileState(
      { ...get().settings, ...settingsPatch },
      get().profile,
    );
    set({ settings });
    scheduleSettingsSave(settings);
  },

  updateProfile: async (profilePatch) => {
    const profile = { ...get().profile, ...profilePatch };
    const currentSettings = get().settings;
    const settings = settingsForProfileState(currentSettings, profile);
    set({ profile, settings });
    if (settings !== currentSettings) {
      scheduleSettingsSave(settings);
    }
    await enqueueProfileSave(profile);
  },

  toggleProfileFactor: async (factor) => {
    const profile = get().profile;
    const nextProfile = {
      ...profile,
      factors: {
        ...profile.factors,
        [factor]: !profile.factors[factor],
      },
    };
    set({ profile: nextProfile });
    await enqueueProfileSave(nextProfile);
  },

  shareDailySummary: async () => {
    set({ sharing: true, shareMessage: null });
    const derived = deriveEnvironmentState(
      get().environment,
      get().profile,
      get().settings.outdoorWindowDurationHours,
    );
    const summary = buildDailySummary({
      environment: get().environment,
      personalizedScore: derived.personalizedScore,
      bestOutdoorWindow: derived.bestOutdoorWindow,
      settings: get().settings,
      stale: get().stale,
    });

    if (!summary) {
      set({ sharing: false, shareMessage: 'No environmental data is available to share.' });
      return;
    }

    try {
      await Share.share({ message: formatDailySummary(summary) });
      set({ sharing: false, shareMessage: null });
    } catch (error) {
      console.warn('AirAware: native share failed', error);
      set({ sharing: false, shareMessage: 'Could not open the share sheet.' });
    }
  },
}));

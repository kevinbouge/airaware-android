import { Share } from 'react-native';
import { create } from 'zustand';
import { capabilitiesForEntitlement } from '../capabilities/config';
import { FREE_ENTITLEMENT, type EntitlementState } from '../capabilities/entitlements';
import { isFeatureAvailable } from '../capabilities/features';
import { isEnvironmentalVariableAvailable } from '../capabilities/variables';
import { CACHE_SCHEMA_VERSION, CACHE_STALE_AFTER_MS } from '../core/constants';
import {
  buildDailySummary,
  formatDailySummary,
  selectDailySummaryOutdoorWindow,
} from '../core/dailySummary';
import { buildWidgetSnapshot } from '../core/widgetSnapshot';
import {
  evaluateRiskTransition,
  formatRiskTransitionNotification,
  riskNotificationObservationKey,
  riskTransitionStateAfterDeliveryAttempt,
} from '../core/riskTransitionNotifications';
import type { LocationInfo, NormalizedEnvironment } from '../models/environment';
import type {
  NotificationPermissionStatus,
  RiskNotificationTransitionState,
} from '../models/notifications';
import {
  DEFAULT_PROFILE,
  DEFAULT_SETTINGS,
  type AppSettings,
  type PersonalAllergyProfile,
} from '../models/profile';
import { deriveEnvironmentState } from './derivedEnvironment';
import { parseManualCoordinates, resolveLocation } from '../services/locationService';
import { assembleEnvironment } from '../services/environmentAssembler';
import { activeEnvironmentalProvider } from '../services/environmentProviders';
import { createBillingGateway } from '../services/billingGateway';
import { cacheForCoordinates } from '../services/cacheCompatibility';
import {
  loadEnvironmentCache,
  loadProfile,
  loadRiskNotificationTransitionState,
  loadSettings,
  saveWidgetSnapshot,
  saveEnvironmentCache,
  saveProfile,
  saveRiskNotificationTransitionState,
  saveSettings,
} from '../storage/storage';
import { saveWidgetSnapshotToNative } from '../services/widgetNativeModule';
import {
  deliverRiskTransitionNotification,
  deliverRiskTestNotification,
  getRiskNotificationPermissionStatus,
  openSystemNotificationSettings,
  requestRiskNotificationPermission,
} from '../services/notificationService';
import { settingsForProfileState } from './settingsPolicy';

interface AppStore {
  hydrated: boolean;
  loading: boolean;
  sharing: boolean;
  stale: boolean;
  error: string | null;
  shareMessage: string | null;
  notificationMessage: string | null;
  notificationPermissionStatus: NotificationPermissionStatus;
  location: LocationInfo;
  settings: AppSettings;
  profile: PersonalAllergyProfile;
  entitlement: EntitlementState;
  environment: NormalizedEnvironment | null;
  riskNotificationTransitionState: RiskNotificationTransitionState | null;
  hydrate: () => Promise<void>;
  refresh: () => Promise<void>;
  updateSettings: (settings: Partial<AppSettings>) => Promise<void>;
  updateProfile: (profile: Partial<PersonalAllergyProfile>) => Promise<void>;
  toggleProfileFactor: (factor: keyof PersonalAllergyProfile['factors']) => Promise<void>;
  shareDailySummary: () => Promise<void>;
  sendTestRiskNotification: () => Promise<void>;
  openNotificationSettings: () => Promise<void>;
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

async function persistWidgetSnapshotFor(input: {
  environment: NormalizedEnvironment | null;
  profile: PersonalAllergyProfile;
  settings: AppSettings;
  entitlement: EntitlementState;
  stale: boolean;
}): Promise<void> {
  const capabilities = capabilitiesForEntitlement(input.entitlement);
  const derived = deriveEnvironmentState(
    input.environment,
    input.profile,
    input.settings.outdoorWindowDurationHours,
    capabilities,
  );
  const snapshot = buildWidgetSnapshot({
    environment: input.environment,
    derived,
    settings: input.settings,
    capabilities,
    entitlement: input.entitlement,
    stale: input.stale,
  });

  await saveWidgetSnapshot(snapshot);
  await saveWidgetSnapshotToNative(snapshot);
}

let settingsSaveQueue = Promise.resolve();
let profileSaveQueue = Promise.resolve();
let pendingSettings: AppSettings | null = null;
let settingsSaveTimeout: ReturnType<typeof setTimeout> | null = null;

function enqueueSettingsSave(settings: AppSettings): Promise<void> {
  settingsSaveQueue = settingsSaveQueue
    .catch((error) => console.warn('AirAware: previous settings save failed', error))
    .then(() => saveSettings(settings))
    .catch((error) => console.warn('AirAware: settings save failed', error));
  return settingsSaveQueue;
}

export function flushPendingSettingsSave(): Promise<void> {
  if (settingsSaveTimeout) {
    clearTimeout(settingsSaveTimeout);
    settingsSaveTimeout = null;
  }

  const settingsToSave = pendingSettings;
  pendingSettings = null;

  if (!settingsToSave) {
    return settingsSaveQueue;
  }

  return enqueueSettingsSave(settingsToSave);
}

function scheduleSettingsSave(settings: AppSettings): void {
  pendingSettings = settings;
  if (settingsSaveTimeout) {
    clearTimeout(settingsSaveTimeout);
  }

  settingsSaveTimeout = setTimeout(() => {
    settingsSaveTimeout = null;
    void flushPendingSettingsSave();
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
  notificationMessage: null,
  notificationPermissionStatus: 'unknown',
  location: emptyLocation,
  settings: DEFAULT_SETTINGS,
  profile: DEFAULT_PROFILE,
  entitlement: FREE_ENTITLEMENT,
  environment: null,
  riskNotificationTransitionState: null,

  hydrate: async () => {
    const billingGateway = createBillingGateway();
    const [storedSettings, profile, cache, entitlement, notificationState] = await Promise.all([
      loadSettings(),
      loadProfile(),
      loadEnvironmentCache(),
      billingGateway.currentEntitlement(),
      loadRiskNotificationTransitionState(),
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
      entitlement,
      environment,
      riskNotificationTransitionState: notificationState,
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

    if (environment) {
      await persistWidgetSnapshotFor({
        environment,
        profile,
        settings,
        entitlement,
        stale: staleFrom(cache?.metadata.savedAt ?? null),
      });
    }
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
      const capabilities = capabilitiesForEntitlement(get().entitlement);
      const provider = activeEnvironmentalProvider(capabilities);

      const [airResult, weatherResult] = await Promise.allSettled([
        provider.fetchAirQuality(location.coordinates),
        provider.fetchWeather(location.coordinates),
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
      const derived = deriveEnvironmentState(
        environment,
        get().profile,
        settings.outdoorWindowDurationHours,
        capabilities,
      );
      const canNotify = isFeatureAvailable(capabilities, 'basic_transition_notifications');
      const permissionStatus =
        canNotify && settings.riskTransitionNotificationsEnabled
          ? await getRiskNotificationPermissionStatus()
          : get().notificationPermissionStatus;
      const transitionEvaluation = canNotify
        ? evaluateRiskTransition({
            settings,
            capabilityAvailable: canNotify,
            permissionStatus,
            environmentalScore: derived.environmentalScore,
            personalizedScore: derived.personalizedScore,
            previousState: get().riskNotificationTransitionState,
            coordinates: environment.coordinates,
            placeName: environment.placeName,
            profile: get().profile,
            observationKey: riskNotificationObservationKey({
              fetchedAt: environment.fetchedAt,
              currentTimestamp: environment.current.timestamp,
              airQualityFetchedAt: environment.metadata.airQualityFetchedAt,
              weatherFetchedAt: environment.metadata.weatherFetchedAt,
            }),
            now: new Date().toISOString(),
          })
        : null;

      let delivered = false;
      if (transitionEvaluation?.transition) {
        delivered = await deliverRiskTransitionNotification(
          formatRiskTransitionNotification(transitionEvaluation.transition),
        );
      }
      const nextNotificationState = transitionEvaluation
        ? riskTransitionStateAfterDeliveryAttempt({
            nextState: transitionEvaluation.nextState,
            previousState: get().riskNotificationTransitionState,
            transition: transitionEvaluation.transition,
            delivered,
          })
        : null;

      if (nextNotificationState) {
        await saveRiskNotificationTransitionState(nextNotificationState);
      }
      const nextStale = airQuality === null || weather === null;
      await persistWidgetSnapshotFor({
        environment,
        profile: get().profile,
        settings,
        entitlement: get().entitlement,
        stale: nextStale,
      });

      set({
        loading: false,
        stale: nextStale,
        location,
        environment,
        notificationPermissionStatus: permissionStatus,
        riskNotificationTransitionState:
          nextNotificationState ?? get().riskNotificationTransitionState,
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
    const capabilities = capabilitiesForEntitlement(get().entitlement);
    const currentSettings = get().settings;
    let notificationPermissionStatus = get().notificationPermissionStatus;
    let notificationMessage: string | null = null;
    let normalizedPatch = settingsPatch;

    if (
      settingsPatch.riskTransitionNotificationsEnabled === true &&
      currentSettings.riskTransitionNotificationsEnabled !== true
    ) {
      if (!isFeatureAvailable(capabilities, 'basic_transition_notifications')) {
        normalizedPatch = { ...settingsPatch, riskTransitionNotificationsEnabled: false };
        notificationMessage = 'Risk transition notifications are unavailable in this build.';
      } else if (notificationPermissionStatus === 'denied') {
        notificationPermissionStatus = await getRiskNotificationPermissionStatus();
        if (notificationPermissionStatus === 'granted') {
          normalizedPatch = { ...settingsPatch, riskTransitionNotificationsEnabled: true };
        } else {
          normalizedPatch = { ...settingsPatch, riskTransitionNotificationsEnabled: false };
          notificationMessage =
            'Notification permission is denied. Open Android settings to allow notifications.';
        }
      } else {
        notificationPermissionStatus = await requestRiskNotificationPermission();

        if (notificationPermissionStatus !== 'granted') {
          normalizedPatch = { ...settingsPatch, riskTransitionNotificationsEnabled: false };
          notificationMessage =
            notificationPermissionStatus === 'denied'
              ? 'Notification permission was denied. You can retry from Settings.'
              : 'Notifications are unavailable on this device.';
        }
      }
    }

    if (settingsPatch.riskTransitionNotificationsEnabled === false) {
      notificationMessage = null;
    }

    const settings = settingsForProfileState(
      { ...currentSettings, ...normalizedPatch },
      get().profile,
    );
    set({ settings });
    set({ notificationPermissionStatus, notificationMessage });
    scheduleSettingsSave(settings);
    void persistWidgetSnapshotFor({
      environment: get().environment,
      profile: get().profile,
      settings,
      entitlement: get().entitlement,
      stale: get().stale,
    });
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
    await persistWidgetSnapshotFor({
      environment: get().environment,
      profile,
      settings,
      entitlement: get().entitlement,
      stale: get().stale,
    });
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
    await persistWidgetSnapshotFor({
      environment: get().environment,
      profile: nextProfile,
      settings: get().settings,
      entitlement: get().entitlement,
      stale: get().stale,
    });
  },

  shareDailySummary: async () => {
    const capabilities = capabilitiesForEntitlement(get().entitlement);

    if (!isFeatureAvailable(capabilities, 'daily_summary')) {
      set({ sharing: false, shareMessage: 'Daily summary sharing is unavailable.' });
      return;
    }

    set({ sharing: true, shareMessage: null });
    const derived = deriveEnvironmentState(
      get().environment,
      get().profile,
      get().settings.outdoorWindowDurationHours,
      capabilities,
    );
    const bestOutdoorWindow = selectDailySummaryOutdoorWindow({
      settings: get().settings,
      personalizedScore: derived.personalizedScore,
      environmentalBestOutdoorWindow: derived.environmentalBestOutdoorWindow,
      personalizedBestOutdoorWindow: derived.personalizedBestOutdoorWindow,
    });
    const summary = buildDailySummary({
      environment: get().environment,
      personalizedScore: derived.personalizedScore,
      bestOutdoorWindow,
      settings: get().settings,
      stale: get().stale,
      includeUvPeak: isEnvironmentalVariableAvailable(capabilities, 'uvIndex'),
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

  sendTestRiskNotification: async () => {
    const permissionStatus = await getRiskNotificationPermissionStatus();
    set({ notificationPermissionStatus: permissionStatus, notificationMessage: null });

    if (permissionStatus !== 'granted') {
      set({
        notificationMessage:
          permissionStatus === 'denied'
            ? 'Notification permission is denied. Open Android settings to allow notifications.'
            : 'Enable notification permission before sending a test notification.',
      });
      return;
    }

    const delivered = await deliverRiskTestNotification();
    set({
      notificationMessage: delivered
        ? 'Test notification sent.'
        : 'Could not send the test notification.',
    });
  },

  openNotificationSettings: async () => {
    const opened = await openSystemNotificationSettings();
    set({
      notificationMessage: opened
        ? 'Android notification settings opened.'
        : 'Could not open Android notification settings.',
    });
  },
}));

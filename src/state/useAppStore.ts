import { Share } from 'react-native';
import { create } from 'zustand';
import { capabilitiesForEntitlement } from '../capabilities/config';
import {
  FREE_ENTITLEMENT,
  PRO_LIFETIME_ENTITLEMENT,
  entitlementForBuild,
  type EntitlementKind,
  type EntitlementState,
} from '../capabilities/entitlements';
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
import type { BillingState } from '../models/billing';
import { UNCONFIGURED_BILLING_STATE } from '../models/billing';
import type {
  NotificationPermissionStatus,
  RiskNotificationTransitionState,
} from '../models/notifications';
import type { NormalizedVegetationContext } from '../models/vegetation';
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
import { fetchVegetationContext } from '../api/openStreetMapVegetation';
import { createBillingGateway } from '../services/billingGateway';
import { cacheForActivityDomains, cacheForCoordinates } from '../services/cacheCompatibility';
import {
  vegetationCacheEnvelope,
  vegetationCacheExpired,
  vegetationCacheForRequest,
} from '../services/vegetationCache';
import {
  loadEnvironmentCache,
  loadDevelopmentEntitlementOverride,
  saveDevelopmentEntitlementOverride,
  loadProfile,
  loadRiskNotificationTransitionState,
  loadSettings,
  loadVegetationCache,
  saveWidgetSnapshot,
  saveEnvironmentCache,
  saveProfile,
  saveRiskNotificationTransitionState,
  saveSettings,
  saveVegetationCache,
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
import { shouldRefreshAfterLocationSettingsChange } from './appLifecycle';
import { enabledActivityIds } from '../core/activityDefinitions';

interface AppStore {
  hydrated: boolean;
  loading: boolean;
  sharing: boolean;
  stale: boolean;
  error: string | null;
  shareMessage: string | null;
  notificationMessage: string | null;
  billingMessage: string | null;
  notificationPermissionStatus: NotificationPermissionStatus;
  location: LocationInfo;
  settings: AppSettings;
  profile: PersonalAllergyProfile;
  entitlement: EntitlementState;
  billingState: BillingState;
  developmentEntitlementOverride: EntitlementState | null;
  environment: NormalizedEnvironment | null;
  vegetation: NormalizedVegetationContext | null;
  vegetationStale: boolean;
  vegetationLoading: boolean;
  vegetationError: string | null;
  riskNotificationTransitionState: RiskNotificationTransitionState | null;
  hydrate: () => Promise<void>;
  refresh: () => Promise<void>;
  updateSettings: (settings: Partial<AppSettings>) => Promise<void>;
  toggleCollapsedSection: (sectionId: string) => Promise<void>;
  updateProfile: (profile: Partial<PersonalAllergyProfile>) => Promise<void>;
  toggleProfileFactor: (factor: keyof PersonalAllergyProfile['factors']) => Promise<void>;
  shareDailySummary: () => Promise<void>;
  sendTestRiskNotification: () => Promise<void>;
  openNotificationSettings: () => Promise<void>;
  purchaseProLifetime: () => Promise<void>;
  restorePurchases: () => Promise<void>;
  refreshBilling: () => Promise<void>;
  setDevelopmentEntitlement: (kind: EntitlementKind | null) => Promise<void>;
  refreshVegetation: (force?: boolean) => Promise<void>;
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
  const derived = deriveEnvironmentState(input.environment, input.profile, capabilities);
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

async function loadCachedVegetationFor(input: {
  coordinates: NormalizedEnvironment['coordinates'] | null;
  radiusMeters: AppSettings['nearbyVegetationRadiusMeters'];
}): Promise<{
  vegetation: NormalizedVegetationContext | null;
  stale: boolean;
}> {
  if (!input.coordinates) return { vegetation: null, stale: false };

  const cache = vegetationCacheForRequest(
    await loadVegetationCache(),
    input.coordinates,
    input.radiusMeters,
  );

  return {
    vegetation: cache?.data ?? null,
    stale: cache ? vegetationCacheExpired(cache) : false,
  };
}

let settingsSaveQueue = Promise.resolve();
let profileSaveQueue = Promise.resolve();
let settingsUpdateQueue = Promise.resolve();
let pendingSettings: AppSettings | null = null;
let settingsSaveTimeout: ReturnType<typeof setTimeout> | null = null;
let pendingRefresh = false;
const billingGateway = createBillingGateway();
let unsubscribeBillingGateway: (() => void) | null = null;

function effectiveBillingState(
  billingState: BillingState,
  developmentOverride: EntitlementState | null,
): BillingState {
  const entitlement = entitlementForBuild({
    storedEntitlement: billingState.entitlement,
    developmentOverride,
    isProduction: !__DEV__,
  });

  if (__DEV__ && developmentOverride !== null) {
    return {
      ...billingState,
      entitlement,
      entitlementSource: 'development_preview',
      entitlementStatus: entitlement.kind === 'pro_lifetime' ? 'pro' : 'free',
      proActive: entitlement.kind === 'pro_lifetime',
    };
  }

  return {
    ...billingState,
    entitlement,
    proActive: entitlement.kind === 'pro_lifetime',
  };
}

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

export function disposeAppStoreResources(): void {
  unsubscribeBillingGateway?.();
  unsubscribeBillingGateway = null;
  billingGateway.dispose();
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

function enabledProviderActivities(settings: AppSettings, entitlement: EntitlementState) {
  const capabilities = capabilitiesForEntitlement(entitlement);
  if (!capabilities.activities.available) return [];

  const allowed = new Set(capabilities.activities.availableActivities);
  return enabledActivityIds(settings.enabledActivities).filter((activityId) =>
    allowed.has(activityId),
  );
}

function entitlementChanged(previous: EntitlementState, next: EntitlementState): boolean {
  return previous.kind !== next.kind;
}

export const useAppStore = create<AppStore>((set, get) => ({
  hydrated: false,
  loading: false,
  sharing: false,
  stale: false,
  error: null,
  shareMessage: null,
  notificationMessage: null,
  billingMessage: null,
  notificationPermissionStatus: 'unknown',
  location: emptyLocation,
  settings: DEFAULT_SETTINGS,
  profile: DEFAULT_PROFILE,
  entitlement: FREE_ENTITLEMENT,
  billingState: UNCONFIGURED_BILLING_STATE,
  developmentEntitlementOverride: null,
  environment: null,
  vegetation: null,
  vegetationStale: false,
  vegetationLoading: false,
  vegetationError: null,
  riskNotificationTransitionState: null,

  hydrate: async () => {
    const [
      storedSettings,
      profile,
      cache,
      rawBillingState,
      developmentOverride,
      notificationState,
    ] = await Promise.all([
      loadSettings(),
      loadProfile(),
      loadEnvironmentCache(),
      billingGateway.initializeBilling(),
      loadDevelopmentEntitlementOverride(),
      loadRiskNotificationTransitionState(),
    ]);
    const billingState = effectiveBillingState(rawBillingState, developmentOverride);
    const entitlement = billingState.entitlement;
    const settings = settingsForProfileState(storedSettings, profile);
    const environment = cache?.data ?? null;
    const cachedVegetation = await loadCachedVegetationFor({
      coordinates: environment?.coordinates ?? null,
      radiusMeters: settings.nearbyVegetationRadiusMeters,
    });

    if (settings !== storedSettings) {
      scheduleSettingsSave(settings);
    }

    set({
      hydrated: true,
      settings,
      profile,
      entitlement,
      billingState,
      developmentEntitlementOverride: developmentOverride,
      environment,
      vegetation: cachedVegetation.vegetation,
      vegetationStale: cachedVegetation.stale,
      vegetationError: null,
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

    if (!unsubscribeBillingGateway) {
      unsubscribeBillingGateway = billingGateway.subscribeToEntitlementChanges(
        (nextBillingState) => {
          const effective = effectiveBillingState(
            nextBillingState,
            get().developmentEntitlementOverride,
          );
          set({
            billingState: effective,
            entitlement: effective.entitlement,
          });
          void persistWidgetSnapshotFor({
            environment: get().environment,
            profile: get().profile,
            settings: get().settings,
            entitlement: effective.entitlement,
            stale: get().stale,
          });
        },
      );
    }

    if (environment) {
      await persistWidgetSnapshotFor({
        environment,
        profile,
        settings,
        entitlement,
        stale: staleFrom(cache?.metadata.savedAt ?? null),
      });
      void get().refreshVegetation(false);
    }
  },

  refresh: async () => {
    if (get().loading) {
      pendingRefresh = true;
      return;
    }

    const runPendingRefresh = () => {
      if (!pendingRefresh) return;

      pendingRefresh = false;
      void get().refresh();
    };

    set({ loading: true, error: null, shareMessage: null });
    const settings = get().settings;
    const cached = get().environment;
    const requestedActivityDomains = enabledProviderActivities(settings, get().entitlement);
    let resolvedLocation: LocationInfo | null = null;

    try {
      const location = await resolveLocation(settings);
      resolvedLocation = location;

      if (!location.coordinates) {
        throw new Error('Location is unavailable. Add manual coordinates in Settings.');
      }

      const cachedForLocation = cacheForCoordinates(cached, location.coordinates);
      const capabilities = capabilitiesForEntitlement(get().entitlement);
      const provider = activeEnvironmentalProvider(capabilities);
      const providerOptions = {
        enabledActivities: requestedActivityDomains,
      };

      const [airResult, weatherResult] = await Promise.allSettled([
        provider.fetchAirQuality(location.coordinates, providerOptions),
        provider.fetchWeather(location.coordinates, providerOptions),
      ]);
      const airQuality = airResult.status === 'fulfilled' ? airResult.value : null;
      const weather = weatherResult.status === 'fulfilled' ? weatherResult.value : null;
      const hasCompleteFreshProviderData = airQuality !== null && weather !== null;
      const hasFreshProviderData = airQuality !== null || weather !== null;

      if (!airQuality && !weather && !cachedForLocation) {
        throw new Error('Open-Meteo data is unavailable.');
      }

      const environment = assembleEnvironment({
        coordinates: location.coordinates,
        placeName: location.placeName,
        airQuality,
        weather,
        fallback: cachedForLocation,
        requestedActivityDomains: hasCompleteFreshProviderData
          ? requestedActivityDomains
          : undefined,
      });

      if (hasCompleteFreshProviderData) {
        await persistSuccessfulEnvironment(environment);
      }

      const derived = deriveEnvironmentState(environment, get().profile, capabilities);
      const canNotify = isFeatureAvailable(capabilities, 'basic_transition_notifications');
      const permissionStatus =
        canNotify && settings.riskTransitionNotificationsEnabled
          ? await getRiskNotificationPermissionStatus()
          : get().notificationPermissionStatus;
      const transitionEvaluation =
        canNotify && hasFreshProviderData
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
      void get().refreshVegetation(false);
      runPendingRefresh();
    } catch (error) {
      console.warn('AirAware: refresh failed', error);
      const cache = await loadEnvironmentCache();
      const fallbackCoordinates =
        settings.locationMode === 'manual'
          ? parseManualCoordinates(settings)
          : (resolvedLocation?.coordinates ?? null);
      const environment = fallbackCoordinates
        ? (cacheForActivityDomains(
            cache?.data ?? null,
            fallbackCoordinates,
            requestedActivityDomains,
          ) ??
          cacheForActivityDomains(cached, fallbackCoordinates, requestedActivityDomains) ??
          cacheForCoordinates(cache?.data ?? null, fallbackCoordinates) ??
          cacheForCoordinates(cached, fallbackCoordinates))
        : null;

      set({
        loading: false,
        stale: environment !== null,
        error: environment
          ? 'Showing cached environmental data.'
          : 'No environmental data is available.',
        environment: environment ?? null,
      });
      runPendingRefresh();
    }
  },

  updateSettings: async (settingsPatch) => {
    settingsUpdateQueue = settingsUpdateQueue
      .catch((error) => console.warn('AirAware: previous settings update failed', error))
      .then(async () => {
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
          { ...get().settings, ...normalizedPatch },
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
        if (settingsPatch.nearbyVegetationRadiusMeters !== undefined) {
          void get().refreshVegetation(true);
        }
        if (settingsPatch.enabledActivities !== undefined) {
          void get().refresh();
        }
        if (
          shouldRefreshAfterLocationSettingsChange({
            previousSettings: currentSettings,
            nextSettings: settings,
          })
        ) {
          void get().refresh();
        }
      });

    return settingsUpdateQueue;
  },

  toggleCollapsedSection: async (sectionId) => {
    settingsUpdateQueue = settingsUpdateQueue
      .catch((error) => console.warn('AirAware: previous settings update failed', error))
      .then(async () => {
        const currentSettings = get().settings;
        const settings = settingsForProfileState(
          {
            ...currentSettings,
            collapsedSections: {
              ...currentSettings.collapsedSections,
              [sectionId]: !currentSettings.collapsedSections[sectionId],
            },
          },
          get().profile,
        );

        set({ settings });
        scheduleSettingsSave(settings);
        void persistWidgetSnapshotFor({
          environment: get().environment,
          profile: get().profile,
          settings,
          entitlement: get().entitlement,
          stale: get().stale,
        });
      });

    return settingsUpdateQueue;
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
    const derived = deriveEnvironmentState(get().environment, get().profile, capabilities);
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

  purchaseProLifetime: async () => {
    const previousEntitlement = get().entitlement;
    const result = await billingGateway.purchaseProLifetime();
    const effective = effectiveBillingState(
      result.billingState,
      get().developmentEntitlementOverride,
    );
    set({
      billingState: effective,
      entitlement: effective.entitlement,
      billingMessage: result.message,
    });
    await persistWidgetSnapshotFor({
      environment: get().environment,
      profile: get().profile,
      settings: get().settings,
      entitlement: effective.entitlement,
      stale: get().stale,
    });
    if (entitlementChanged(previousEntitlement, effective.entitlement)) {
      void get().refresh();
    }
  },

  restorePurchases: async () => {
    const previousEntitlement = get().entitlement;
    const result = await billingGateway.restorePurchases();
    const effective = effectiveBillingState(
      result.billingState,
      get().developmentEntitlementOverride,
    );
    set({
      billingState: effective,
      entitlement: effective.entitlement,
      billingMessage: result.message,
    });
    await persistWidgetSnapshotFor({
      environment: get().environment,
      profile: get().profile,
      settings: get().settings,
      entitlement: effective.entitlement,
      stale: get().stale,
    });
    if (entitlementChanged(previousEntitlement, effective.entitlement)) {
      void get().refresh();
    }
  },

  refreshBilling: async () => {
    const previousEntitlement = get().entitlement;
    const rawBillingState = await billingGateway.refreshEntitlement();
    const effective = effectiveBillingState(rawBillingState, get().developmentEntitlementOverride);
    set({
      billingState: effective,
      entitlement: effective.entitlement,
      billingMessage: effective.error,
    });
    await persistWidgetSnapshotFor({
      environment: get().environment,
      profile: get().profile,
      settings: get().settings,
      entitlement: effective.entitlement,
      stale: get().stale,
    });
    if (entitlementChanged(previousEntitlement, effective.entitlement)) {
      void get().refresh();
    }
  },

  setDevelopmentEntitlement: async (kind) => {
    if (!__DEV__) return;
    const previousEntitlement = get().entitlement;

    let developmentOverride = null;
    if (kind === 'pro_lifetime') {
      developmentOverride = PRO_LIFETIME_ENTITLEMENT;
    } else if (kind === 'free') {
      developmentOverride = FREE_ENTITLEMENT;
    }
    await saveDevelopmentEntitlementOverride(developmentOverride);
    const billingState = effectiveBillingState(
      billingGateway.getBillingState(),
      developmentOverride,
    );
    const entitlement = billingState.entitlement;
    set({
      entitlement,
      billingState,
      developmentEntitlementOverride: developmentOverride,
      billingMessage:
        developmentOverride === null
          ? 'RevenueCat entitlement is active.'
          : 'Development capability preview updated.',
    });
    await persistWidgetSnapshotFor({
      environment: get().environment,
      profile: get().profile,
      settings: get().settings,
      entitlement,
      stale: get().stale,
    });
    if (entitlementChanged(previousEntitlement, entitlement)) {
      void get().refresh();
    }
  },

  refreshVegetation: async (force = false) => {
    const environment = get().environment;
    const coordinates = environment?.coordinates ?? get().location.coordinates;
    const radiusMeters = get().settings.nearbyVegetationRadiusMeters;

    if (!coordinates) {
      set({ vegetation: null, vegetationStale: false, vegetationError: null });
      return;
    }

    const cache = vegetationCacheForRequest(await loadVegetationCache(), coordinates, radiusMeters);
    const cacheExpired = cache ? vegetationCacheExpired(cache) : false;

    if (cache && !cacheExpired && !force) {
      set({
        vegetation: cache.data,
        vegetationStale: false,
        vegetationError: null,
      });
      return;
    }

    if (cache) {
      set({
        vegetation: cache.data,
        vegetationStale: cacheExpired,
        vegetationError: cacheExpired ? 'Showing cached nearby vegetation data.' : null,
      });
    }

    set({ vegetationLoading: true });
    try {
      const vegetation = await fetchVegetationContext(coordinates, radiusMeters);
      await saveVegetationCache(vegetationCacheEnvelope(vegetation));
      set({
        vegetation,
        vegetationStale: false,
        vegetationError: null,
        vegetationLoading: false,
      });
    } catch (error) {
      console.warn('AirAware: nearby vegetation refresh failed', error);
      set({
        vegetation: cache?.data ?? null,
        vegetationStale: cache !== null,
        vegetationError: cache
          ? 'Showing cached nearby vegetation data.'
          : 'Nearby vegetation data is unavailable.',
        vegetationLoading: false,
      });
    }
  },
}));

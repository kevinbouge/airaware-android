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
import { CACHE_SCHEMA_VERSION, ENVIRONMENT_PROVIDER_FRESHNESS_MS } from '../core/constants';
import { airQualityVariableCoverageFor } from '../api/openMeteoAirQuality';
import { weatherVariableCoverageFor } from '../api/openMeteoWeather';
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
import type { HealthSignalsState } from '../models/healthSignals';
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
import {
  CURRENT_LOCATION_ID,
  LEGACY_MANUAL_LOCATION_ID,
  activeSavedLocation,
  coordinatesForSavedLocation,
  currentLocationEntry,
  locationDisplayName,
  type ManualSavedLocation,
} from '../models/location';
import { deriveEnvironmentState } from './derivedEnvironment';
import { resolveActiveLocation, reverseGeocodeLocationMetadata } from '../services/locationService';
import { assembleEnvironment } from '../services/environmentAssembler';
import { activeEnvironmentalProvider } from '../services/environmentProviders';
import { environmentRefreshPolicy } from '../services/environmentRefreshPolicy';
import {
  fetchAirQualityQuery,
  fetchVegetationQuery,
  fetchWeatherQuery,
} from '../services/environmentQueries';
import { createBillingGateway } from '../services/billingGateway';
import { cacheForActivityDomains, cacheForCoordinates } from '../services/cacheCompatibility';
import {
  vegetationCacheEnvelope,
  vegetationCacheExpired,
  vegetationCacheForRequest,
} from '../services/vegetationCache';
import {
  detectEnvironmentalEvents,
  environmentalEventNeedsNotification,
  environmentalEventNotificationStateAfterDelivery,
  formatEnvironmentalEventNotification,
  freshEnvironmentalEventNotificationState,
  staleForecastCanDisplayEvents,
} from '../core/environmentalEvents';
import type {
  EnvironmentalEvent,
  EnvironmentalEventNotificationState,
} from '../models/environmentalEvents';
import {
  loadEnvironmentalEventNotificationState,
  saveEnvironmentalEventNotificationState,
  loadEnvironmentCache,
  loadEnvironmentCacheForCoordinates,
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
import { refreshHealthSignalsForLocation } from '../services/healthSignalService';
import {
  deliverRiskTransitionNotification,
  deliverRiskTestNotification,
  getRiskNotificationPermissionStatus,
  openSystemNotificationSettings,
  requestRiskNotificationPermission,
} from '../services/notificationService';
import { settingsForProfileState } from './settingsPolicy';
import { enabledActivityIds } from '../core/activityDefinitions';
import { setAppLanguagePreference, translate } from '../i18n';
import { millisecondsBetween } from '../utils/time';

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
  environmentalEvents: EnvironmentalEvent[];
  environmentalEventNotificationState: EnvironmentalEventNotificationState | null;
  healthSignals: HealthSignalsState;
  hydrate: () => Promise<void>;
  refresh: (options?: { force?: boolean }) => Promise<void>;
  refreshHealthSignals: (options?: { force?: boolean }) => Promise<void>;
  updateSettings: (settings: Partial<AppSettings>) => Promise<void>;
  toggleCollapsedSection: (sectionId: string) => Promise<void>;
  setActiveLocation: (locationId: string) => Promise<void>;
  addSavedLocation: (
    coordinates: NormalizedEnvironment['coordinates'],
    name?: string | undefined,
  ) => Promise<void>;
  renameSavedLocation: (locationId: string, name: string) => Promise<void>;
  updateSavedLocationCoordinates: (
    locationId: string,
    coordinates: NormalizedEnvironment['coordinates'],
  ) => Promise<void>;
  deleteSavedLocation: (locationId: string) => Promise<void>;
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
  activeLocationId: CURRENT_LOCATION_ID,
  activeLocationName: 'Current location',
  coordinates: null,
  placeName: null,
  mode: 'automatic',
  permissionStatus: 'unknown',
};

function localDataLoadFallbackMessage(): string {
  return translate('errors.localDataLoadFallback');
}

function settingsSaveFailedMessage(): string {
  return translate('errors.settingsSaveFailed');
}

const emptyHealthSignalsState: HealthSignalsState = {
  geography: null,
  signals: [],
  loading: false,
  error: null,
  updatedAt: null,
};

function staleFrom(savedAt: string | null): boolean {
  if (!savedAt) return false;
  const savedAtTime = Date.parse(savedAt);
  if (!Number.isFinite(savedAtTime)) return true;
  return millisecondsBetween(Date.now(), savedAtTime) > ENVIRONMENT_PROVIDER_FRESHNESS_MS;
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

  try {
    await saveWidgetSnapshot(snapshot);
    await saveWidgetSnapshotToNative(snapshot);
  } catch (error) {
    console.warn('AirAware: widget snapshot save failed', error);
  }
}

async function loadCachedVegetationFor(input: {
  coordinates: NormalizedEnvironment['coordinates'] | null;
}): Promise<{
  vegetation: NormalizedVegetationContext | null;
  stale: boolean;
}> {
  if (!input.coordinates) return { vegetation: null, stale: false };

  const cache = vegetationCacheForRequest(await loadVegetationCache(), input.coordinates);

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
let pendingRefreshForce = false;
let nextManualLocationSequence = 0;
let vegetationRefreshSequence = 0;
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
    .then(() => {
      if (useAppStore.getState().error === settingsSaveFailedMessage()) {
        useAppStore.setState({ error: null });
      }
    })
    .catch((error) => {
      console.warn('AirAware: settings save failed', error);
      useAppStore.setState({ error: settingsSaveFailedMessage() });
    });
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

function locationInfoFromSettings(settings: AppSettings): LocationInfo {
  const location = activeSavedLocation(settings);
  const coordinates = coordinatesForSavedLocation(location);

  return {
    activeLocationId: location.id,
    activeLocationName: locationDisplayName(location),
    coordinates,
    placeName: location.type === 'current' ? location.placeName : location.name,
    countryCode: location.type === 'manual' ? (location.countryCode ?? null) : null,
    countryName: location.type === 'manual' ? (location.countryName ?? null) : null,
    mode: location.type === 'current' ? 'automatic' : 'manual',
    permissionStatus: 'unknown',
  };
}

function settingsWithCurrentLocation(settings: AppSettings, location: LocationInfo): AppSettings {
  if (location.activeLocationId !== CURRENT_LOCATION_ID || location.mode !== 'automatic') {
    return settings;
  }

  const current = currentLocationEntry({
    coordinates: location.coordinates,
    placeName: location.placeName,
    updatedAt: Date.now(),
  });

  return {
    ...settings,
    locations: [current, ...settings.locations.filter((item) => item.id !== CURRENT_LOCATION_ID)],
  };
}

function activeCoordinatesFromSettings(
  settings: AppSettings,
): NormalizedEnvironment['coordinates'] | null {
  return coordinatesForSavedLocation(activeSavedLocation(settings));
}

function generatedManualLocationId(): string {
  nextManualLocationSequence += 1;
  return `manual-${Date.now().toString(36)}-${nextManualLocationSequence.toString(36)}`;
}

function manualLocationName(
  name: string | null,
  coordinates: NormalizedEnvironment['coordinates'],
): string {
  return name?.trim() || `${coordinates.latitude.toFixed(4)}, ${coordinates.longitude.toFixed(4)}`;
}

function manualSavedLocationCount(settings: AppSettings): number {
  return settings.locations.filter((location) => location.type === 'manual').length;
}

function isSilentQueryCancellation(error: unknown): boolean {
  return (
    error !== null &&
    typeof error === 'object' &&
    (error as Record<string, unknown>).silent === true
  );
}

function coordinateRequestKey(coordinates: NormalizedEnvironment['coordinates']): string {
  return `${coordinates.latitude.toFixed(5)},${coordinates.longitude.toFixed(5)}`;
}

function activeLocationRequestScope(settings: AppSettings): string {
  const active = activeSavedLocation(settings);
  const coordinates = coordinatesForSavedLocation(active);
  if (active.type !== 'manual' || !coordinates) return active.id;

  return `${active.id}|${coordinateRequestKey(coordinates)}`;
}

function healthSignalRequestScope(input: {
  settings: AppSettings;
  location: LocationInfo;
  environment: NormalizedEnvironment | null;
}): string {
  const locationScope = activeLocationRequestScope(input.settings);
  const active = activeSavedLocation(input.settings);
  if (active.type === 'manual') return locationScope;

  const coordinates = input.environment?.coordinates ?? input.location.coordinates;
  return coordinates ? `${locationScope}|${coordinateRequestKey(coordinates)}` : locationScope;
}

function activeVegetationCoordinatesKey(): string | null {
  const state = useAppStore.getState();
  const coordinates = state.environment?.coordinates ?? state.location.coordinates;
  return coordinates ? coordinateRequestKey(coordinates) : null;
}

function environmentalEventNotificationsEnabled(settings: AppSettings): boolean {
  return Object.values(settings.environmentalEventNotifications).some((enabled) => enabled);
}

async function deliverEnvironmentalEventNotifications(input: {
  events: readonly EnvironmentalEvent[];
  settings: AppSettings;
  capabilityAvailable: boolean;
  permissionStatus: NotificationPermissionStatus;
  previousState: EnvironmentalEventNotificationState | null;
}): Promise<EnvironmentalEventNotificationState | null> {
  if (!input.capabilityAvailable || input.permissionStatus !== 'granted') {
    return input.previousState;
  }

  let state = freshEnvironmentalEventNotificationState(input.previousState);
  let deliveredCount = 0;

  for (const event of input.events) {
    if (deliveredCount >= 2) break;
    if (
      !environmentalEventNeedsNotification({
        event,
        settings: input.settings,
        state,
      })
    ) {
      continue;
    }

    const delivered = await deliverRiskTransitionNotification(
      formatEnvironmentalEventNotification(event),
    );
    if (!delivered) continue;
    state = environmentalEventNotificationStateAfterDelivery({ event, state });
    deliveredCount += 1;
  }

  return state;
}

function refreshPreflightCoordinates(input: {
  settings: AppSettings;
  cached: NormalizedEnvironment | null;
  currentLocation: LocationInfo;
}): NormalizedEnvironment['coordinates'] | null {
  const active = activeSavedLocation(input.settings);
  if (active.type === 'manual') return coordinatesForSavedLocation(active);

  return input.cached?.coordinates ?? input.currentLocation.coordinates;
}

function freshCachePreflight(input: {
  settings: AppSettings;
  cached: NormalizedEnvironment | null;
  currentLocation: LocationInfo;
  capabilities: ReturnType<typeof capabilitiesForEntitlement>;
  requestedActivityDomains: ReturnType<typeof enabledProviderActivities>;
  force?: boolean | undefined;
}): { environment: NormalizedEnvironment; location: LocationInfo } | null {
  const coordinates =
    input.force === true
      ? null
      : refreshPreflightCoordinates({
          settings: input.settings,
          cached: input.cached,
          currentLocation: input.currentLocation,
        });
  if (!coordinates) return null;

  const cachedForLocation = cacheForCoordinates(input.cached, coordinates);
  const policy = environmentRefreshPolicy({
    environment: cachedForLocation,
    coordinates,
    capabilities: input.capabilities,
    requiredActivityDomains: input.requestedActivityDomains,
    force: false,
  });
  if (policy.needsRefresh || !policy.usableCache) return null;

  return {
    environment: policy.usableCache,
    location: {
      ...locationInfoFromSettings(input.settings),
      coordinates,
      placeName: policy.usableCache.placeName,
    },
  };
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
  environmentalEvents: [],
  environmentalEventNotificationState: null,
  healthSignals: emptyHealthSignalsState,

  hydrate: async () => {
    let usedLocalDataFallback = false;
    const loadBestEffort = async <T>(
      label: string,
      promise: Promise<T>,
      fallback: T,
    ): Promise<T> => {
      try {
        return await promise;
      } catch (error) {
        usedLocalDataFallback = true;
        console.warn(`AirAware: failed to load ${label}`, error);
        return fallback;
      }
    };

    const [
      storedSettings,
      profile,
      latestCache,
      rawBillingState,
      developmentOverride,
      notificationState,
      eventNotificationState,
    ] = await Promise.all([
      loadBestEffort('settings', loadSettings(), DEFAULT_SETTINGS),
      loadBestEffort('profile', loadProfile(), DEFAULT_PROFILE),
      loadBestEffort('environment cache', loadEnvironmentCache(), null),
      loadBestEffort(
        'billing state',
        billingGateway.initializeBilling(),
        UNCONFIGURED_BILLING_STATE,
      ),
      loadBestEffort(
        'development entitlement override',
        loadDevelopmentEntitlementOverride(),
        null,
      ),
      loadBestEffort('risk notification state', loadRiskNotificationTransitionState(), null),
      loadBestEffort(
        'environmental event notification state',
        loadEnvironmentalEventNotificationState(),
        null,
      ),
    ]);
    const billingState = effectiveBillingState(rawBillingState, developmentOverride);
    const entitlement = billingState.entitlement;
    let settings = settingsForProfileState(storedSettings, profile);
    setAppLanguagePreference(settings.languagePreference);
    const activeCoordinates = activeCoordinatesFromSettings(settings);
    const activeCache =
      (await loadBestEffort(
        'active location environment cache',
        loadEnvironmentCacheForCoordinates(activeCoordinates),
        null,
      )) ?? (activeCoordinates ? null : latestCache);
    const environment = activeCache?.data ?? null;
    const hydratedLocation = environment
      ? {
          ...locationInfoFromSettings(settings),
          coordinates: environment.coordinates,
          placeName: environment.placeName,
        }
      : locationInfoFromSettings(settings);
    if (environment?.placeName && settings.activeLocationId === LEGACY_MANUAL_LOCATION_ID) {
      settings = {
        ...settings,
        locations: settings.locations.map((location) =>
          location.id === LEGACY_MANUAL_LOCATION_ID && location.type === 'manual'
            ? {
                ...location,
                name: environment.placeName ?? location.name,
                placeName: environment.placeName,
              }
            : location,
        ),
      };
    }
    const cachedVegetation = await loadBestEffort(
      'vegetation cache',
      loadCachedVegetationFor({
        coordinates: environment?.coordinates ?? null,
      }),
      { vegetation: null, stale: false },
    );
    const environmentalEvents =
      environment && staleForecastCanDisplayEvents(environment)
        ? detectEnvironmentalEvents(environment, {
            locationId: settings.activeLocationId,
            profile,
            settings,
          })
        : [];

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
      environmentalEvents,
      environmentalEventNotificationState:
        freshEnvironmentalEventNotificationState(eventNotificationState),
      stale: staleFrom(activeCache?.metadata.savedAt ?? null),
      location: hydratedLocation,
      error: usedLocalDataFallback ? localDataLoadFallbackMessage() : get().error,
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
        stale: staleFrom(activeCache?.metadata.savedAt ?? null),
      });
      void get().refreshVegetation(false);
    }
    void get().refreshHealthSignals();
  },

  refresh: async (options = {}) => {
    if (get().loading) {
      pendingRefresh = true;
      pendingRefreshForce = pendingRefreshForce || options.force === true;
      return;
    }

    const runPendingRefresh = async () => {
      if (!pendingRefresh) return;

      const force = pendingRefreshForce;
      pendingRefresh = false;
      pendingRefreshForce = false;
      await get().refresh({ force });
    };

    const settings = get().settings;
    const requestActiveLocationId = settings.activeLocationId;
    const requestActiveLocationScope = activeLocationRequestScope(settings);
    const cached = get().environment;
    const requestedActivityDomains = enabledProviderActivities(settings, get().entitlement);
    const requestedAirQualityVariables = airQualityVariableCoverageFor(requestedActivityDomains);
    const requestedWeatherVariables = weatherVariableCoverageFor(requestedActivityDomains);
    const capabilities = capabilitiesForEntitlement(get().entitlement);
    let resolvedLocation: LocationInfo | null = null;
    const finishObsoleteRefresh = () => {
      set({ loading: false });
      return runPendingRefresh();
    };
    const refreshIsObsolete = () =>
      activeLocationRequestScope(get().settings) !== requestActiveLocationScope;

    try {
      const freshCache = freshCachePreflight({
        settings,
        cached,
        currentLocation: get().location,
        capabilities,
        requestedActivityDomains,
        force: options.force,
      });
      if (freshCache) {
        const environmentalEvents = detectEnvironmentalEvents(freshCache.environment, {
          locationId: settings.activeLocationId,
          profile: get().profile,
          settings,
        });
        await persistWidgetSnapshotFor({
          environment: freshCache.environment,
          profile: get().profile,
          settings,
          entitlement: get().entitlement,
          stale: false,
        });
        if (refreshIsObsolete()) {
          await finishObsoleteRefresh();
          return;
        }
        set({
          loading: false,
          error: null,
          shareMessage: null,
          stale: false,
          location: freshCache.location,
          environment: freshCache.environment,
          environmentalEvents,
        });
        void get().refreshVegetation(false);
        void get().refreshHealthSignals();
        await runPendingRefresh();
        return;
      }

      set({ loading: true, error: null, shareMessage: null });
      const location = await resolveActiveLocation(settings);
      resolvedLocation = location;

      if (refreshIsObsolete()) {
        await finishObsoleteRefresh();
        return;
      }

      if (!location.coordinates) {
        throw new Error('Location is unavailable. Add manual coordinates in Settings.');
      }

      const resolvedSettings = settingsWithCurrentLocation(settings, location);
      if (resolvedSettings !== settings) {
        set({ settings: resolvedSettings });
        scheduleSettingsSave(resolvedSettings);
      }

      const cachedForLocation = cacheForCoordinates(cached, location.coordinates);
      const refreshPolicy = environmentRefreshPolicy({
        environment: cachedForLocation,
        coordinates: location.coordinates,
        capabilities,
        requiredActivityDomains: requestedActivityDomains,
        force: options.force,
      });

      if (!refreshPolicy.needsRefresh && refreshPolicy.usableCache) {
        const environmentalEvents = detectEnvironmentalEvents(refreshPolicy.usableCache, {
          locationId: resolvedSettings.activeLocationId,
          profile: get().profile,
          settings: resolvedSettings,
        });
        await persistWidgetSnapshotFor({
          environment: refreshPolicy.usableCache,
          profile: get().profile,
          settings: resolvedSettings,
          entitlement: get().entitlement,
          stale: false,
        });
        if (refreshIsObsolete()) {
          await finishObsoleteRefresh();
          return;
        }
        set({
          loading: false,
          error: null,
          shareMessage: null,
          stale: false,
          location,
          environment: refreshPolicy.usableCache,
          environmentalEvents,
        });
        void get().refreshVegetation(false);
        void get().refreshHealthSignals();
        await runPendingRefresh();
        return;
      }

      const provider = activeEnvironmentalProvider(capabilities);
      const providerOptions = {
        enabledActivities: requestedActivityDomains,
      };

      const [airResult, weatherResult] = await Promise.allSettled([
        refreshPolicy.fetchAirQuality
          ? fetchAirQualityQuery({
              provider,
              coordinates: location.coordinates,
              enabledActivities: providerOptions.enabledActivities,
              force: options.force === true,
            })
          : Promise.resolve(null),
        refreshPolicy.fetchWeather
          ? fetchWeatherQuery({
              provider,
              coordinates: location.coordinates,
              enabledActivities: providerOptions.enabledActivities,
              force: options.force === true,
            })
          : Promise.resolve(null),
      ]);
      const airQuality = airResult.status === 'fulfilled' ? airResult.value : null;
      const weather = weatherResult.status === 'fulfilled' ? weatherResult.value : null;
      if (refreshIsObsolete()) {
        await finishObsoleteRefresh();
        return;
      }
      const hasCompleteFreshProviderData =
        (airQuality !== null || !refreshPolicy.fetchAirQuality) &&
        (weather !== null || !refreshPolicy.fetchWeather);
      const hasFreshProviderData = airQuality !== null || weather !== null;

      if (!airQuality && !weather && !cachedForLocation) {
        throw new Error('Open-Meteo data is unavailable.');
      }

      const environment = assembleEnvironment({
        coordinates: location.coordinates,
        placeName:
          location.mode === 'manual'
            ? location.activeLocationName
            : (location.placeName ?? location.activeLocationName),
        airQuality,
        weather,
        fallback: cachedForLocation,
        requestedActivityDomains: hasCompleteFreshProviderData
          ? requestedActivityDomains
          : undefined,
        requestedAirQualityVariables:
          airQuality !== null || !refreshPolicy.fetchAirQuality
            ? requestedAirQualityVariables
            : undefined,
        requestedWeatherVariables:
          weather !== null || !refreshPolicy.fetchWeather ? requestedWeatherVariables : undefined,
      });

      if (hasCompleteFreshProviderData) {
        await persistSuccessfulEnvironment(environment);
      }

      const derived = deriveEnvironmentState(environment, get().profile, capabilities);
      const environmentalEvents = staleForecastCanDisplayEvents(environment)
        ? detectEnvironmentalEvents(environment, {
            locationId: requestActiveLocationId,
            profile: get().profile,
            settings: resolvedSettings,
          })
        : [];
      const canNotify = isFeatureAvailable(capabilities, 'basic_transition_notifications');
      const canNotifyEvents = isFeatureAvailable(
        capabilities,
        'advanced_environment_notifications',
      );
      const permissionStatus =
        (canNotify && resolvedSettings.riskTransitionNotificationsEnabled) ||
        (canNotifyEvents && environmentalEventNotificationsEnabled(resolvedSettings))
          ? await getRiskNotificationPermissionStatus()
          : get().notificationPermissionStatus;
      if (refreshIsObsolete()) {
        await finishObsoleteRefresh();
        return;
      }
      const transitionEvaluation =
        canNotify && hasFreshProviderData
          ? evaluateRiskTransition({
              settings: resolvedSettings,
              capabilityAvailable: canNotify,
              permissionStatus,
              environmentalScore: derived.environmentalScore,
              personalizedScore: derived.personalizedScore,
              previousState: get().riskNotificationTransitionState,
              locationId: requestActiveLocationId,
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
      if (transitionEvaluation?.transition && !refreshIsObsolete()) {
        delivered = await deliverRiskTransitionNotification(
          formatRiskTransitionNotification(transitionEvaluation.transition),
        );
      }
      if (refreshIsObsolete()) {
        await finishObsoleteRefresh();
        return;
      }
      const nextEventNotificationState = hasCompleteFreshProviderData
        ? await deliverEnvironmentalEventNotifications({
            events: environmentalEvents,
            settings: resolvedSettings,
            capabilityAvailable: canNotifyEvents,
            permissionStatus,
            previousState: get().environmentalEventNotificationState,
          })
        : get().environmentalEventNotificationState;
      if (refreshIsObsolete()) {
        await finishObsoleteRefresh();
        return;
      }
      if (nextEventNotificationState) {
        await saveEnvironmentalEventNotificationState(nextEventNotificationState);
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
      const nextStale =
        (refreshPolicy.fetchAirQuality && airQuality === null) ||
        (refreshPolicy.fetchWeather && weather === null);
      await persistWidgetSnapshotFor({
        environment,
        profile: get().profile,
        settings: resolvedSettings,
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
        environmentalEventNotificationState:
          nextEventNotificationState ?? get().environmentalEventNotificationState,
        environmentalEvents,
      });
      void get().refreshVegetation(false);
      void get().refreshHealthSignals();
      await runPendingRefresh();
    } catch (error) {
      console.warn('AirAware: refresh failed', error);
      if (refreshIsObsolete()) {
        await finishObsoleteRefresh();
        return;
      }
      const fallbackCoordinates =
        resolvedLocation?.coordinates ?? activeCoordinatesFromSettings(settings);
      const cache = await loadEnvironmentCacheForCoordinates(fallbackCoordinates);
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
      const nextStale = environment !== null;
      const environmentalEvents =
        environment && staleForecastCanDisplayEvents(environment)
          ? detectEnvironmentalEvents(environment, {
              locationId: get().settings.activeLocationId,
              profile: get().profile,
              settings: get().settings,
            })
          : [];

      await persistWidgetSnapshotFor({
        environment: environment ?? null,
        profile: get().profile,
        settings: get().settings,
        entitlement: get().entitlement,
        stale: nextStale,
      });

      set({
        loading: false,
        stale: nextStale,
        error: environment
          ? translate('errors.showingCachedEnvironmentalData')
          : translate('errors.noEnvironmentalData'),
        environment: environment ?? null,
        location: resolvedLocation ?? get().location,
        environmentalEvents,
      });
      void get().refreshHealthSignals();
      await runPendingRefresh();
    }
  },

  refreshHealthSignals: async (options = {}) => {
    const requestActiveLocationScope = healthSignalRequestScope({
      settings: get().settings,
      location: get().location,
      environment: get().environment,
    });
    set({
      healthSignals: {
        ...get().healthSignals,
        loading: true,
        error: null,
      },
    });

    try {
      const nextHealthSignals = await refreshHealthSignalsForLocation({
        location: get().location,
        environment: get().environment,
        force: options.force,
      });
      if (
        healthSignalRequestScope({
          settings: get().settings,
          location: get().location,
          environment: get().environment,
        }) !== requestActiveLocationScope
      ) {
        return;
      }

      set({
        healthSignals: nextHealthSignals,
      });
    } catch (error) {
      console.warn('AirAware: health surveillance refresh failed', error);
      if (
        healthSignalRequestScope({
          settings: get().settings,
          location: get().location,
          environment: get().environment,
        }) !== requestActiveLocationScope
      ) {
        return;
      }

      set({
        healthSignals: {
          ...get().healthSignals,
          loading: false,
          error: translate('errors.healthUnavailable'),
        },
      });
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
        const requestedSettings = { ...currentSettings, ...settingsPatch };
        const riskTransitionRequested =
          settingsPatch.riskTransitionNotificationsEnabled === true &&
          currentSettings.riskTransitionNotificationsEnabled !== true;
        const eventNotificationsRequested =
          settingsPatch.environmentalEventNotifications !== undefined &&
          environmentalEventNotificationsEnabled(requestedSettings);

        if (riskTransitionRequested || eventNotificationsRequested) {
          if (
            riskTransitionRequested &&
            !isFeatureAvailable(capabilities, 'basic_transition_notifications')
          ) {
            normalizedPatch = { ...settingsPatch, riskTransitionNotificationsEnabled: false };
            notificationMessage = translate('notifications.riskUnavailableInBuild');
          } else if (
            eventNotificationsRequested &&
            !isFeatureAvailable(capabilities, 'advanced_environment_notifications')
          ) {
            normalizedPatch = {
              ...settingsPatch,
              environmentalEventNotifications: DEFAULT_SETTINGS.environmentalEventNotifications,
            };
            notificationMessage = translate('notifications.environmentalAlertsRequirePro');
          } else if (notificationPermissionStatus === 'denied') {
            notificationPermissionStatus = await getRiskNotificationPermissionStatus();
            if (notificationPermissionStatus !== 'granted') {
              normalizedPatch = {
                ...settingsPatch,
                riskTransitionNotificationsEnabled: riskTransitionRequested
                  ? false
                  : currentSettings.riskTransitionNotificationsEnabled,
              };
              if (eventNotificationsRequested) {
                normalizedPatch = {
                  ...normalizedPatch,
                  environmentalEventNotifications: DEFAULT_SETTINGS.environmentalEventNotifications,
                };
              }
              notificationMessage = translate('notifications.permissionDeniedOpenSettings');
            }
          } else {
            notificationPermissionStatus = await requestRiskNotificationPermission();

            if (notificationPermissionStatus !== 'granted') {
              normalizedPatch = {
                ...settingsPatch,
                riskTransitionNotificationsEnabled: riskTransitionRequested
                  ? false
                  : currentSettings.riskTransitionNotificationsEnabled,
              };
              if (eventNotificationsRequested) {
                normalizedPatch = {
                  ...normalizedPatch,
                  environmentalEventNotifications: DEFAULT_SETTINGS.environmentalEventNotifications,
                };
              }
              notificationMessage =
                notificationPermissionStatus === 'denied'
                  ? translate('notifications.permissionDeniedRetry')
                  : translate('notifications.unavailableOnDevice');
            }
          }
        }

        if (settingsPatch.riskTransitionNotificationsEnabled === false) {
          notificationMessage = null;
        }
        if (
          settingsPatch.environmentalEventNotifications !== undefined &&
          !environmentalEventNotificationsEnabled(requestedSettings)
        ) {
          notificationMessage = null;
        }

        const settings = settingsForProfileState(
          { ...get().settings, ...normalizedPatch },
          get().profile,
        );
        if (settingsPatch.languagePreference !== undefined) {
          setAppLanguagePreference(settings.languagePreference);
        }
        const environmentalEvents = get().environment
          ? detectEnvironmentalEvents(get().environment, {
              locationId: settings.activeLocationId,
              profile: get().profile,
              settings,
            })
          : [];
        set({ settings, environmentalEvents });
        set({ notificationPermissionStatus, notificationMessage });
        scheduleSettingsSave(settings);
        void persistWidgetSnapshotFor({
          environment: get().environment,
          profile: get().profile,
          settings,
          entitlement: get().entitlement,
          stale: get().stale,
        });
        if (settingsPatch.enabledActivities !== undefined) {
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

  setActiveLocation: async (locationId) => {
    settingsUpdateQueue = settingsUpdateQueue
      .catch((error) => console.warn('AirAware: previous settings update failed', error))
      .then(async () => {
        const currentSettings = get().settings;
        if (!currentSettings.locations.some((location) => location.id === locationId)) return;
        if (currentSettings.activeLocationId === locationId) return;

        const settings = { ...currentSettings, activeLocationId: locationId };
        const coordinates = activeCoordinatesFromSettings(settings);
        const cache = await loadEnvironmentCacheForCoordinates(coordinates);
        const environment = cache?.data ?? null;
        const stale = staleFrom(cache?.metadata.savedAt ?? null);
        const location = environment
          ? {
              ...locationInfoFromSettings(settings),
              coordinates: environment.coordinates,
              placeName: environment.placeName,
            }
          : locationInfoFromSettings(settings);

        set({
          settings,
          location,
          environment,
          environmentalEvents:
            environment && staleForecastCanDisplayEvents(environment)
              ? detectEnvironmentalEvents(environment, {
                  locationId,
                  profile: get().profile,
                  settings,
                })
              : [],
          stale,
          error: null,
          vegetation: null,
          vegetationStale: false,
          vegetationError: null,
          healthSignals: emptyHealthSignalsState,
        });
        scheduleSettingsSave(settings);
        await persistWidgetSnapshotFor({
          environment,
          profile: get().profile,
          settings,
          entitlement: get().entitlement,
          stale,
        });
        await get().refresh();
      });

    return settingsUpdateQueue;
  },

  addSavedLocation: async (coordinates, name) => {
    settingsUpdateQueue = settingsUpdateQueue
      .catch((error) => console.warn('AirAware: previous settings update failed', error))
      .then(async () => {
        const capabilities = capabilitiesForEntitlement(get().entitlement);
        if (manualSavedLocationCount(get().settings) >= capabilities.locations.maxSavedLocations) {
          set({ error: translate('errors.savedLocationLimitReached') });
          return;
        }

        const metadata = await reverseGeocodeLocationMetadata(coordinates);
        const now = Date.now();
        const location: ManualSavedLocation = {
          id: generatedManualLocationId(),
          type: 'manual',
          name: manualLocationName(name?.trim() || metadata.placeName, coordinates),
          latitude: coordinates.latitude,
          longitude: coordinates.longitude,
          placeName: metadata.placeName,
          countryCode: metadata.countryCode,
          countryName: metadata.countryName,
          createdAt: now,
          updatedAt: now,
        };
        const settings = {
          ...get().settings,
          locations: [...get().settings.locations, location],
          activeLocationId: location.id,
        };
        set({
          settings,
          location: locationInfoFromSettings(settings),
          environment: null,
          environmentalEvents: [],
          stale: false,
          error: null,
          vegetation: null,
          vegetationStale: false,
          vegetationError: null,
          healthSignals: emptyHealthSignalsState,
        });
        scheduleSettingsSave(settings);
        await persistWidgetSnapshotFor({
          environment: null,
          profile: get().profile,
          settings,
          entitlement: get().entitlement,
          stale: false,
        });
        await get().refresh({ force: true });
      });

    return settingsUpdateQueue;
  },

  renameSavedLocation: async (locationId, name) => {
    const trimmedName = name.trim();
    if (!trimmedName || locationId === CURRENT_LOCATION_ID) return;

    settingsUpdateQueue = settingsUpdateQueue
      .catch((error) => console.warn('AirAware: previous settings update failed', error))
      .then(async () => {
        const settings = {
          ...get().settings,
          locations: get().settings.locations.map((location) =>
            location.id === locationId && location.type === 'manual'
              ? { ...location, name: trimmedName, updatedAt: Date.now() }
              : location,
          ),
        };
        const currentEnvironment = get().environment;
        const environment: NormalizedEnvironment | null =
          settings.activeLocationId === locationId && currentEnvironment
            ? { ...currentEnvironment, placeName: trimmedName }
            : currentEnvironment;
        set({
          settings,
          location:
            settings.activeLocationId === locationId
              ? locationInfoFromSettings(settings)
              : get().location,
          environment,
          environmentalEvents:
            settings.activeLocationId === locationId && environment
              ? detectEnvironmentalEvents(environment, {
                  locationId,
                  profile: get().profile,
                  settings,
                })
              : get().environmentalEvents,
        });
        scheduleSettingsSave(settings);
        await persistWidgetSnapshotFor({
          environment,
          profile: get().profile,
          settings,
          entitlement: get().entitlement,
          stale: get().stale,
        });
      });

    return settingsUpdateQueue;
  },

  updateSavedLocationCoordinates: async (locationId, coordinates) => {
    if (locationId === CURRENT_LOCATION_ID) return;

    settingsUpdateQueue = settingsUpdateQueue
      .catch((error) => console.warn('AirAware: previous settings update failed', error))
      .then(async () => {
        const metadata = await reverseGeocodeLocationMetadata(coordinates);
        const settings = {
          ...get().settings,
          locations: get().settings.locations.map((location) =>
            location.id === locationId && location.type === 'manual'
              ? {
                  ...location,
                  latitude: coordinates.latitude,
                  longitude: coordinates.longitude,
                  placeName: metadata.placeName,
                  countryCode: metadata.countryCode,
                  countryName: metadata.countryName,
                  updatedAt: Date.now(),
                }
              : location,
          ),
        };
        const active = settings.activeLocationId === locationId;
        set({
          settings,
          location: active ? locationInfoFromSettings(settings) : get().location,
          environment: active ? null : get().environment,
          environmentalEvents: active ? [] : get().environmentalEvents,
          stale: active ? false : get().stale,
          error: active ? null : get().error,
          vegetation: active ? null : get().vegetation,
          vegetationStale: active ? false : get().vegetationStale,
          vegetationError: active ? null : get().vegetationError,
          healthSignals: active ? emptyHealthSignalsState : get().healthSignals,
        });
        scheduleSettingsSave(settings);
        await persistWidgetSnapshotFor({
          environment: active ? null : get().environment,
          profile: get().profile,
          settings,
          entitlement: get().entitlement,
          stale: active ? false : get().stale,
        });
        if (active) {
          await get().refresh({ force: true });
        }
      });

    return settingsUpdateQueue;
  },

  deleteSavedLocation: async (locationId) => {
    if (locationId === CURRENT_LOCATION_ID) return;

    settingsUpdateQueue = settingsUpdateQueue
      .catch((error) => console.warn('AirAware: previous settings update failed', error))
      .then(async () => {
        const currentSettings = get().settings;
        const locations = currentSettings.locations.filter(
          (location) => location.id !== locationId,
        );
        const activeLocationId =
          currentSettings.activeLocationId === locationId
            ? CURRENT_LOCATION_ID
            : currentSettings.activeLocationId;
        const settings = {
          ...currentSettings,
          locations: locations.some((location) => location.id === CURRENT_LOCATION_ID)
            ? locations
            : [currentLocationEntry(), ...locations],
          activeLocationId,
        };
        const activeDeleted = currentSettings.activeLocationId === locationId;
        set({
          settings,
          location: activeDeleted ? locationInfoFromSettings(settings) : get().location,
          environment: activeDeleted ? null : get().environment,
          environmentalEvents: activeDeleted ? [] : get().environmentalEvents,
          stale: activeDeleted ? false : get().stale,
          error: activeDeleted ? null : get().error,
          vegetation: activeDeleted ? null : get().vegetation,
          vegetationStale: activeDeleted ? false : get().vegetationStale,
          vegetationError: activeDeleted ? null : get().vegetationError,
          healthSignals: activeDeleted ? emptyHealthSignalsState : get().healthSignals,
        });
        scheduleSettingsSave(settings);
        await persistWidgetSnapshotFor({
          environment: activeDeleted ? null : get().environment,
          profile: get().profile,
          settings,
          entitlement: get().entitlement,
          stale: activeDeleted ? false : get().stale,
        });
        if (activeDeleted) {
          await get().refresh();
        }
      });

    return settingsUpdateQueue;
  },

  updateProfile: async (profilePatch) => {
    const profile = { ...get().profile, ...profilePatch };
    const currentSettings = get().settings;
    const settings = settingsForProfileState(currentSettings, profile);
    const environmentalEvents = get().environment
      ? detectEnvironmentalEvents(get().environment, {
          locationId: settings.activeLocationId,
          profile,
          settings,
        })
      : [];
    set({ profile, settings, environmentalEvents });
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
    const environmentalEvents = get().environment
      ? detectEnvironmentalEvents(get().environment, {
          locationId: get().settings.activeLocationId,
          profile: nextProfile,
          settings: get().settings,
        })
      : [];
    set({ profile: nextProfile, environmentalEvents });
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
      set({ sharing: false, shareMessage: translate('sharing.unavailable') });
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
      set({ sharing: false, shareMessage: translate('sharing.noEnvironmentalData') });
      return;
    }

    try {
      await Share.share({ message: formatDailySummary(summary) });
      set({ sharing: false, shareMessage: null });
    } catch (error) {
      console.warn('AirAware: native share failed', error);
      set({ sharing: false, shareMessage: translate('sharing.openFailed') });
    }
  },

  sendTestRiskNotification: async () => {
    const permissionStatus = await getRiskNotificationPermissionStatus();
    set({ notificationPermissionStatus: permissionStatus, notificationMessage: null });

    if (permissionStatus !== 'granted') {
      set({
        notificationMessage:
          permissionStatus === 'denied'
            ? translate('notifications.permissionDeniedOpenSettings')
            : translate('notifications.enablePermissionBeforeTest'),
      });
      return;
    }

    const delivered = await deliverRiskTestNotification();
    set({
      notificationMessage: delivered
        ? translate('notifications.testSent')
        : translate('notifications.testFailed'),
    });
  },

  openNotificationSettings: async () => {
    const opened = await openSystemNotificationSettings();
    set({
      notificationMessage: opened
        ? translate('notifications.androidSettingsOpened')
        : translate('notifications.androidSettingsOpenFailed'),
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
          ? translate('pro.revenueCatEntitlementActive')
          : translate('pro.developmentPreviewUpdated'),
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
    const requestId = (vegetationRefreshSequence += 1);
    const environment = get().environment;
    const coordinates = environment?.coordinates ?? get().location.coordinates;

    if (!coordinates) {
      set({ vegetation: null, vegetationStale: false, vegetationError: null });
      return;
    }

    const requestCoordinatesKey = coordinateRequestKey(coordinates);
    const requestStillCurrent = () =>
      requestId === vegetationRefreshSequence &&
      activeVegetationCoordinatesKey() === requestCoordinatesKey;
    const finishObsoleteRequest = () => {
      if (requestId === vegetationRefreshSequence) {
        set({ vegetationLoading: false });
      }
    };
    const cache = vegetationCacheForRequest(await loadVegetationCache(), coordinates);
    const cacheExpired = cache ? vegetationCacheExpired(cache) : false;

    if (!requestStillCurrent()) {
      finishObsoleteRequest();
      return;
    }

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
      const vegetation = await fetchVegetationQuery({ coordinates, force });
      await saveVegetationCache(vegetationCacheEnvelope(vegetation));
      if (!requestStillCurrent()) {
        finishObsoleteRequest();
        return;
      }
      set({
        vegetation,
        vegetationStale: false,
        vegetationError: null,
        vegetationLoading: false,
      });
    } catch (error) {
      if (isSilentQueryCancellation(error) || !requestStillCurrent()) {
        finishObsoleteRequest();
        return;
      }
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

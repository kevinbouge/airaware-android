import AsyncStorage from '@react-native-async-storage/async-storage';
import { z } from 'zod';
import {
  CACHE_SCHEMA_VERSION,
  DATA_DETAIL_CACHE_SCHEMA_VERSION,
  NEARBY_VEGETATION_RADIUS_METERS,
  VEGETATION_CACHE_SCHEMA_VERSION,
} from '../core/constants';
import type {
  CachedEnvironment,
  CurrentEnvironmentalReadings,
  Coordinates,
  ExtendedAirQualityReadings,
  ExtendedEnvironmentalReadings,
  ExtendedWeatherReadings,
  HourlyEnvironmentalReading,
} from '../models/environment';
import {
  CURRENT_LOCATION_ID,
  LEGACY_MANUAL_LOCATION_ID,
  currentLocationEntry,
  type ManualSavedLocation,
  type SavedLocation,
} from '../models/location';
import type { CachedDataDetailTimeline, DataDetailTimeline } from '../models/dataDetail';
import type { RiskNotificationTransitionState } from '../models/notifications';
import type {
  CachedVegetationContext,
  NormalizedVegetationContext,
  VegetationCategoryId,
  VegetationTaxonId,
} from '../models/vegetation';
import { type EntitlementState, normalizeEntitlement } from '../capabilities/entitlements';
import type { BillingEntitlementSource } from '../models/billing';
import {
  WIDGET_SNAPSHOT_SCHEMA_VERSION,
  type WidgetSnapshot,
  type WidgetSnapshotEnvelope,
} from '../models/widgets';
import {
  DEFAULT_PROFILE,
  DEFAULT_SETTINGS,
  type AppSettings,
  type PersonalAllergyProfile,
  type ProfileFactorId,
} from '../models/profile';
import { coordinateNumber, isFiniteNumber } from '../utils/number';
import { ACTIVITY_IDS, DEFAULT_ACTIVITY_SETTINGS } from '../core/activityDefinitions';
import type { ActivitySettings } from '../models/activities';
import { vegetationCacheKey } from '../services/vegetationCache';

const SETTINGS_KEY = 'airaware.settings.v1';
const PROFILE_KEY = 'airaware.profile.v1';
const ENVIRONMENT_CACHE_KEY = 'airaware.environment-cache.v1';
const RISK_NOTIFICATION_TRANSITION_KEY = 'airaware.risk-notification-transition.v1';
const WIDGET_SNAPSHOT_KEY = 'airaware.widget-snapshot.v1';
const DEVELOPMENT_ENTITLEMENT_OVERRIDE_KEY = 'airaware.development-entitlement.v1';
const BILLING_ENTITLEMENT_CACHE_KEY = 'airaware.billing-entitlement-cache.v1';
const BILLING_ENTITLEMENT_CACHE_SCHEMA_VERSION = 1;
const VEGETATION_CACHE_KEY = 'airaware.vegetation-cache.v1';
const DATA_DETAIL_CACHE_PREFIX = 'airaware.data-detail-cache.v1:';
const MAX_VEGETATION_CACHE_ENTRIES = 12;

const jsonObjectSchema = z.record(z.string(), z.unknown());
const persistedSettingsSchema = jsonObjectSchema;
const persistedProfileSchema = jsonObjectSchema;
const persistedBillingEntitlementCacheSchema = z
  .object({
    version: z.literal(BILLING_ENTITLEMENT_CACHE_SCHEMA_VERSION),
    entitlement: jsonObjectSchema,
    verifiedAt: z.string().refine((value) => Number.isFinite(Date.parse(value))),
    source: z.enum(['revenuecat', 'cached_revenuecat']),
  })
  .passthrough();
const cachedEnvironmentEnvelopeSchema = z
  .object({
    metadata: z
      .object({
        version: z.literal(CACHE_SCHEMA_VERSION),
        savedAt: z.string(),
        stale: z.boolean().optional(),
      })
      .passthrough(),
    data: z.unknown(),
  })
  .passthrough();
const cachedEnvironmentCollectionSchema = z
  .object({
    version: z.literal(2),
    entries: z.array(z.unknown()),
  })
  .passthrough();
const vegetationCacheEnvelopeSchema = z
  .object({
    version: z.literal(VEGETATION_CACHE_SCHEMA_VERSION),
    entries: z.array(z.unknown()),
  })
  .passthrough();
const dataDetailCacheEnvelopeSchema = z
  .object({
    version: z.literal(DATA_DETAIL_CACHE_SCHEMA_VERSION),
    savedAt: z.string(),
    cacheKey: z.string(),
    data: z.unknown(),
  })
  .passthrough();

function readObject(value: string | null): Record<string, unknown> | null {
  if (value === null) return null;

  try {
    const parsed = JSON.parse(value);
    return jsonObjectSchema.safeParse(parsed).data ?? null;
  } catch (error) {
    console.warn('AirAware: invalid local JSON', error);
    return null;
  }
}

function booleanRecord(value: unknown): Record<string, boolean> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(value).filter(
      (entry): entry is [string, boolean] => entry[1] === true || entry[1] === false,
    ),
  );
}

function validScorePreference(
  value: unknown,
  fallback: AppSettings['summaryScore'],
): AppSettings['summaryScore'] {
  return value === 'environmental' || value === 'personalized' ? value : fallback;
}

function validSummaryLocation(value: unknown): AppSettings['summaryLocation'] {
  return value === 'place' || value === 'hidden' ? value : DEFAULT_SETTINGS.summaryLocation;
}

function validRiskTransitionThreshold(
  value: unknown,
): AppSettings['riskTransitionNotificationThreshold'] {
  return value === 'highAndVeryHigh' || value === 'veryHighOnly'
    ? value
    : DEFAULT_SETTINGS.riskTransitionNotificationThreshold;
}

function knownActivities(value: unknown): ActivitySettings {
  const activities = booleanRecord(value);
  const migratedActivities: Record<string, boolean> = { ...activities };
  if (activities.agriculture !== true && activities.farming === true) {
    migratedActivities.agriculture = true;
  }
  if (
    activities.drone_operations !== true &&
    (activities.drone === true || activities.drone_flying === true)
  ) {
    migratedActivities.drone_operations = true;
  }

  return Object.fromEntries(
    ACTIVITY_IDS.map((activityId) => [
      activityId,
      migratedActivities[activityId] ?? DEFAULT_ACTIVITY_SETTINGS[activityId],
    ]),
  ) as ActivitySettings;
}

function knownActivityDomains(value: unknown): (typeof ACTIVITY_IDS)[number][] {
  if (!Array.isArray(value)) return [];

  const allowed = new Set<string>(ACTIVITY_IDS);
  return value.filter(
    (activityId): activityId is (typeof ACTIVITY_IDS)[number] =>
      typeof activityId === 'string' && allowed.has(activityId),
  );
}

function knownProviderVariables(value: unknown): string[] {
  if (!Array.isArray(value)) return [];

  return Array.from(
    new Set(value.filter((item): item is string => typeof item === 'string' && item.length > 0)),
  ).sort();
}

function coordinatesFromObject(value: unknown): Coordinates | null {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return null;
  const object = value as Record<string, unknown>;
  const latitude = coordinateNumber(object.latitude);
  const longitude = coordinateNumber(object.longitude);

  if (latitude === null || longitude === null) return null;
  if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) return null;

  return { latitude, longitude };
}

function legacyManualCoordinates(object: Record<string, unknown>): Coordinates | null {
  if (
    (typeof object.manualLatitude !== 'number' && typeof object.manualLatitude !== 'string') ||
    (typeof object.manualLongitude !== 'number' && typeof object.manualLongitude !== 'string') ||
    object.manualLatitude === '' ||
    object.manualLongitude === ''
  ) {
    return null;
  }

  const latitude = Number(object.manualLatitude);
  const longitude = Number(object.manualLongitude);

  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) return null;

  return { latitude, longitude };
}

function stringOrNull(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

function timestampOrNow(value: unknown): number {
  return isFiniteNumber(value) && value >= 0 ? value : Date.now();
}

function manualLocationFromObject(value: unknown): ManualSavedLocation | null {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return null;
  const object = value as Record<string, unknown>;
  if (object.type !== 'manual') return null;

  const id = stringOrNull(object.id);
  const name = stringOrNull(object.name);
  const coordinates = coordinatesFromObject(object);
  if (!id || !name || !coordinates || id === CURRENT_LOCATION_ID) return null;

  return {
    id,
    type: 'manual',
    name,
    latitude: coordinates.latitude,
    longitude: coordinates.longitude,
    placeName: stringOrNull(object.placeName),
    createdAt: timestampOrNow(object.createdAt),
    updatedAt: timestampOrNow(object.updatedAt),
  };
}

function hasDuplicateLocationIds(locations: readonly ManualSavedLocation[]): boolean {
  const ids = new Set<string>();

  for (const location of locations) {
    if (ids.has(location.id)) return true;
    ids.add(location.id);
  }

  return false;
}

function locationStateFromObject(
  object: Record<string, unknown>,
): Pick<AppSettings, 'locations' | 'activeLocationId'> {
  const currentSource = Array.isArray(object.locations)
    ? object.locations.find(
        (location) =>
          location !== null &&
          typeof location === 'object' &&
          !Array.isArray(location) &&
          (location as Record<string, unknown>).id === CURRENT_LOCATION_ID,
      )
    : null;
  const currentCoordinates = coordinatesFromObject(currentSource);
  const current = currentLocationEntry({
    coordinates: currentCoordinates,
    placeName:
      currentSource !== null && typeof currentSource === 'object'
        ? stringOrNull((currentSource as Record<string, unknown>).placeName)
        : null,
    updatedAt:
      currentSource !== null && typeof currentSource === 'object'
        ? timestampOrNow((currentSource as Record<string, unknown>).updatedAt)
        : null,
  });
  const manualLocations = Array.isArray(object.locations)
    ? object.locations
        .map(manualLocationFromObject)
        .filter((location): location is ManualSavedLocation => location !== null)
    : [];
  if (hasDuplicateLocationIds(manualLocations)) {
    return {
      locations: [current],
      activeLocationId: CURRENT_LOCATION_ID,
    };
  }
  const legacyCoordinates = legacyManualCoordinates(object);
  const legacyLocation =
    manualLocations.length === 0 && legacyCoordinates
      ? {
          id: LEGACY_MANUAL_LOCATION_ID,
          type: 'manual' as const,
          name: stringOrNull(object.manualPlaceName) ?? 'Saved location',
          latitude: legacyCoordinates.latitude,
          longitude: legacyCoordinates.longitude,
          placeName: stringOrNull(object.manualPlaceName),
          createdAt: 0,
          updatedAt: 0,
        }
      : null;
  const locations: SavedLocation[] = [
    current,
    ...(legacyLocation ? [legacyLocation] : manualLocations),
  ];
  const activeLocationId = stringOrNull(object.activeLocationId);
  const legacyActiveLocationId =
    object.locationMode === 'manual' && legacyLocation
      ? LEGACY_MANUAL_LOCATION_ID
      : CURRENT_LOCATION_ID;
  const candidateActiveLocationId = activeLocationId ?? legacyActiveLocationId;
  const validActiveLocationId = locations.some(
    (location) => location.id === candidateActiveLocationId,
  )
    ? candidateActiveLocationId
    : CURRENT_LOCATION_ID;

  return {
    locations,
    activeLocationId: validActiveLocationId,
  };
}

function knownProfileFactors(value: unknown): PersonalAllergyProfile['factors'] {
  const factors = booleanRecord(value);
  const knownFactors = Object.keys(DEFAULT_PROFILE.factors) as ProfileFactorId[];

  return Object.fromEntries(
    knownFactors.map((factor) => [factor, factors[factor] ?? DEFAULT_PROFILE.factors[factor]]),
  ) as PersonalAllergyProfile['factors'];
}

function isValidCachedEnvironment(value: unknown): value is CachedEnvironment['data'] {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;

  const object = value as Record<string, unknown>;
  const coordinates = object.coordinates as Record<string, unknown> | undefined;
  const metadata = object.metadata as Record<string, unknown> | undefined;

  return (
    object.provider === 'open-meteo' &&
    coordinates !== undefined &&
    isFiniteNumber(coordinates.latitude) &&
    isFiniteNumber(coordinates.longitude) &&
    object.current !== null &&
    typeof object.current === 'object' &&
    Array.isArray(object.hourly) &&
    Array.isArray(object.forecastDays) &&
    metadata !== undefined &&
    typeof metadata === 'object'
  );
}

function environmentCacheKey(coordinates: Coordinates): string {
  return `${coordinates.latitude.toFixed(5)},${coordinates.longitude.toFixed(5)}`;
}

function cachedEnvironmentFromObject(value: unknown): CachedEnvironment | null {
  const parsed = cachedEnvironmentEnvelopeSchema.safeParse(value);
  if (!parsed.success || !isValidCachedEnvironment(parsed.data.data)) return null;

  return {
    metadata: {
      version: CACHE_SCHEMA_VERSION,
      savedAt: parsed.data.metadata.savedAt,
      stale: parsed.data.metadata.stale === true,
    },
    data: normalizedCachedEnvironment(parsed.data.data),
  };
}

function newestEnvironmentCache(caches: CachedEnvironment[]): CachedEnvironment | null {
  return (
    [...caches].sort(
      (left, right) => Date.parse(right.metadata.savedAt) - Date.parse(left.metadata.savedAt),
    )[0] ?? null
  );
}

function isRiskCategory(
  value: unknown,
): value is RiskNotificationTransitionState['previousCategory'] {
  return value === 'low' || value === 'moderate' || value === 'high' || value === 'veryHigh';
}

function isRiskNotificationTransitionState(
  value: unknown,
): value is RiskNotificationTransitionState {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;

  const object = value as Record<string, unknown>;
  return (
    object.version === 1 &&
    isRiskCategory(object.previousCategory) &&
    (object.previousScoreType === 'environmental' || object.previousScoreType === 'personalized') &&
    typeof object.locationKey === 'string' &&
    (typeof object.profileFingerprint === 'string' || object.profileFingerprint === null) &&
    typeof object.lastObservationKey === 'string' &&
    (typeof object.lastDeliveredObservationKey === 'string' ||
      object.lastDeliveredObservationKey === null) &&
    typeof object.evaluatedAt === 'string' &&
    Number.isFinite(Date.parse(object.evaluatedAt))
  );
}

function isRiskCategoryValue(value: unknown): boolean {
  return (
    value === 'low' ||
    value === 'moderate' ||
    value === 'high' ||
    value === 'veryHigh' ||
    value === 'unavailable'
  );
}

function isWidgetSnapshot(value: unknown): value is WidgetSnapshot {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;

  const object = value as Record<string, unknown>;
  const score = object.headlineScore as Record<string, unknown> | null;
  return (
    object.version === WIDGET_SNAPSHOT_SCHEMA_VERSION &&
    typeof object.generatedAt === 'string' &&
    (object.entitlementKind === 'free' || object.entitlementKind === 'pro_lifetime') &&
    typeof object.compactAvailable === 'boolean' &&
    typeof object.advancedAvailable === 'boolean' &&
    isFiniteNumber(object.forecastDayLimit) &&
    (typeof object.activeLocationName === 'string' || object.activeLocationName === null) &&
    (typeof object.placeName === 'string' || object.placeName === null) &&
    typeof object.showPlaceName === 'boolean' &&
    typeof object.stale === 'boolean' &&
    (typeof object.lastUpdatedAt === 'string' || object.lastUpdatedAt === null) &&
    (score === null ||
      (typeof score === 'object' &&
        !Array.isArray(score) &&
        (score.type === 'environmental' || score.type === 'personalized') &&
        (score.label === 'Environmental burden' || score.label === 'Personalized risk') &&
        isRiskCategoryValue(score.category) &&
        typeof score.categoryLabel === 'string' &&
        isFiniteNumber(score.score) &&
        typeof score.scoreLabel === 'string')) &&
    (typeof object.mainFactorLabel === 'string' || object.mainFactorLabel === null) &&
    (typeof object.uvCategoryLabel === 'string' || object.uvCategoryLabel === null) &&
    (typeof object.bestOutdoorWindowLabel === 'string' || object.bestOutdoorWindowLabel === null) &&
    Array.isArray(object.forecastDays)
  );
}

function isVegetationFeatureSummary(value: unknown): boolean {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
  const object = value as Record<string, unknown>;
  return (
    typeof object.present === 'boolean' &&
    isFiniteNumber(object.featureCount) &&
    object.featureCount >= 0 &&
    (isFiniteNumber(object.nearestMeters) || object.nearestMeters === null)
  );
}

function isVegetationTaxonSummary(value: unknown): boolean {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
  const object = value as Record<string, unknown>;
  return (
    isFiniteNumber(object.featureCount) &&
    object.featureCount >= 0 &&
    (isFiniteNumber(object.nearestMeters) || object.nearestMeters === null)
  );
}

function isVegetationContext(value: unknown): value is NormalizedVegetationContext {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;

  const object = value as Record<string, unknown>;
  const coordinates = object.coordinates as Record<string, unknown> | undefined;
  const categories = object.categories as Record<VegetationCategoryId, unknown> | undefined;
  const mappedTaxa = object.mappedTaxa as Record<VegetationTaxonId, unknown> | undefined;
  const categoryIds: VegetationCategoryId[] = [
    'woodland',
    'grassland',
    'meadow',
    'orchard',
    'scrub',
    'parkland',
    'farmland',
  ];
  const taxonIds: VegetationTaxonId[] = ['birch', 'alder', 'olive'];

  return (
    object.provider === 'openstreetmap' &&
    coordinates !== undefined &&
    isFiniteNumber(coordinates.latitude) &&
    isFiniteNumber(coordinates.longitude) &&
    object.radiusMeters === NEARBY_VEGETATION_RADIUS_METERS &&
    typeof object.fetchedAt === 'string' &&
    typeof categories === 'object' &&
    categories !== null &&
    categoryIds.every((id) => isVegetationFeatureSummary(categories[id])) &&
    typeof mappedTaxa === 'object' &&
    mappedTaxa !== null &&
    taxonIds.every((id) => isVegetationTaxonSummary(mappedTaxa[id])) &&
    object.attribution === 'OpenStreetMap contributors' &&
    object.completeness === 'unknown'
  );
}

function isDataDetailTimeline(value: unknown): value is DataDetailTimeline {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;

  const object = value as Record<string, unknown>;
  const coordinates = object.coordinates as Record<string, unknown> | undefined;
  const summary = object.summary as Record<string, unknown> | undefined;

  return (
    typeof object.variableId === 'string' &&
    (object.rangeId === '24h' ||
      object.rangeId === 'week' ||
      object.rangeId === 'month' ||
      object.rangeId === 'year') &&
    typeof object.generatedAt === 'string' &&
    coordinates !== undefined &&
    isFiniteNumber(coordinates.latitude) &&
    isFiniteNumber(coordinates.longitude) &&
    (typeof object.timezone === 'string' || object.timezone === null) &&
    (object.granularity === 'hourly' ||
      object.granularity === 'daily' ||
      object.granularity === 'weekly') &&
    typeof object.historyAvailable === 'boolean' &&
    typeof object.forecastAvailable === 'boolean' &&
    (typeof object.forecastTruncated === 'boolean' || object.forecastTruncated === undefined) &&
    typeof object.partial === 'boolean' &&
    typeof object.now === 'string' &&
    isFiniteNumber(object.nowOffsetRatio) &&
    Array.isArray(object.points) &&
    (object.domain === null ||
      (typeof object.domain === 'object' &&
        !Array.isArray(object.domain) &&
        isFiniteNumber((object.domain as Record<string, unknown>).min) &&
        isFiniteNumber((object.domain as Record<string, unknown>).max))) &&
    summary !== undefined &&
    typeof summary === 'object' &&
    !Array.isArray(summary) &&
    (isFiniteNumber(summary.current) || summary.current === null) &&
    (isFiniteNumber(summary.minimum) || summary.minimum === null) &&
    (isFiniteNumber(summary.maximum) || summary.maximum === null) &&
    (isFiniteNumber(summary.average) || summary.average === null) &&
    (typeof object.error === 'string' || object.error === null)
  );
}

const EMPTY_EXTENDED_AIR_QUALITY: ExtendedAirQualityReadings = {
  carbonDioxide: null,
  ammonia: null,
  methane: null,
  nitrogenMonoxide: null,
  formaldehyde: null,
  nonMethaneVolatileOrganicCompounds: null,
};

const EMPTY_EXTENDED_WEATHER: ExtendedWeatherReadings = {
  apparentTemperature: null,
  precipitationProbability: null,
  pressureMsl: null,
  surfacePressure: null,
  visibility: null,
  cloudCover: null,
  cloudCoverLow: null,
  cloudCoverMid: null,
  cloudCoverHigh: null,
  dewPoint: null,
  wetBulbTemperature: null,
  windGusts: null,
  shortwaveRadiation: null,
  directNormalIrradiance: null,
  diffuseRadiation: null,
  sunshineDuration: null,
  cape: null,
  soilMoisture0To1cm: null,
  soilTemperature0cm: null,
  et0FaoEvapotranspiration: null,
  vapourPressureDeficit: null,
};

function normalizeExtendedReadings(value: unknown): ExtendedEnvironmentalReadings {
  const object =
    value !== null && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  const airQuality =
    object.airQuality !== null &&
    typeof object.airQuality === 'object' &&
    !Array.isArray(object.airQuality)
      ? (object.airQuality as Partial<ExtendedAirQualityReadings>)
      : {};
  const weather =
    object.weather !== null && typeof object.weather === 'object' && !Array.isArray(object.weather)
      ? (object.weather as Partial<ExtendedWeatherReadings>)
      : {};

  return {
    airQuality: {
      ...EMPTY_EXTENDED_AIR_QUALITY,
      ...airQuality,
    },
    weather: {
      ...EMPTY_EXTENDED_WEATHER,
      ...weather,
    },
  };
}

function normalizeReading<T extends CurrentEnvironmentalReadings | HourlyEnvironmentalReading>(
  reading: T,
): T {
  return {
    ...reading,
    extended: normalizeExtendedReadings(reading.extended),
  };
}

function normalizeCurrentReading(
  reading: CurrentEnvironmentalReadings,
): CurrentEnvironmentalReadings {
  return normalizeReading(reading);
}

function normalizeHourlyReading(reading: HourlyEnvironmentalReading): HourlyEnvironmentalReading {
  return normalizeReading(reading);
}

function normalizedCachedEnvironment(data: CachedEnvironment['data']): CachedEnvironment['data'] {
  return {
    ...data,
    current: normalizeCurrentReading(data.current),
    hourly: data.hourly.map(normalizeHourlyReading),
    metadata: {
      ...data.metadata,
      airQualitySource: data.metadata.airQualitySource ?? 'fresh',
      weatherSource: data.metadata.weatherSource ?? 'fresh',
      requestedActivityDomains: knownActivityDomains(data.metadata.requestedActivityDomains),
      requestedAirQualityVariables: knownProviderVariables(
        data.metadata.requestedAirQualityVariables,
      ),
      requestedWeatherVariables: knownProviderVariables(data.metadata.requestedWeatherVariables),
    },
  };
}

export async function loadSettings(): Promise<AppSettings> {
  const object =
    persistedSettingsSchema.safeParse(readObject(await AsyncStorage.getItem(SETTINGS_KEY))).data ??
    {};
  const locationState = locationStateFromObject(object);

  return {
    ...locationState,
    summaryScore: validScorePreference(object?.summaryScore, DEFAULT_SETTINGS.summaryScore),
    summaryLocation: validSummaryLocation(object?.summaryLocation),
    riskTransitionNotificationsEnabled: object?.riskTransitionNotificationsEnabled === true,
    riskTransitionNotificationThreshold: validRiskTransitionThreshold(
      object?.riskTransitionNotificationThreshold,
    ),
    enabledActivities: knownActivities(object?.enabledActivities),
    collapsedSections: booleanRecord(object?.collapsedSections),
    locationOnboardingComplete: object?.locationOnboardingComplete === true,
  };
}

export async function saveSettings(settings: AppSettings): Promise<void> {
  await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

export async function loadProfile(): Promise<PersonalAllergyProfile> {
  const object =
    persistedProfileSchema.safeParse(readObject(await AsyncStorage.getItem(PROFILE_KEY))).data ??
    {};
  return {
    enabled: typeof object?.enabled === 'boolean' ? object.enabled : DEFAULT_PROFILE.enabled,
    factors: knownProfileFactors(object?.factors),
  };
}

export async function saveProfile(profile: PersonalAllergyProfile): Promise<void> {
  await AsyncStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
}

async function loadEnvironmentCaches(): Promise<CachedEnvironment[]> {
  const object = readObject(await AsyncStorage.getItem(ENVIRONMENT_CACHE_KEY));
  const collection = cachedEnvironmentCollectionSchema.safeParse(object);

  if (collection.success) {
    return collection.data.entries
      .map(cachedEnvironmentFromObject)
      .filter((cache): cache is CachedEnvironment => cache !== null);
  }

  const legacyCache = cachedEnvironmentFromObject(object);
  return legacyCache ? [legacyCache] : [];
}

export async function loadEnvironmentCache(): Promise<CachedEnvironment | null> {
  return newestEnvironmentCache(await loadEnvironmentCaches());
}

export async function loadEnvironmentCacheForCoordinates(
  coordinates: Coordinates | null,
): Promise<CachedEnvironment | null> {
  if (!coordinates) return null;
  const key = environmentCacheKey(coordinates);
  return (
    (await loadEnvironmentCaches()).find(
      (cache) => environmentCacheKey(cache.data.coordinates) === key,
    ) ?? null
  );
}

export async function saveEnvironmentCache(cache: CachedEnvironment): Promise<void> {
  const key = environmentCacheKey(cache.data.coordinates);
  const existing = await loadEnvironmentCaches();
  const entries = [
    cache,
    ...existing.filter((item) => environmentCacheKey(item.data.coordinates) !== key),
  ].slice(0, 12);

  await AsyncStorage.setItem(
    ENVIRONMENT_CACHE_KEY,
    JSON.stringify({
      version: 2,
      entries,
    }),
  );
}

export async function loadRiskNotificationTransitionState(): Promise<RiskNotificationTransitionState | null> {
  const object = readObject(await AsyncStorage.getItem(RISK_NOTIFICATION_TRANSITION_KEY));
  return isRiskNotificationTransitionState(object) ? object : null;
}

export async function saveRiskNotificationTransitionState(
  state: RiskNotificationTransitionState,
): Promise<void> {
  await AsyncStorage.setItem(RISK_NOTIFICATION_TRANSITION_KEY, JSON.stringify(state));
}

export async function loadWidgetSnapshot(): Promise<WidgetSnapshotEnvelope | null> {
  const object = readObject(await AsyncStorage.getItem(WIDGET_SNAPSHOT_KEY));

  if (
    object?.version !== WIDGET_SNAPSHOT_SCHEMA_VERSION ||
    typeof object.savedAt !== 'string' ||
    !isWidgetSnapshot(object.data)
  ) {
    return null;
  }

  return {
    version: WIDGET_SNAPSHOT_SCHEMA_VERSION,
    savedAt: object.savedAt,
    data: object.data,
  };
}

export async function saveWidgetSnapshot(snapshot: WidgetSnapshot): Promise<void> {
  const envelope: WidgetSnapshotEnvelope = {
    version: WIDGET_SNAPSHOT_SCHEMA_VERSION,
    savedAt: new Date().toISOString(),
    data: snapshot,
  };

  await AsyncStorage.setItem(WIDGET_SNAPSHOT_KEY, JSON.stringify(envelope));
}

export interface BillingEntitlementCache {
  version: typeof BILLING_ENTITLEMENT_CACHE_SCHEMA_VERSION;
  entitlement: EntitlementState;
  verifiedAt: string;
  source: Extract<BillingEntitlementSource, 'revenuecat' | 'cached_revenuecat'>;
}

function isBillingEntitlementCache(value: unknown): value is BillingEntitlementCache {
  const parsed = persistedBillingEntitlementCacheSchema.safeParse(value);
  if (!parsed.success) return false;

  const object = parsed.data;
  return (
    normalizeEntitlement(object.entitlement).kind ===
    (object.entitlement as Record<string, unknown> | null)?.kind
  );
}

export async function loadBillingEntitlementCache(): Promise<BillingEntitlementCache | null> {
  const object = readObject(await AsyncStorage.getItem(BILLING_ENTITLEMENT_CACHE_KEY));
  return isBillingEntitlementCache(object) ? object : null;
}

export async function saveBillingEntitlementCache(cache: BillingEntitlementCache): Promise<void> {
  await AsyncStorage.setItem(
    BILLING_ENTITLEMENT_CACHE_KEY,
    JSON.stringify({
      version: BILLING_ENTITLEMENT_CACHE_SCHEMA_VERSION,
      entitlement: normalizeEntitlement(cache.entitlement),
      verifiedAt: cache.verifiedAt,
      source: cache.source,
    }),
  );
}

function vegetationCacheFromObject(value: unknown): CachedVegetationContext | null {
  if (
    value === null ||
    typeof value !== 'object' ||
    Array.isArray(value) ||
    (value as Record<string, unknown>).metadata === null ||
    typeof (value as Record<string, unknown>).metadata !== 'object' ||
    (value as Record<string, unknown>).data === null ||
    (value as Record<string, unknown>).data === undefined
  ) {
    return null;
  }

  const object = value as Record<string, unknown>;
  const metadata = object.metadata as Record<string, unknown>;
  if (
    metadata.version !== VEGETATION_CACHE_SCHEMA_VERSION ||
    typeof metadata.savedAt !== 'string' ||
    typeof metadata.cacheKey !== 'string'
  ) {
    return null;
  }

  if (!isVegetationContext(object.data)) {
    return null;
  }

  if (metadata.cacheKey !== vegetationCacheKey(object.data.coordinates)) {
    return null;
  }

  return {
    metadata: {
      version: VEGETATION_CACHE_SCHEMA_VERSION,
      savedAt: metadata.savedAt,
      cacheKey: metadata.cacheKey,
    },
    data: object.data,
  };
}

export async function loadVegetationCache(): Promise<CachedVegetationContext[]> {
  const parsed = vegetationCacheEnvelopeSchema.safeParse(
    readObject(await AsyncStorage.getItem(VEGETATION_CACHE_KEY)),
  );
  if (!parsed.success) return [];

  return parsed.data.entries
    .map(vegetationCacheFromObject)
    .filter((entry): entry is CachedVegetationContext => entry !== null)
    .slice(0, MAX_VEGETATION_CACHE_ENTRIES);
}

export async function saveVegetationCache(cache: CachedVegetationContext): Promise<void> {
  const existing = await loadVegetationCache();
  const entries = [
    cache,
    ...existing.filter((entry) => entry.metadata.cacheKey !== cache.metadata.cacheKey),
  ].slice(0, MAX_VEGETATION_CACHE_ENTRIES);

  await AsyncStorage.setItem(
    VEGETATION_CACHE_KEY,
    JSON.stringify({
      version: VEGETATION_CACHE_SCHEMA_VERSION,
      entries,
    }),
  );
}

export async function loadDataDetailCache(
  cacheKey: string,
): Promise<CachedDataDetailTimeline | null> {
  const parsed = dataDetailCacheEnvelopeSchema.safeParse(
    readObject(await AsyncStorage.getItem(`${DATA_DETAIL_CACHE_PREFIX}${cacheKey}`)),
  );

  if (
    !parsed.success ||
    parsed.data.cacheKey !== cacheKey ||
    !isDataDetailTimeline(parsed.data.data)
  ) {
    return null;
  }

  return {
    version: DATA_DETAIL_CACHE_SCHEMA_VERSION,
    savedAt: parsed.data.savedAt,
    cacheKey,
    data: {
      ...parsed.data.data,
      forecastTruncated: parsed.data.data.forecastTruncated ?? false,
    },
  };
}

export async function saveDataDetailCache(cache: CachedDataDetailTimeline): Promise<void> {
  await AsyncStorage.setItem(`${DATA_DETAIL_CACHE_PREFIX}${cache.cacheKey}`, JSON.stringify(cache));
}

export async function loadDevelopmentEntitlementOverride(): Promise<EntitlementState | null> {
  if (!__DEV__) return null;

  const object = readObject(await AsyncStorage.getItem(DEVELOPMENT_ENTITLEMENT_OVERRIDE_KEY));
  return object ? normalizeEntitlement(object) : null;
}

export async function saveDevelopmentEntitlementOverride(
  entitlement: EntitlementState | null,
): Promise<void> {
  if (!__DEV__) return;

  if (entitlement === null) {
    await AsyncStorage.removeItem(DEVELOPMENT_ENTITLEMENT_OVERRIDE_KEY);
    return;
  }

  await AsyncStorage.setItem(
    DEVELOPMENT_ENTITLEMENT_OVERRIDE_KEY,
    JSON.stringify(normalizeEntitlement(entitlement)),
  );
}

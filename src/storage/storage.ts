import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  CACHE_SCHEMA_VERSION,
  DATA_DETAIL_CACHE_SCHEMA_VERSION,
  VEGETATION_CACHE_SCHEMA_VERSION,
} from '../core/constants';
import type {
  CachedEnvironment,
  CurrentEnvironmentalReadings,
  ExtendedAirQualityReadings,
  ExtendedEnvironmentalReadings,
  ExtendedWeatherReadings,
  HourlyEnvironmentalReading,
} from '../models/environment';
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
import { isFiniteNumber } from '../utils/number';
import { ACTIVITY_IDS, DEFAULT_ACTIVITY_SETTINGS } from '../core/activityDefinitions';
import type { ActivitySettings } from '../models/activities';

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

function readObject(value: string | null): Record<string, unknown> | null {
  if (value === null) return null;

  try {
    const parsed = JSON.parse(value);
    return parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null;
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

function validLocationMode(value: unknown): AppSettings['locationMode'] {
  return value === 'manual' || value === 'automatic' ? value : DEFAULT_SETTINGS.locationMode;
}

function validRefreshInterval(value: unknown): AppSettings['refreshIntervalMinutes'] {
  return value === 30 || value === 60 || value === 120
    ? value
    : DEFAULT_SETTINGS.refreshIntervalMinutes;
}

function validVegetationRadius(value: unknown): AppSettings['nearbyVegetationRadiusMeters'] {
  return value === 1000 || value === 2000 || value === 5000
    ? value
    : DEFAULT_SETTINGS.nearbyVegetationRadiusMeters;
}

function validOutdoorWindowDuration(value: unknown): AppSettings['outdoorWindowDurationHours'] {
  return value === 1 || value === 2 || value === 3
    ? value
    : DEFAULT_SETTINGS.outdoorWindowDurationHours;
}

function validScorePreference(
  value: unknown,
  fallback: AppSettings['headlineScore'],
): AppSettings['headlineScore'] {
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
  return Object.fromEntries(
    ACTIVITY_IDS.map((activityId) => [
      activityId,
      activities[activityId] ?? DEFAULT_ACTIVITY_SETTINGS[activityId],
    ]),
  ) as ActivitySettings;
}

function stringOrDefault(value: unknown, fallback: string): string {
  return typeof value === 'string' ? value : fallback;
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
    (object.radiusMeters === 1000 ||
      object.radiusMeters === 2000 ||
      object.radiusMeters === 5000) &&
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
    },
  };
}

export async function loadSettings(): Promise<AppSettings> {
  const object = readObject(await AsyncStorage.getItem(SETTINGS_KEY));

  return {
    locationMode: validLocationMode(object?.locationMode),
    manualLatitude: stringOrDefault(object?.manualLatitude, DEFAULT_SETTINGS.manualLatitude),
    manualLongitude: stringOrDefault(object?.manualLongitude, DEFAULT_SETTINGS.manualLongitude),
    refreshIntervalMinutes: validRefreshInterval(object?.refreshIntervalMinutes),
    nearbyVegetationRadiusMeters: validVegetationRadius(object?.nearbyVegetationRadiusMeters),
    outdoorWindowDurationHours: validOutdoorWindowDuration(object?.outdoorWindowDurationHours),
    headlineScore: validScorePreference(object?.headlineScore, DEFAULT_SETTINGS.headlineScore),
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
  const object = readObject(await AsyncStorage.getItem(PROFILE_KEY));
  return {
    enabled: object?.enabled === true,
    factors: knownProfileFactors(object?.factors),
  };
}

export async function saveProfile(profile: PersonalAllergyProfile): Promise<void> {
  await AsyncStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
}

export async function loadEnvironmentCache(): Promise<CachedEnvironment | null> {
  const object = readObject(await AsyncStorage.getItem(ENVIRONMENT_CACHE_KEY));

  if (object?.metadata === null || typeof object?.metadata !== 'object' || object?.data === null) {
    return null;
  }

  const metadata = object.metadata as Record<string, unknown>;
  if (metadata.version !== CACHE_SCHEMA_VERSION || typeof metadata.savedAt !== 'string') {
    return null;
  }

  if (!isValidCachedEnvironment(object.data)) {
    return null;
  }

  return {
    metadata: {
      version: CACHE_SCHEMA_VERSION,
      savedAt: metadata.savedAt,
      stale: metadata.stale === true,
    },
    data: normalizedCachedEnvironment(object.data),
  };
}

export async function saveEnvironmentCache(cache: CachedEnvironment): Promise<void> {
  await AsyncStorage.setItem(ENVIRONMENT_CACHE_KEY, JSON.stringify(cache));
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
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;

  const object = value as Record<string, unknown>;
  return (
    object.version === BILLING_ENTITLEMENT_CACHE_SCHEMA_VERSION &&
    (object.source === 'revenuecat' || object.source === 'cached_revenuecat') &&
    typeof object.verifiedAt === 'string' &&
    Number.isFinite(Date.parse(object.verifiedAt)) &&
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

export async function loadVegetationCache(): Promise<CachedVegetationContext | null> {
  const object = readObject(await AsyncStorage.getItem(VEGETATION_CACHE_KEY));

  if (
    object?.metadata === null ||
    typeof object?.metadata !== 'object' ||
    object?.data === null ||
    object.data === undefined
  ) {
    return null;
  }

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

  return {
    metadata: {
      version: VEGETATION_CACHE_SCHEMA_VERSION,
      savedAt: metadata.savedAt,
      cacheKey: metadata.cacheKey,
    },
    data: object.data,
  };
}

export async function saveVegetationCache(cache: CachedVegetationContext): Promise<void> {
  await AsyncStorage.setItem(VEGETATION_CACHE_KEY, JSON.stringify(cache));
}

export async function loadDataDetailCache(
  cacheKey: string,
): Promise<CachedDataDetailTimeline | null> {
  const object = readObject(await AsyncStorage.getItem(`${DATA_DETAIL_CACHE_PREFIX}${cacheKey}`));

  if (
    object?.version !== DATA_DETAIL_CACHE_SCHEMA_VERSION ||
    typeof object.savedAt !== 'string' ||
    object.cacheKey !== cacheKey ||
    !isDataDetailTimeline(object.data)
  ) {
    return null;
  }

  return {
    version: DATA_DETAIL_CACHE_SCHEMA_VERSION,
    savedAt: object.savedAt,
    cacheKey,
    data: {
      ...object.data,
      forecastTruncated: object.data.forecastTruncated ?? false,
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

import AsyncStorage from '@react-native-async-storage/async-storage';
import { CACHE_SCHEMA_VERSION } from '../core/constants';
import type { CachedEnvironment } from '../models/environment';
import {
  DEFAULT_PROFILE,
  DEFAULT_SETTINGS,
  type AppSettings,
  type PersonalAllergyProfile,
  type ProfileFactorId,
} from '../models/profile';
import { isFiniteNumber } from '../utils/number';

const SETTINGS_KEY = 'airaware.settings.v1';
const PROFILE_KEY = 'airaware.profile.v1';
const ENVIRONMENT_CACHE_KEY = 'airaware.environment-cache.v1';

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
  return value === 60 || value === 120 || value === 240 || value === 360
    ? value
    : DEFAULT_SETTINGS.refreshIntervalMinutes;
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

function normalizedCachedEnvironment(data: CachedEnvironment['data']): CachedEnvironment['data'] {
  return {
    ...data,
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
    outdoorWindowDurationHours: validOutdoorWindowDuration(object?.outdoorWindowDurationHours),
    headlineScore: validScorePreference(object?.headlineScore, DEFAULT_SETTINGS.headlineScore),
    forecastScore: validScorePreference(object?.forecastScore, DEFAULT_SETTINGS.forecastScore),
    summaryScore: validScorePreference(object?.summaryScore, DEFAULT_SETTINGS.summaryScore),
    summaryLocation: validSummaryLocation(object?.summaryLocation),
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

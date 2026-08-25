import * as Location from 'expo-location';
import { PermissionsAndroid, Platform } from 'react-native';
import type { Coordinates, LocationInfo } from '../models/environment';
import {
  CURRENT_LOCATION_ID,
  CURRENT_LOCATION_NAME,
  activeSavedLocation,
  coordinatesForSavedLocation,
  locationDisplayName,
  type SavedLocationState,
} from '../models/location';
import type { AppSettings } from '../models/profile';

export type PermissionStatus = 'granted' | 'denied' | 'unknown';

interface ReverseGeocodeResult {
  city?: string | null;
  district?: string | null;
  subregion?: string | null;
  region?: string | null;
  country?: string | null;
}

export interface LocationDependencies {
  platform: string;
  getPermission: () => Promise<PermissionStatus>;
  requestPermission: () => Promise<PermissionStatus>;
  getLastKnownCoordinates?: () => Promise<Coordinates | null>;
  getCurrentCoordinates: () => Promise<Coordinates>;
  reverseGeocode: (coordinates: Coordinates) => Promise<ReverseGeocodeResult[]>;
}

interface LegacyLocationSettings {
  locationMode?: unknown;
  manualLatitude?: unknown;
  manualLongitude?: unknown;
}

interface AndroidCoarsePermissionDependencies {
  checkCoarsePermission: () => Promise<boolean>;
  requestCoarsePermission: () => Promise<string>;
  getForegroundPermission: () => Promise<{
    status: string;
    canAskAgain?: boolean;
  }>;
  grantedResult: string;
}

const LOCATION_LOOKUP_TIMEOUT_MS = 8000;
const LAST_KNOWN_LOCATION_MAX_AGE_MS = 6 * 60 * 60 * 1000;
const LAST_KNOWN_LOCATION_REQUIRED_ACCURACY_METERS = 10000;

export function parseManualCoordinates(settings: LegacyLocationSettings): Coordinates | null {
  const latitude = Number(settings.manualLatitude);
  const longitude = Number(settings.manualLongitude);

  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) return null;

  return { latitude, longitude };
}

function defaultAndroidCoarsePermissionDependencies(): AndroidCoarsePermissionDependencies {
  return {
    checkCoarsePermission: () =>
      PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION),
    requestCoarsePermission: () =>
      PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION),
    getForegroundPermission: Location.getForegroundPermissionsAsync,
    grantedResult: PermissionsAndroid.RESULTS.GRANTED,
  };
}

export async function getAndroidCoarseLocationPermissionStatus(
  dependencies: AndroidCoarsePermissionDependencies = defaultAndroidCoarsePermissionDependencies(),
): Promise<PermissionStatus> {
  try {
    if (await dependencies.checkCoarsePermission()) return 'granted';
  } catch {
    return 'unknown';
  }

  try {
    const permission = await dependencies.getForegroundPermission();
    if (permission.status === 'denied' && permission.canAskAgain === false) return 'denied';
  } catch {
    return 'unknown';
  }

  return 'unknown';
}

export async function requestAndroidCoarseLocationPermission(
  dependencies: AndroidCoarsePermissionDependencies = defaultAndroidCoarsePermissionDependencies(),
): Promise<PermissionStatus> {
  try {
    const result = await dependencies.requestCoarsePermission();
    return result === dependencies.grantedResult ? 'granted' : 'denied';
  } catch {
    return 'denied';
  }
}

function coordinatesFromLocationObject(location: Location.LocationObject): Coordinates {
  return {
    latitude: location.coords.latitude,
    longitude: location.coords.longitude,
  };
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, message: string): Promise<T> {
  let timeout: ReturnType<typeof setTimeout>;
  const timeoutPromise = new Promise<T>((_, reject) => {
    timeout = setTimeout(() => reject(new Error(message)), timeoutMs);
  });

  return Promise.race([promise, timeoutPromise]).finally(() => clearTimeout(timeout));
}

function defaultDependencies(): LocationDependencies {
  const expoForegroundPermission = async (): Promise<PermissionStatus> => {
    const permission = await Location.getForegroundPermissionsAsync();

    if (permission.status === 'granted') return 'granted';
    if (permission.status === 'denied') return 'denied';
    return 'unknown';
  };
  return {
    platform: Platform.OS,
    getPermission:
      Platform.OS === 'android'
        ? getAndroidCoarseLocationPermissionStatus
        : expoForegroundPermission,
    requestPermission: async () => {
      if (Platform.OS === 'android') {
        return requestAndroidCoarseLocationPermission();
      }

      const permission = await Location.requestForegroundPermissionsAsync();

      if (permission.status === 'granted') return 'granted';
      if (permission.status === 'denied') return 'denied';
      return 'unknown';
    },
    getLastKnownCoordinates: async () => {
      const location = await Location.getLastKnownPositionAsync({
        maxAge: LAST_KNOWN_LOCATION_MAX_AGE_MS,
        requiredAccuracy: LAST_KNOWN_LOCATION_REQUIRED_ACCURACY_METERS,
      });

      return location ? coordinatesFromLocationObject(location) : null;
    },
    getCurrentCoordinates: async () => {
      const location = await withTimeout(
        Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Low,
          mayShowUserSettingsDialog: false,
        }),
        LOCATION_LOOKUP_TIMEOUT_MS,
        'Current location lookup timed out.',
      );

      return coordinatesFromLocationObject(location);
    },
    reverseGeocode: (coordinates) => Location.reverseGeocodeAsync(coordinates),
  };
}

function placeNameFromReverseGeocode(results: ReverseGeocodeResult[]): string | null {
  const first = results[0];

  return (
    first?.city ?? first?.district ?? first?.subregion ?? first?.region ?? first?.country ?? null
  );
}

export async function reverseGeocodePlaceName(
  coordinates: Coordinates,
  dependencies: LocationDependencies = defaultDependencies(),
): Promise<string | null> {
  if (dependencies.platform === 'web') {
    return null;
  }

  try {
    return placeNameFromReverseGeocode(await dependencies.reverseGeocode(coordinates));
  } catch (error) {
    console.warn('AirAware: reverse geocoding failed', error);
    return null;
  }
}

async function manualLocation(
  settings: LegacyLocationSettings,
  dependencies: LocationDependencies,
  permissionStatus: LocationInfo['permissionStatus'],
  mode: LocationInfo['mode'],
): Promise<LocationInfo> {
  const coordinates = parseManualCoordinates(settings);

  return {
    activeLocationId: 'manual',
    activeLocationName: 'Saved location',
    coordinates,
    placeName: coordinates ? await reverseGeocodePlaceName(coordinates, dependencies) : null,
    mode,
    permissionStatus,
  };
}

function automaticLocationInfo(input: {
  coordinates: Coordinates | null;
  placeName: string | null;
  permissionStatus: LocationInfo['permissionStatus'];
}): LocationInfo {
  return {
    activeLocationId: CURRENT_LOCATION_ID,
    activeLocationName: CURRENT_LOCATION_NAME,
    coordinates: input.coordinates,
    placeName: input.placeName,
    mode: 'automatic',
    permissionStatus: input.permissionStatus,
  };
}

function unavailableAutomaticLocation(
  permissionStatus: Extract<LocationInfo['permissionStatus'], 'denied' | 'unavailable'>,
): LocationInfo {
  return automaticLocationInfo({
    coordinates: null,
    placeName: null,
    permissionStatus,
  });
}

export async function resolveLocation(
  settings: LegacyLocationSettings | AppSettings,
  dependencies: LocationDependencies = defaultDependencies(),
): Promise<LocationInfo> {
  const legacySettings = settings as LegacyLocationSettings;
  if (legacySettings.locationMode === 'manual') {
    return manualLocation(legacySettings, dependencies, 'unknown', 'manual');
  }

  try {
    const currentPermission = await dependencies.getPermission();
    const permission =
      currentPermission === 'unknown' ? await dependencies.requestPermission() : currentPermission;

    if (permission !== 'granted') {
      return unavailableAutomaticLocation('denied');
    }

    let lastKnownCoordinates: Coordinates | null = null;
    try {
      lastKnownCoordinates = (await dependencies.getLastKnownCoordinates?.()) ?? null;
    } catch (error) {
      console.warn('AirAware: last-known location lookup failed', error);
    }
    const coordinates = lastKnownCoordinates ?? (await dependencies.getCurrentCoordinates());
    const placeName = await reverseGeocodePlaceName(coordinates, dependencies);

    return automaticLocationInfo({
      coordinates,
      placeName,
      permissionStatus: 'granted',
    });
  } catch (error) {
    console.warn('AirAware: location lookup failed', error);
    return unavailableAutomaticLocation('unavailable');
  }
}

export async function resolveActiveLocation(
  settings: SavedLocationState,
  dependencies: LocationDependencies = defaultDependencies(),
): Promise<LocationInfo> {
  const activeLocation = activeSavedLocation(settings);

  if (activeLocation.type === 'current') {
    const storedCoordinates = coordinatesForSavedLocation(activeLocation);
    const resolved = await resolveLocation({ locationMode: 'automatic' }, dependencies);

    return {
      ...resolved,
      activeLocationId: CURRENT_LOCATION_ID,
      activeLocationName: CURRENT_LOCATION_NAME,
      coordinates: resolved.coordinates ?? storedCoordinates,
      placeName: resolved.placeName ?? activeLocation.placeName ?? null,
    };
  }

  const coordinates = coordinatesForSavedLocation(activeLocation);
  const fallbackPlaceName = activeLocation.placeName ?? null;

  return {
    activeLocationId: activeLocation.id,
    activeLocationName: locationDisplayName(activeLocation),
    coordinates,
    placeName: locationDisplayName(activeLocation) || fallbackPlaceName,
    mode: 'manual',
    permissionStatus: 'unknown',
  };
}

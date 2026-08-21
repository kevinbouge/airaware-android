import * as Location from 'expo-location';
import { Platform } from 'react-native';
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

type PermissionStatus = 'granted' | 'denied' | 'unknown';

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
  getCurrentCoordinates: () => Promise<Coordinates>;
  reverseGeocode: (coordinates: Coordinates) => Promise<ReverseGeocodeResult[]>;
}

interface LegacyLocationSettings {
  locationMode?: unknown;
  manualLatitude?: unknown;
  manualLongitude?: unknown;
}

export function parseManualCoordinates(settings: LegacyLocationSettings): Coordinates | null {
  const latitude = Number(settings.manualLatitude);
  const longitude = Number(settings.manualLongitude);

  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) return null;

  return { latitude, longitude };
}

function defaultDependencies(): LocationDependencies {
  return {
    platform: Platform.OS,
    getPermission: async () => {
      const permission = await Location.getForegroundPermissionsAsync();

      if (permission.status === 'granted') return 'granted';
      if (permission.status === 'denied') return 'denied';
      return 'unknown';
    },
    requestPermission: async () => {
      const permission = await Location.requestForegroundPermissionsAsync();

      if (permission.status === 'granted') return 'granted';
      if (permission.status === 'denied') return 'denied';
      return 'unknown';
    },
    getCurrentCoordinates: async () => {
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Low,
      });

      return {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      };
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

    const coordinates = await dependencies.getCurrentCoordinates();
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
    const resolved = await resolveLocation({ locationMode: 'automatic' }, dependencies);

    return {
      ...resolved,
      activeLocationId: CURRENT_LOCATION_ID,
      activeLocationName: CURRENT_LOCATION_NAME,
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

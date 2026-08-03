import * as Location from 'expo-location';
import { Platform } from 'react-native';
import type { Coordinates, LocationInfo } from '../models/environment';
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

export function parseManualCoordinates(settings: AppSettings): Coordinates | null {
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

async function reverseGeocode(
  coordinates: Coordinates,
  dependencies: LocationDependencies,
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
  settings: AppSettings,
  dependencies: LocationDependencies,
  permissionStatus: LocationInfo['permissionStatus'],
  mode: LocationInfo['mode'],
): Promise<LocationInfo> {
  const coordinates = parseManualCoordinates(settings);

  return {
    coordinates,
    placeName: coordinates ? await reverseGeocode(coordinates, dependencies) : null,
    mode,
    permissionStatus,
  };
}

function unavailableAutomaticLocation(
  permissionStatus: Extract<LocationInfo['permissionStatus'], 'denied' | 'unavailable'>,
): LocationInfo {
  return {
    coordinates: null,
    placeName: null,
    mode: 'automatic',
    permissionStatus,
  };
}

export async function resolveLocation(
  settings: AppSettings,
  dependencies: LocationDependencies = defaultDependencies(),
): Promise<LocationInfo> {
  if (settings.locationMode === 'manual') {
    return manualLocation(settings, dependencies, 'unknown', 'manual');
  }

  try {
    const currentPermission = await dependencies.getPermission();
    const permission =
      currentPermission === 'unknown' ? await dependencies.requestPermission() : currentPermission;

    if (permission !== 'granted') {
      return unavailableAutomaticLocation('denied');
    }

    const coordinates = await dependencies.getCurrentCoordinates();
    const placeName = await reverseGeocode(coordinates, dependencies);

    return {
      coordinates,
      placeName,
      mode: 'automatic',
      permissionStatus: 'granted',
    };
  } catch (error) {
    console.warn('AirAware: location lookup failed', error);
    return unavailableAutomaticLocation('unavailable');
  }
}

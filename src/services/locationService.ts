import * as Location from 'expo-location';
import { Platform } from 'react-native';
import type { Coordinates, LocationInfo } from '../models/environment';
import type { AppSettings } from '../models/profile';

type PermissionStatus = 'granted' | 'denied';

interface ReverseGeocodeResult {
  city?: string | null;
  district?: string | null;
  subregion?: string | null;
  region?: string | null;
  country?: string | null;
}

export interface LocationDependencies {
  platform: string;
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
    requestPermission: async () => {
      const permission = await Location.requestForegroundPermissionsAsync();
      return permission.status === 'granted' ? 'granted' : 'denied';
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

export async function resolveLocation(
  settings: AppSettings,
  dependencies: LocationDependencies = defaultDependencies(),
): Promise<LocationInfo> {
  if (settings.locationMode === 'manual') {
    return manualLocation(settings, dependencies, 'unknown', 'manual');
  }

  try {
    const permission = await dependencies.requestPermission();

    if (permission !== 'granted') {
      return manualLocation(settings, dependencies, 'denied', 'automatic');
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
    return manualLocation(settings, dependencies, 'unavailable', 'automatic');
  }
}

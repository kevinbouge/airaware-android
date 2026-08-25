import type { Coordinates } from './environment';

export const CURRENT_LOCATION_ID = 'current';
export const CURRENT_LOCATION_NAME = 'Current location';
export const LEGACY_MANUAL_LOCATION_ID = 'manual-legacy';

export interface CurrentSavedLocation {
  id: typeof CURRENT_LOCATION_ID;
  type: 'current';
  name: typeof CURRENT_LOCATION_NAME;
  latitude: number | null;
  longitude: number | null;
  placeName: string | null;
  updatedAt: number | null;
}

export interface ManualSavedLocation {
  id: string;
  type: 'manual';
  name: string;
  latitude: number;
  longitude: number;
  placeName: string | null;
  countryCode?: string | null | undefined;
  countryName?: string | null | undefined;
  createdAt: number;
  updatedAt: number;
}

export type SavedLocation = CurrentSavedLocation | ManualSavedLocation;

export interface SavedLocationState {
  locations: SavedLocation[];
  activeLocationId: string;
}

export function currentLocationEntry(input?: {
  coordinates?: Coordinates | null | undefined;
  placeName?: string | null | undefined;
  updatedAt?: number | null | undefined;
}): CurrentSavedLocation {
  return {
    id: CURRENT_LOCATION_ID,
    type: 'current',
    name: CURRENT_LOCATION_NAME,
    latitude: input?.coordinates?.latitude ?? null,
    longitude: input?.coordinates?.longitude ?? null,
    placeName: input?.placeName ?? null,
    updatedAt: input?.updatedAt ?? null,
  };
}

export function coordinatesForSavedLocation(location: SavedLocation): Coordinates | null {
  if (location.latitude === null || location.longitude === null) return null;
  return { latitude: location.latitude, longitude: location.longitude };
}

export function locationDisplayName(location: SavedLocation): string {
  return (
    location.name.trim() || (location.type === 'current' ? CURRENT_LOCATION_NAME : 'Saved location')
  );
}

export function activeSavedLocation(settings: SavedLocationState): SavedLocation {
  return (
    settings.locations.find((location) => location.id === settings.activeLocationId) ??
    settings.locations.find((location) => location.id === CURRENT_LOCATION_ID) ??
    currentLocationEntry()
  );
}

export function locationDisplayNameById(settings: SavedLocationState, id: string): string {
  return locationDisplayName(
    settings.locations.find((location) => location.id === id) ?? currentLocationEntry(),
  );
}

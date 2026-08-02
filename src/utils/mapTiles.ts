import type { Coordinates } from '../models/environment';

export const MAP_TILE_SIZE = 256;
export const MAP_MIN_ZOOM = 2;
export const MAP_MAX_ZOOM = 15;

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, value));
}

export function clampMapZoom(zoom: number): number {
  return Math.round(clamp(zoom, MAP_MIN_ZOOM, MAP_MAX_ZOOM));
}

export function normalizeLongitude(longitude: number): number {
  const normalized = ((((longitude + 180) % 360) + 360) % 360) - 180;
  return normalized === -180 ? 180 : normalized;
}

export function clampLatitude(latitude: number): number {
  return clamp(latitude, -85.05112878, 85.05112878);
}

export function coordinatesToWorldPixel(coordinates: Coordinates, zoom: number) {
  const safeZoom = clampMapZoom(zoom);
  const scale = MAP_TILE_SIZE * 2 ** safeZoom;
  const latitude = clampLatitude(coordinates.latitude);
  const longitude = normalizeLongitude(coordinates.longitude);
  const sinLatitude = Math.sin((latitude * Math.PI) / 180);

  return {
    x: ((longitude + 180) / 360) * scale,
    y: (0.5 - Math.log((1 + sinLatitude) / (1 - sinLatitude)) / (4 * Math.PI)) * scale,
  };
}

export function worldPixelToCoordinates(x: number, y: number, zoom: number): Coordinates {
  const safeZoom = clampMapZoom(zoom);
  const scale = MAP_TILE_SIZE * 2 ** safeZoom;
  const longitude = (x / scale) * 360 - 180;
  const n = Math.PI - (2 * Math.PI * y) / scale;
  const latitude = (180 / Math.PI) * Math.atan(Math.sinh(n));

  return {
    latitude: clampLatitude(latitude),
    longitude: normalizeLongitude(longitude),
  };
}

export function mapTileUrl(x: number, y: number, zoom: number): string {
  const safeZoom = clampMapZoom(zoom);
  const tileCount = 2 ** safeZoom;
  const wrappedX = ((x % tileCount) + tileCount) % tileCount;
  const clampedY = clamp(y, 0, tileCount - 1);

  return `https://tile.openstreetmap.org/${safeZoom}/${wrappedX}/${clampedY}.png`;
}

export function formatMapCoordinate(value: number): string {
  return value.toFixed(5);
}

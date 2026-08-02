import {
  clampLatitude,
  clampMapZoom,
  coordinatesToWorldPixel,
  formatMapCoordinate,
  mapTileUrl,
  normalizeLongitude,
  worldPixelToCoordinates,
} from '../src/utils/mapTiles';

describe('map tile utilities', () => {
  it('round-trips coordinates through Web Mercator pixels', () => {
    const coordinates = { latitude: 50.0755, longitude: 14.4378 };
    const pixel = coordinatesToWorldPixel(coordinates, 10);
    const roundTrip = worldPixelToCoordinates(pixel.x, pixel.y, 10);

    expect(roundTrip.latitude).toBeCloseTo(coordinates.latitude, 5);
    expect(roundTrip.longitude).toBeCloseTo(coordinates.longitude, 5);
  });

  it('clamps map zoom and Web Mercator latitude safely', () => {
    expect(clampMapZoom(-10)).toBe(2);
    expect(clampMapZoom(99)).toBe(15);
    expect(clampLatitude(90)).toBeCloseTo(85.05112878);
    expect(clampLatitude(-90)).toBeCloseTo(-85.05112878);
  });

  it('normalizes longitudes and wraps tile columns', () => {
    expect(normalizeLongitude(181)).toBeCloseTo(-179);
    expect(normalizeLongitude(-181)).toBeCloseTo(179);
    expect(mapTileUrl(-1, -2, 2)).toBe('https://tile.openstreetmap.org/2/3/0.png');
  });

  it('formats selected coordinates for manual settings storage', () => {
    expect(formatMapCoordinate(50.07554321)).toBe('50.07554');
  });
});

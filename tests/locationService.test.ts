import {
  parseManualCoordinates,
  resolveActiveLocation,
  resolveLocation,
  reverseGeocodePlaceName,
} from '../src/services/locationService';
import { CURRENT_LOCATION_ID, currentLocationEntry } from '../src/models/location';
import { DEFAULT_SETTINGS } from '../src/models/profile';

function dependencies(overrides = {}) {
  return {
    platform: 'android',
    getPermission: jest.fn(async () => 'unknown' as const),
    requestPermission: jest.fn(async () => 'granted' as const),
    getCurrentCoordinates: jest.fn(async () => ({ latitude: 50.0755, longitude: 14.4378 })),
    reverseGeocode: jest.fn(async () => [{ city: 'Prague' }]),
    ...overrides,
  };
}

describe('location service', () => {
  it('parses valid manual coordinates', () => {
    expect(
      parseManualCoordinates({
        ...DEFAULT_SETTINGS,
        manualLatitude: '50.0755',
        manualLongitude: '14.4378',
      }),
    ).toEqual({ latitude: 50.0755, longitude: 14.4378 });
  });

  it('reverse geocodes manual coordinates on native platforms', async () => {
    const deps = dependencies();
    const location = await resolveLocation(
      {
        ...DEFAULT_SETTINGS,
        locationMode: 'manual',
        manualLatitude: '50.0755',
        manualLongitude: '14.4378',
      },
      deps,
    );

    expect(location.coordinates).toEqual({ latitude: 50.0755, longitude: 14.4378 });
    expect(location.placeName).toBe('Prague');
    expect(deps.reverseGeocode).toHaveBeenCalledTimes(1);
  });

  it('does not call Expo reverse geocoding on web', async () => {
    const deps = dependencies({ platform: 'web' });
    const location = await resolveLocation(
      {
        ...DEFAULT_SETTINGS,
        locationMode: 'manual',
        manualLatitude: '50.0755',
        manualLongitude: '14.4378',
      },
      deps,
    );

    expect(location.placeName).toBeNull();
    expect(deps.reverseGeocode).not.toHaveBeenCalled();
  });

  it('does not silently use manual coordinates when automatic permission is denied', async () => {
    const deps = dependencies({
      getPermission: jest.fn(async () => 'unknown' as const),
      requestPermission: jest.fn(async () => 'denied' as const),
    });
    const location = await resolveLocation(
      {
        ...DEFAULT_SETTINGS,
        locationMode: 'automatic',
        manualLatitude: '50.0755',
        manualLongitude: '14.4378',
      },
      deps,
    );

    expect(location.permissionStatus).toBe('denied');
    expect(location.mode).toBe('automatic');
    expect(location.coordinates).toBeNull();
    expect(location.placeName).toBeNull();
    expect(deps.reverseGeocode).not.toHaveBeenCalled();
  });

  it('does not request automatic location permission again after denial', async () => {
    const deps = dependencies({
      getPermission: jest.fn(async () => 'denied' as const),
    });
    const location = await resolveLocation(
      {
        ...DEFAULT_SETTINGS,
        locationMode: 'automatic',
        manualLatitude: '50.0755',
        manualLongitude: '14.4378',
      },
      deps,
    );

    expect(location.permissionStatus).toBe('denied');
    expect(deps.requestPermission).not.toHaveBeenCalled();
    expect(location.coordinates).toBeNull();
  });

  it('returns unavailable automatic location when device lookup fails', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    const deps = dependencies({
      getPermission: jest.fn(async () => 'granted' as const),
      getCurrentCoordinates: jest.fn(async () => {
        throw new Error('location unavailable');
      }),
    });

    try {
      const location = await resolveLocation(
        {
          ...DEFAULT_SETTINGS,
          locationMode: 'automatic',
          manualLatitude: '50.0755',
          manualLongitude: '14.4378',
        },
        deps,
      );

      expect(location.permissionStatus).toBe('unavailable');
      expect(location.mode).toBe('automatic');
      expect(location.coordinates).toBeNull();
      expect(location.placeName).toBeNull();
    } finally {
      warn.mockRestore();
    }
  });

  it('uses existing automatic location permission without prompting', async () => {
    const deps = dependencies({
      getPermission: jest.fn(async () => 'granted' as const),
    });
    const location = await resolveLocation(DEFAULT_SETTINGS, deps);

    expect(deps.requestPermission).not.toHaveBeenCalled();
    expect(deps.getCurrentCoordinates).toHaveBeenCalledTimes(1);
    expect(location.placeName).toBe('Prague');
  });

  it('resolves Current location through the automatic foreground flow', async () => {
    const deps = dependencies({
      getPermission: jest.fn(async () => 'granted' as const),
    });

    const location = await resolveActiveLocation(
      {
        locations: [currentLocationEntry()],
        activeLocationId: CURRENT_LOCATION_ID,
      },
      deps,
    );

    expect(location.activeLocationId).toBe(CURRENT_LOCATION_ID);
    expect(location.mode).toBe('automatic');
    expect(location.coordinates).toEqual({ latitude: 50.0755, longitude: 14.4378 });
  });

  it('resolves saved manual locations without requesting device location', async () => {
    const deps = dependencies();

    const location = await resolveActiveLocation(
      {
        locations: [
          currentLocationEntry(),
          {
            id: 'manual-home',
            type: 'manual',
            name: 'Home',
            latitude: 49.1951,
            longitude: 16.6068,
            placeName: 'Brno',
            createdAt: 0,
            updatedAt: 0,
          },
        ],
        activeLocationId: 'manual-home',
      },
      deps,
    );

    expect(location.activeLocationName).toBe('Home');
    expect(location.coordinates).toEqual({ latitude: 49.1951, longitude: 16.6068 });
    expect(deps.getCurrentCoordinates).not.toHaveBeenCalled();
  });

  it('keeps reverse geocoding best effort', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    const deps = dependencies({
      reverseGeocode: jest.fn(async () => {
        throw new Error('reverse geocode unavailable');
      }),
    });

    try {
      await expect(
        reverseGeocodePlaceName({ latitude: 50, longitude: 14 }, deps),
      ).resolves.toBeNull();
    } finally {
      warn.mockRestore();
    }
  });
});

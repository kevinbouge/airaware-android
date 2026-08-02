import { parseManualCoordinates, resolveLocation } from '../src/services/locationService';
import { DEFAULT_SETTINGS } from '../src/models/profile';

function dependencies(overrides = {}) {
  return {
    platform: 'android',
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

  it('reverse geocodes manual fallback coordinates when automatic permission is denied', async () => {
    const deps = dependencies({
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
    expect(location.placeName).toBe('Prague');
  });
});

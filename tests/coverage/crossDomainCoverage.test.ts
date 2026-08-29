import AsyncStorage from '@react-native-async-storage/async-storage';
import { refreshHealthSignalsForLocation } from '../../src/services/healthSignalService';
import { healthCacheKey, resolveHealthGeography } from '../../src/services/healthGeography';
import { loadHealthSignalsCacheForGeography } from '../../src/storage/storage';
import { radiologicalSpatialCacheKey } from '../../src/api/health/safecastRadiological';
import {
  biologicalSignalsForLocation,
  environmentFixtureForLocation,
  eurostatFixture,
  malariaSignalForLocation,
  radiologicalSignalForLocation,
  wastewaterSignalsForLocation,
  whoRespiratoryFixture,
  whoRowsForCountry,
} from './coverageFixtures';
import { GLOBAL_TEST_LOCATIONS, locationInfoFromGlobalLocation } from './globalLocations';

function jsonResponse(payload: unknown, ok = true, status = ok ? 200 : 500): Response {
  return {
    ok,
    status,
    json: async () => payload,
  } as Response;
}

describe('global cross-domain coverage behavior', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    jest.restoreAllMocks();
  });

  it('keeps environmental state usable when population and radiological providers fail', async () => {
    const location = GLOBAL_TEST_LOCATIONS.find((entry) => entry.id === 'prague');
    expect(location).toBeDefined();
    const environment = environmentFixtureForLocation(location!);
    const geography = resolveHealthGeography({ location: locationInfoFromGlobalLocation(location!) });

    jest.spyOn(global, 'fetch').mockImplementation(async (url) => {
      const requestUrl = String(url);
      if (requestUrl.includes('xmart-api-public.who.int')) {
        return jsonResponse(
          whoRespiratoryFixture(whoRowsForCountry(geography?.providerCodes?.who ?? 'CZE')),
        );
      }
      if (requestUrl.includes('ghoapi.azureedge.net')) return jsonResponse({}, false, 503);
      if (requestUrl.includes('eurostat')) return jsonResponse({}, false, 503);
      if (requestUrl.includes('simplemap.safecast.org')) return jsonResponse({}, false, 503);
      return jsonResponse({}, false, 500);
    });

    const health = await refreshHealthSignalsForLocation({
      location: locationInfoFromGlobalLocation(location!),
      environment,
      force: true,
      now: '2026-08-28T12:00:00Z',
    });

    expect(environment.current.weather.temperature).toBe(21);
    expect(health.signals.some((signal) => signal.type === 'influenza')).toBe(true);
    expect(health.signals.some((signal) => signal.type === 'excess-mortality')).toBe(false);
    expect(health.signals.some((signal) => signal.type === 'ambient-dose-rate')).toBe(false);
    expect(health.error).toBeTruthy();
  });

  it('keeps successful population data when biological provider fails and radiation has no local data', async () => {
    const location = GLOBAL_TEST_LOCATIONS.find((entry) => entry.id === 'paris');
    expect(location).toBeDefined();
    const environment = environmentFixtureForLocation(location!);

    jest.spyOn(global, 'fetch').mockImplementation(async (url) => {
      const requestUrl = String(url);
      if (requestUrl.includes('xmart-api-public.who.int')) return jsonResponse({}, false, 503);
      if (requestUrl.includes('ghoapi.azureedge.net')) return jsonResponse({}, false, 503);
      if (requestUrl.includes('eurostat')) {
        return jsonResponse(eurostatFixture({ '2026-02': 0.2, '2026-03': 1.1 }));
      }
      if (requestUrl.includes('simplemap.safecast.org')) {
        return jsonResponse({ measurements: [] });
      }
      return jsonResponse({}, false, 500);
    });

    const health = await refreshHealthSignalsForLocation({
      location: locationInfoFromGlobalLocation(location!),
      environment,
      force: true,
      now: '2026-08-28T12:00:00Z',
    });

    expect(health.signals).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: 'excess-mortality',
          source: {
            provider: 'Eurostat',
            dataset: 'demo_mexrt',
            measure: expect.any(String),
          },
        }),
        expect.objectContaining({
          type: 'ambient-dose-rate',
          category: 'unknown',
          metadata: expect.objectContaining({ unavailable: true }),
        }),
      ]),
    );
    expect(health.signals.some((signal) => signal.type === 'influenza')).toBe(false);
    expect(health.error).toBeTruthy();
  });

  it('uses country health caches for same-country locations and spatial caches for radiation', async () => {
    const prague = GLOBAL_TEST_LOCATIONS.find((entry) => entry.id === 'prague');
    expect(prague).toBeDefined();
    const brno = {
      ...prague!,
      id: 'brno',
      name: 'Brno',
      latitude: 49.1951,
      longitude: 16.6068,
    };
    const pragueGeography = resolveHealthGeography({ location: locationInfoFromGlobalLocation(prague!) });
    const brnoGeography = resolveHealthGeography({ location: locationInfoFromGlobalLocation(brno) });

    expect(pragueGeography && brnoGeography && healthCacheKey(pragueGeography)).toBe(
      brnoGeography && healthCacheKey(brnoGeography),
    );
    expect(
      radiologicalSpatialCacheKey({ latitude: prague!.latitude, longitude: prague!.longitude }),
    ).not.toBe(radiologicalSpatialCacheKey({ latitude: brno.latitude, longitude: brno.longitude }));

    expect(await loadHealthSignalsCacheForGeography('country:CZ')).toBeNull();
  });

  it('constructs a valid cross-domain Today state for representative locations', () => {
    ['prague', 'tokyo', 'austin', 'nairobi'].forEach((locationId) => {
      const location = GLOBAL_TEST_LOCATIONS.find((entry) => entry.id === locationId);
      expect(location).toBeDefined();
      const environment = environmentFixtureForLocation(location!);
      const biological = biologicalSignalsForLocation(location!, {
        noObservation: locationId === 'nairobi',
      });
      const wastewater = wastewaterSignalsForLocation(location!);
      const malaria = malariaSignalForLocation(location!, {
        zeroContext: locationId !== 'nairobi',
        noObservation: locationId === 'tokyo',
      });
      const radiation = radiologicalSignalForLocation(location!, []);
      const state = {
        location: locationInfoFromGlobalLocation(location!),
        environment,
        healthSignals: [...biological, ...wastewater, ...(malaria ? [malaria] : []), radiation],
      };

      expect(state.environment.current.timestamp).toBeTruthy();
      expect(state.environment.current.extended?.weather.apparentTemperature).toEqual(
        expect.any(Number),
      );
      expect(state.healthSignals.find((signal) => signal.type === 'ambient-dose-rate')).toMatchObject({
        category: 'unknown',
        metadata: expect.objectContaining({ unavailable: true }),
      });
      if (locationId === 'austin') {
        expect(state.healthSignals.some((signal) => signal.type === 'wastewater-covid-19')).toBe(
          true,
        );
      }
      if (locationId === 'nairobi') {
        expect(state.healthSignals.find((signal) => signal.type === 'malaria')).toMatchObject({
          metadata: expect.objectContaining({ notCurrentActivity: true }),
        });
      }
      state.healthSignals
        .filter(
          (signal) =>
            signal.domain === 'biological' &&
            !['wastewater-covid-19', 'wastewater-influenza', 'wastewater-rsv'].includes(
              signal.type,
            ),
        )
        .forEach((signal) => {
          expect(signal.geography.level).toBe('country');
          expect(signal.geography.name).not.toBe(location!.name);
        });
      expect(radiation.geography.level).toBe('local');
    });
  });
});

import { normalizeDoseRate } from '../../src/core/radiologicalSignals';
import { radiologicalSpatialCacheKey } from '../../src/api/health/safecastRadiological';
import { healthSignalCoverageResult, expectUnavailableIsNotLowOrNormal } from './coverageAssertions';
import {
  COVERAGE_NOW,
  radiologicalSignalForLocation,
  safecastMeasurement,
} from './coverageFixtures';
import { GLOBAL_TEST_LOCATIONS } from './globalLocations';

function baselineRows() {
  return Array.from({ length: 8 }, (_, index) =>
    safecastMeasurement({
      id: `history-${index}`,
      value: 0.1 + index * 0.001,
      capturedAt: `2026-08-${(10 + index).toString().padStart(2, '0')}T12:00:00Z`,
      distanceM: 1200,
    }),
  );
}

describe('global radiological coverage contracts', () => {
  it.each(GLOBAL_TEST_LOCATIONS)('$id returns an explicit radiological state', (location) => {
    const signal = radiologicalSignalForLocation(location, []);

    expect(signal.domain).toBe('radiological');
    expect(signal.type).toBe('ambient-dose-rate');
    expect(signal.metadata?.unavailable).toBe(true);
    expectUnavailableIsNotLowOrNormal(signal);
    expect(healthSignalCoverageResult({
      location,
      signal,
      domain: 'radiological',
      signalName: 'ambient-dose-rate',
    })).toMatchObject({ status: 'no-data', provider: 'Safecast' });
  });

  it('uses calibrated dose-rate units and never converts count-only data into µSv/h', () => {
    expect(normalizeDoseRate(120, 'nSv/h')).toMatchObject({ value: 0.12, unit: 'µSv/h' });
    expect(normalizeDoseRate(0.0002, 'mSv/h')).toMatchObject({ value: 0.2, unit: 'µSv/h' });
    expect(normalizeDoseRate(42, 'CPM')).toBeNull();
    expect(normalizeDoseRate(2, 'CPS')).toBeNull();

    const location = GLOBAL_TEST_LOCATIONS.find((entry) => entry.id === 'prague');
    expect(location).toBeDefined();
    const signal = radiologicalSignalForLocation(location!, [
      safecastMeasurement({
        id: 'count-only',
        value: 42,
        unit: 'CPM',
        capturedAt: COVERAGE_NOW,
      }),
    ]);

    expect(signal.metadata?.unavailable).toBe(true);
    expect(signal.value).toBeUndefined();
  });

  it('rejects measurements beyond the maximum meaningful local sensor distance', () => {
    const location = GLOBAL_TEST_LOCATIONS.find((entry) => entry.id === 'perth');
    expect(location).toBeDefined();
    const signal = radiologicalSignalForLocation(location!, [
      safecastMeasurement({
        id: 'too-far',
        value: 0.11,
        capturedAt: COVERAGE_NOW,
        distanceM: 251_000,
      }),
    ]);

    expect(signal.metadata?.unavailable).toBe(true);
    expect(signal.category).toBe('unknown');
  });

  it('preserves distance, source, and local baseline for suitable measurements', () => {
    const location = GLOBAL_TEST_LOCATIONS.find((entry) => entry.id === 'prague');
    expect(location).toBeDefined();
    const signal = radiologicalSignalForLocation(location!, [
      ...baselineRows(),
      safecastMeasurement({
        id: 'current',
        value: 0.11,
        capturedAt: COVERAGE_NOW,
        distanceM: 900,
      }),
    ]);

    expect(signal).toMatchObject({
      domain: 'radiological',
      type: 'ambient-dose-rate',
      source: { provider: 'Safecast' },
      value: 0.11,
      unit: 'µSv/h',
      category: 'normal-background',
      freshness: { status: 'fresh' },
    });
    expect(signal.metadata?.nearestSensorDistanceKm).toBeCloseTo(0.9);
    expect(signal.metadata?.baseline).toMatchObject({ sampleCount: 8, periodDays: 30 });
  });

  it('uses spatial radiological cache keys rather than saved location names', () => {
    const prague = GLOBAL_TEST_LOCATIONS.find((entry) => entry.id === 'prague');
    expect(prague).toBeDefined();
    const coordinates = { latitude: prague!.latitude, longitude: prague!.longitude };

    expect(radiologicalSpatialCacheKey(coordinates)).toBe('radiological:safecast:50.1:14.4');
  });
});

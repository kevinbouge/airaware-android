import { eurostatExcessMortalityUrl } from '../../src/api/health/eurostatExcessMortality';
import { resolveHealthGeography } from '../../src/services/healthGeography';
import { healthSignalCoverageResult } from './coverageAssertions';
import {
  globalPopulationSignalForLocation,
  populationSignalForLocation,
} from './coverageFixtures';
import { GLOBAL_TEST_LOCATIONS, locationInfoFromGlobalLocation } from './globalLocations';

describe('global population-health coverage contracts', () => {
  it('preserves Eurostat reporting geography and monthly reporting period', () => {
    const location = GLOBAL_TEST_LOCATIONS.find((entry) => entry.id === 'prague');
    expect(location).toBeDefined();

    const signal = populationSignalForLocation(location!, { '2026-06': -5.9, '2026-07': 4.2 });

    expect(signal).toMatchObject({
      domain: 'population-health',
      type: 'excess-mortality',
      geography: expect.objectContaining({ level: 'country', countryCode: 'CZ' }),
      category: 'unknown',
      source: expect.objectContaining({ provider: 'Eurostat', dataset: 'demo_mexrt' }),
      reportingPeriod: { type: 'month', year: 2026, month: 7 },
      unit: '%',
    });
    expect(signal?.geography.name).not.toBe(location!.name);
    expect(healthSignalCoverageResult({
      location: location!,
      signal,
      domain: 'population-health',
      signalName: 'excess-mortality',
    })).toMatchObject({ status: 'available' });
  });

  it('does not convert missing mortality observations into normal mortality', () => {
    const location = GLOBAL_TEST_LOCATIONS.find((entry) => entry.id === 'prague');
    expect(location).toBeDefined();

    const signal = populationSignalForLocation(location!, { '2026-02': null, '2026-03': null });

    expect(signal).toBeNull();
    expect(healthSignalCoverageResult({
      location: location!,
      signal,
      domain: 'population-health',
      signalName: 'excess-mortality',
    })).toMatchObject({ status: 'unsupported' });
  });

  it('uses OWID as the global excess-mortality fallback outside Eurostat coverage', () => {
    const location = GLOBAL_TEST_LOCATIONS.find((entry) => entry.id === 'tokyo');
    expect(location).toBeDefined();
    const geography = resolveHealthGeography({ location: locationInfoFromGlobalLocation(location!) });
    const signal = globalPopulationSignalForLocation(location!);

    expect(geography?.countryCode).toBe('JP');
    expect(eurostatExcessMortalityUrl(geography!)).toBeNull();
    expect(signal).toMatchObject({
      domain: 'population-health',
      type: 'excess-mortality',
      geography: expect.objectContaining({ level: 'country', countryCode: 'JP' }),
      category: 'unknown',
      source: expect.objectContaining({
        provider: 'Our World in Data',
        dataset: 'excess-mortality-p-scores-average-baseline',
      }),
      reportingPeriod: { type: 'week', year: 2026, week: 31 },
      unit: '%',
      value: 3.6,
    });
    expect(healthSignalCoverageResult({
      location: location!,
      signal,
      domain: 'population-health',
      signalName: 'excess-mortality',
    })).toMatchObject({ status: 'available', provider: 'Our World in Data' });
  });

  it('keeps missing global mortality observations unavailable instead of normal', () => {
    const location = GLOBAL_TEST_LOCATIONS.find((entry) => entry.id === 'nairobi');
    expect(location).toBeDefined();

    const signal = globalPopulationSignalForLocation(location!, { noObservation: true });

    expect(signal).toMatchObject({
      type: 'excess-mortality',
      category: 'unknown',
      metadata: expect.objectContaining({ unavailable: true }),
    });
    expect(signal?.value).toBeUndefined();
    expect(healthSignalCoverageResult({
      location: location!,
      signal,
      domain: 'population-health',
      signalName: 'excess-mortality',
    })).toMatchObject({ status: 'no-data' });
  });

  it('marks delayed mortality data with the population-health freshness policy', () => {
    const location = GLOBAL_TEST_LOCATIONS.find((entry) => entry.id === 'paris');
    expect(location).toBeDefined();

    const signal = populationSignalForLocation(
      location!,
      { '2025-01': 1.1, '2025-02': 2.3 },
      { updated: '2025-03-01T00:00:00Z' },
    );

    expect(signal?.freshness.status).toBe('stale');
    expect(signal?.category).toBe('unknown');
  });

  it('uses the mortality reporting period rather than dataset update time for freshness', () => {
    const location = GLOBAL_TEST_LOCATIONS.find((entry) => entry.id === 'prague');
    expect(location).toBeDefined();

    const signal = populationSignalForLocation(
      location!,
      { '2026-02': 1.1, '2026-03': 4.2 },
      { updated: '2026-08-20T00:00:00Z' },
    );

    expect(signal?.updatedAt).toBe('2026-08-20T00:00:00Z');
    expect(signal?.periodEnd).toBe('2026-03-31');
    expect(signal?.freshness.status).toBe('stale');
    expect(healthSignalCoverageResult({
      location: location!,
      signal,
      domain: 'population-health',
      signalName: 'excess-mortality',
    })).toMatchObject({ status: 'stale' });
  });
});

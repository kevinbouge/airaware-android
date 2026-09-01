import { biologicalProviderCacheKey, whoRespiratoryUrl } from '../../src/api/health/whoRespiratory';
import { cdcWastewaterUrl } from '../../src/api/health/cdcWastewater';
import { whoMalariaUrl } from '../../src/api/health/whoVectorDisease';
import { resolveHealthGeography, healthCacheKey } from '../../src/services/healthGeography';
import {
  healthSignalCoverageResult,
  expectUnavailableIsNotLowOrNormal,
} from './coverageAssertions';
import {
  biologicalSignalsForLocation,
  chikungunyaSignalForLocation,
  dengueSignalForLocation,
  malariaSignalForLocation,
  wastewaterSignalsForLocation,
} from './coverageFixtures';
import { GLOBAL_TEST_LOCATIONS, locationInfoFromGlobalLocation } from './globalLocations';

const REPRESENTATIVE_COUNTRIES = [
  'prague',
  'austin',
  'tokyo',
  'sao-paulo',
  'nairobi',
  'sydney',
];

describe('global biological coverage contracts', () => {
  it.each(GLOBAL_TEST_LOCATIONS)('$id resolves biological surveillance by country', (location) => {
    const geography = resolveHealthGeography({ location: locationInfoFromGlobalLocation(location) });

    expect(geography).toMatchObject({
      level: 'country',
      code: location.country,
      countryCode: location.country,
    });
    if (location.id !== 'singapore') {
      expect(geography?.name).not.toBe(location.name);
    }
    expect(whoRespiratoryUrl(geography!)).toContain(
      `COUNTRY_CODE+eq+%27${geography?.providerCodes?.who}%27`,
    );
  });

  it.each(REPRESENTATIVE_COUNTRIES)(
    '%s produces valid WHO biological outcomes without GPS-local semantics',
    (locationId) => {
      const location = GLOBAL_TEST_LOCATIONS.find((entry) => entry.id === locationId);
      expect(location).toBeDefined();

      const signals = biologicalSignalsForLocation(location!);
      const signalTypes = signals.map((signal) => signal.type);

      expect(signalTypes).toEqual(['influenza', 'covid-19', 'rsv']);
      signals.forEach((signal) => {
        expect(signal.domain).toBe('biological');
        expect(signal.geography.level).toBe('country');
        expect(signal.geography.countryCode).toBe(location!.country);
        expect(signal.geography.name).not.toBe(location!.name);
        expect(signal.source.provider).toBe('WHO GISRS / FluNet');
        if (signal.metadata?.unavailable === true) {
          expectUnavailableIsNotLowOrNormal(signal);
        }
      });
    },
  );

  it('keeps no-observation biological data explicit instead of converting it to Low activity', () => {
    const location = GLOBAL_TEST_LOCATIONS.find((entry) => entry.id === 'tokyo');
    expect(location).toBeDefined();

    const signals = biologicalSignalsForLocation(location!, { noObservation: true });

    expect(signals).toHaveLength(3);
    signals.forEach((signal) => {
      expect(signal.metadata?.unavailable).toBe(true);
      expectUnavailableIsNotLowOrNormal(signal);
      expect(healthSignalCoverageResult({
        location: location!,
        signal,
        domain: 'biological',
        signalName: signal.type,
      })).toMatchObject({ status: 'no-data' });
    });
  });

  it('uses biological freshness semantics instead of environmental hourly freshness', () => {
    const location = GLOBAL_TEST_LOCATIONS.find((entry) => entry.id === 'prague');
    expect(location).toBeDefined();

    const staleSignals = biologicalSignalsForLocation(location!, { stale: true });

    expect(staleSignals.find((signal) => signal.type === 'influenza')?.freshness.status).toBe(
      'stale',
    );
    expect(staleSignals.find((signal) => signal.type === 'rsv')?.freshness.status).toBe('stale');
  });

  it('reuses same-country WHO cache keys while keeping different countries distinct', () => {
    const prague = GLOBAL_TEST_LOCATIONS.find((entry) => entry.id === 'prague');
    const brno = {
      ...prague!,
      id: 'brno',
      name: 'Brno',
      latitude: 49.1951,
      longitude: 16.6068,
    };
    const pragueGeography = resolveHealthGeography({
      location: locationInfoFromGlobalLocation(prague!),
    });
    const brnoGeography = resolveHealthGeography({ location: locationInfoFromGlobalLocation(brno) });
    const berlinGeography = resolveHealthGeography({
      location: locationInfoFromGlobalLocation({
        id: 'berlin',
        name: 'Berlin',
        country: 'DE',
        continent: 'europe',
        latitude: 52.52,
        longitude: 13.405,
        coverageTags: ['europe'],
      }),
    });

    expect(pragueGeography && brnoGeography && healthCacheKey(pragueGeography)).toBe(
      brnoGeography && healthCacheKey(brnoGeography),
    );
    expect(berlinGeography && healthCacheKey(berlinGeography)).toBe('country:DE');
    expect(
      biologicalProviderCacheKey({
        provider: 'who',
        pathogen: 'influenza',
        geography: pragueGeography!,
        measure: 'positivity',
      }),
    ).toBe('who:influenza:CZ:positivity');
  });

  it('keeps CDC and ECDC enrichment optional rather than mandatory for WHO baseline coverage', () => {
    const usLocation = GLOBAL_TEST_LOCATIONS.find((entry) => entry.id === 'austin');
    const euLocation = GLOBAL_TEST_LOCATIONS.find((entry) => entry.id === 'prague');
    expect(usLocation).toBeDefined();
    expect(euLocation).toBeDefined();

    const usSignals = biologicalSignalsForLocation(usLocation!);
    const euSignals = biologicalSignalsForLocation(euLocation!);

    expect(usSignals.some((signal) => signal.source.provider === 'WHO GISRS / FluNet')).toBe(true);
    expect(euSignals.some((signal) => signal.source.provider === 'WHO GISRS / FluNet')).toBe(true);
    expect(usSignals.every((signal) => signal.source.provider !== 'CDC')).toBe(true);
    expect(euSignals.every((signal) => signal.source.provider !== 'ECDC')).toBe(true);
  });

  it('keeps CDC wastewater raw samples unavailable without clinical prevalence claims', () => {
    const location = GLOBAL_TEST_LOCATIONS.find((entry) => entry.id === 'austin');
    expect(location).toBeDefined();
    const signals = wastewaterSignalsForLocation(location!);
    const covid = signals.find((signal) => signal.type === 'wastewater-covid-19');

    expect(cdcWastewaterUrl({
      signalType: 'wastewater-covid-19',
      datasetId: 'j9g8-acpt',
      target: 'sars-cov-2',
      label: 'SARS-CoV-2 wastewater concentration',
    })).not.toContain('app_token');
    expect(signals.map((signal) => signal.type)).toEqual([
      'wastewater-covid-19',
      'wastewater-influenza',
      'wastewater-rsv',
    ]);
    expect(covid).toMatchObject({
      domain: 'biological',
      geography: { level: 'country', code: 'US', countryCode: 'US' },
      category: 'unknown',
      metadata: expect.objectContaining({
        unavailable: true,
        reason: 'cdc-wastewater-aggregation-unavailable',
        noClinicalPrevalenceInference: true,
        surveillanceBasis: 'wastewater surveillance',
      }),
    });
    expect(covid?.value).toBeUndefined();
  });

  it('uses RIVM wastewater as optional Netherlands evidence without clinical prevalence claims', () => {
    const location = GLOBAL_TEST_LOCATIONS.find((entry) => entry.id === 'amsterdam');
    expect(location).toBeDefined();
    const signals = wastewaterSignalsForLocation(location!);

    expect(signals).toHaveLength(1);
    expect(signals[0]).toMatchObject({
      domain: 'biological',
      type: 'wastewater-covid-19',
      geography: { level: 'country', code: 'NL', countryCode: 'NL' },
      category: 'unknown',
      source: {
        provider: 'RIVM',
        dataset: 'COVID-19_rioolwaterdata_landelijk',
      },
      metadata: expect.objectContaining({ noClinicalPrevalenceInference: true }),
    });
  });

  it('uses PHAC wastewater as optional Canada evidence only when a reporting area matches', () => {
    const vancouver = GLOBAL_TEST_LOCATIONS.find((entry) => entry.id === 'vancouver');
    expect(vancouver).toBeDefined();
    const location = { ...vancouver!, id: 'metro-vancouver', name: 'Metro Vancouver' };
    const signals = wastewaterSignalsForLocation(location);

    expect(signals.map((signal) => signal.type)).toEqual([
      'wastewater-covid-19',
      'wastewater-influenza',
      'wastewater-rsv',
    ]);
    expect(signals[0]).toMatchObject({
      domain: 'biological',
      geography: { level: 'subregion', name: 'Metro Vancouver', countryCode: 'CA' },
      source: { provider: 'PHAC' },
      metadata: expect.objectContaining({
        noClinicalPrevalenceInference: true,
        reportingGeography: 'Metro Vancouver',
      }),
    });
  });

  it('uses SUM’Eau as optional France national wastewater evidence without city-local semantics', () => {
    const location = GLOBAL_TEST_LOCATIONS.find((entry) => entry.id === 'paris');
    expect(location).toBeDefined();
    const signals = wastewaterSignalsForLocation(location!);

    expect(signals).toHaveLength(1);
    expect(signals[0]).toMatchObject({
      domain: 'biological',
      type: 'wastewater-covid-19',
      geography: { level: 'country', code: 'FR', countryCode: 'FR' },
      source: { provider: 'Santé publique France', dataset: 'SUM’Eau' },
      metadata: expect.objectContaining({
        noClinicalPrevalenceInference: true,
        reportingGeography: 'France',
      }),
    });
    expect(signals[0]?.geography.name).not.toBe(location!.name);
  });

  it('keeps missing wastewater surveillance unavailable instead of Low pathogen activity', () => {
    const location = GLOBAL_TEST_LOCATIONS.find((entry) => entry.id === 'new-york');
    expect(location).toBeDefined();
    const signals = wastewaterSignalsForLocation(location!, { noObservation: true });

    signals.forEach((signal) => {
      expect(signal.metadata?.unavailable).toBe(true);
      expectUnavailableIsNotLowOrNormal(signal);
      expect(healthSignalCoverageResult({
        location: location!,
        signal,
        domain: 'biological',
        signalName: signal.type,
      })).toMatchObject({ status: 'no-data' });
    });
  });

  it('treats WHO malaria as annual endemicity context, not live activity', () => {
    const location = GLOBAL_TEST_LOCATIONS.find((entry) => entry.id === 'nairobi');
    expect(location).toBeDefined();
    const geography = resolveHealthGeography({ location: locationInfoFromGlobalLocation(location!) });
    const signal = malariaSignalForLocation(location!);

    expect(whoMalariaUrl(geography!)).toContain('MALARIA_EST_INCIDENCE');
    expect(signal).toMatchObject({
      domain: 'biological',
      type: 'malaria',
      reportingPeriod: { type: 'year', year: 2024 },
      category: 'unknown',
      metadata: expect.objectContaining({
        surveillanceBasis: 'annual incidence context',
        notCurrentActivity: true,
        noPersonalRiskInference: true,
      }),
    });
  });

  it('keeps vector no-data and unsupported semantics distinct from Low disease activity', () => {
    const location = GLOBAL_TEST_LOCATIONS.find((entry) => entry.id === 'prague');
    expect(location).toBeDefined();
    const noDataSignal = malariaSignalForLocation(location!, { noObservation: true });
    const omittedZeroContext = malariaSignalForLocation(location!, { zeroContext: true });

    expect(noDataSignal).toMatchObject({
      type: 'malaria',
      category: 'unknown',
      metadata: expect.objectContaining({ unavailable: true }),
    });
    expectUnavailableIsNotLowOrNormal(noDataSignal!);
    expect(omittedZeroContext).toBeNull();
    expect(healthSignalCoverageResult({
      location: location!,
      signal: undefined,
      domain: 'biological',
      signalName: 'dengue',
    })).toMatchObject({ status: 'unsupported' });
    expect(healthSignalCoverageResult({
      location: location!,
      signal: undefined,
      domain: 'biological',
      signalName: 'chikungunya',
    })).toMatchObject({ status: 'unsupported' });
  });

  it('uses ECDC dengue clusters only for matching EU/EEA locations', () => {
    const marseille = {
      id: 'marseille',
      name: 'Marseille',
      country: 'FR',
      continent: 'europe',
      latitude: 43.2965,
      longitude: 5.3698,
      coverageTags: ['europe', 'dengue-cluster'],
    } as const;
    const paris = GLOBAL_TEST_LOCATIONS.find((entry) => entry.id === 'paris');
    expect(paris).toBeDefined();

    const marseilleSignal = dengueSignalForLocation(marseille);
    const parisSignal = dengueSignalForLocation(paris!);

    expect(marseilleSignal).toMatchObject({
      domain: 'biological',
      type: 'dengue',
      geography: { level: 'subregion', name: 'Marseille', countryCode: 'FR' },
      category: 'unknown',
      metadata: expect.objectContaining({
        providerCategory: 'Active',
        noPersonalRiskInference: true,
      }),
    });
    expect(parisSignal).toMatchObject({
      type: 'dengue',
      category: 'unknown',
      metadata: expect.objectContaining({ unavailable: true }),
    });
    expectUnavailableIsNotLowOrNormal(parisSignal!);
  });

  it('uses ECDC chikungunya clusters only for matching EU/EEA locations', () => {
    const prignac = {
      id: 'prignac',
      name: 'Prignac-et-Marcamps',
      country: 'FR',
      continent: 'europe',
      latitude: 45.033,
      longitude: -0.492,
      coverageTags: ['europe', 'chikungunya-cluster'],
    } as const;
    const paris = GLOBAL_TEST_LOCATIONS.find((entry) => entry.id === 'paris');
    expect(paris).toBeDefined();

    const prignacSignal = chikungunyaSignalForLocation(prignac);
    const parisSignal = chikungunyaSignalForLocation(paris!);

    expect(prignacSignal).toMatchObject({
      domain: 'biological',
      type: 'chikungunya',
      geography: { level: 'subregion', name: 'Prignac-et-Marcamps', countryCode: 'FR' },
      category: 'unknown',
      metadata: expect.objectContaining({
        providerCategory: 'Active',
        noPersonalRiskInference: true,
      }),
    });
    expect(parisSignal).toMatchObject({
      type: 'chikungunya',
      category: 'unknown',
      metadata: expect.objectContaining({ unavailable: true }),
    });
    expectUnavailableIsNotLowOrNormal(parisSignal!);
  });

  it('does not invent a default country when country and coordinates are unresolved', () => {
    const geography = resolveHealthGeography({
      location: {
        ...locationInfoFromGlobalLocation(GLOBAL_TEST_LOCATIONS[0]!),
        coordinates: null,
        countryCode: null,
        countryName: null,
      },
    });

    expect(geography).toBeNull();
  });
});

import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  eurostatExcessMortalityUrl,
  normalizeEurostatExcessMortality,
} from '../src/api/health/eurostatExcessMortality';
import {
  biologicalProviderCacheKey,
  normalizeWhoRespiratorySignals,
  whoRespiratoryProvider,
  whoRespiratoryUrl,
} from '../src/api/health/whoRespiratory';
import {
  healthSignalPeriodLabel,
  healthSignalTrendLabel,
  healthSignalTypeLabel,
  healthSignalValueLabel,
} from '../src/core/healthSignals';
import { setAppLanguagePreference } from '../src/i18n';
import type { LocationInfo } from '../src/models/environment';
import type {
  CachedHealthSignals,
  GeographyLevel,
  HealthGeography,
  HealthSignal,
  HealthSignalCategory,
  HealthSignalDomain,
  HealthSignalProviderResult,
} from '../src/models/healthSignals';
import { resolveHealthGeography, healthCacheKey } from '../src/services/healthGeography';
import {
  EXCESS_MORTALITY_FRESHNESS,
  RESPIRATORY_SURVEILLANCE_FRESHNESS,
  calculateComparableTrend,
  calculateHealthSignalFreshness,
} from '../src/services/healthSignalFreshness';
import { refreshHealthSignalsForLocation } from '../src/services/healthSignalService';
import { loadHealthSignalsCacheForGeography, saveHealthSignalsCache } from '../src/storage/storage';

const pragueLocation: LocationInfo = {
  activeLocationId: 'manual-prague',
  activeLocationName: 'Prague',
  coordinates: { latitude: 50.0755, longitude: 14.4378 },
  placeName: 'Prague',
  mode: 'manual',
  permissionStatus: 'unknown',
};

const brnoLocation: LocationInfo = {
  ...pragueLocation,
  activeLocationId: 'manual-brno',
  activeLocationName: 'Brno',
  coordinates: { latitude: 49.1951, longitude: 16.6068 },
  placeName: 'Brno',
};

const berlinLocation: LocationInfo = {
  ...pragueLocation,
  activeLocationId: 'manual-berlin',
  activeLocationName: 'Berlin',
  coordinates: { latitude: 52.52, longitude: 13.405 },
  placeName: 'Berlin',
};

const czechia: HealthGeography = {
  level: 'country',
  code: 'CZ',
  name: 'Czechia',
  countryCode: 'CZ',
  countryName: 'Czechia',
  providerCodes: { eurostat: 'CZ', who: 'CZE', whoEurope: 'CZE' },
};

function locationAt(name: string, latitude: number, longitude: number): LocationInfo {
  return {
    ...pragueLocation,
    activeLocationId: `manual-${name.toLowerCase().replaceAll(' ', '-')}`,
    activeLocationName: name,
    coordinates: { latitude, longitude },
    placeName: name,
  };
}

function whoFluNetFixture(
  rows: Record<string, unknown>[] = [
    {
      COUNTRY_CODE: 'CZE',
      COUNTRY_AREA_TERRITORY: 'Czechia',
      ISO_WEEKSTARTDATE: '2026-08-03',
      ISO_YEAR: 2026,
      ISO_WEEK: 32,
      SPEC_PROCESSED_NB: 100,
      INF_ALL: 10,
      RSV_PROCESSED: 80,
      RSV: 8,
    },
    {
      COUNTRY_CODE: 'CZE',
      COUNTRY_AREA_TERRITORY: 'Czechia',
      ISO_WEEKSTARTDATE: '2026-08-10',
      ISO_YEAR: 2026,
      ISO_WEEK: 33,
      SPEC_PROCESSED_NB: 100,
      INF_ALL: 14,
      RSV_PROCESSED: 80,
      RSV: 2,
    },
  ],
) {
  return {
    '@odata.context': 'https://xmart-api-public.who.int/FLUMART/$metadata#VIW_FNT',
    value: rows,
  };
}

function eurostatFixture(
  values: Record<string, number | null> = { '2026-02': -5.9, '2026-03': 4.2 },
) {
  const periods = Object.keys(values);
  return {
    label: 'Excess mortality by month',
    updated: '2026-06-17T11:00:00+0200',
    value: Object.fromEntries(
      periods.flatMap((period, index) =>
        typeof values[period] === 'number' ? [[String(index), values[period]]] : [],
      ),
    ),
    status: { [String(periods.length - 1)]: 'p' },
    id: ['freq', 'unit', 'geo', 'time'],
    size: [1, 1, 1, periods.length],
    dimension: {
      freq: { category: { index: { M: 0 }, label: { M: 'Monthly' } } },
      unit: { category: { index: { PC: 0 }, label: { PC: 'Percentage' } } },
      geo: { category: { index: { CZ: 0 }, label: { CZ: 'Czechia' } } },
      time: {
        category: {
          index: Object.fromEntries(periods.map((period, index) => [period, index])),
          label: Object.fromEntries(periods.map((period) => [period, period])),
        },
      },
    },
  };
}

describe('health signal domain and geography', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    jest.restoreAllMocks();
    setAppLanguagePreference('en');
  });

  it('represents environmental, biological, and population-health domains explicitly', () => {
    const domain: HealthSignalDomain = 'biological';
    const category: HealthSignalCategory = 'unknown';
    const geographyLevel: GeographyLevel = 'country';
    const providerResult: HealthSignalProviderResult = {
      providerId: 'test',
      fetchedAt: '2026-08-24T00:00:00Z',
      signals: [],
    };
    const signal: HealthSignal = {
      id: 'influenza:CZ:2026-W34',
      domain,
      type: 'influenza',
      geography: { ...czechia, level: geographyLevel },
      updatedAt: '2026-08-24T00:00:00Z',
      category,
      trend: 'unknown',
      source: { provider: 'WHO GISRS / FluNet' },
      freshness: { status: 'fresh' },
    };

    expect(signal.domain).toBe('biological');
    expect(signal.category).toBe('unknown');
    expect(healthSignalTrendLabel(signal.trend)).toBe('Trend unavailable');
    expect(providerResult.providerId).toBe('test');
  });

  it('resolves global locations to country-level surveillance geography', () => {
    const prague = resolveHealthGeography({ location: pragueLocation });
    const brno = resolveHealthGeography({ location: brnoLocation });
    const berlin = resolveHealthGeography({ location: berlinLocation });
    const austin = resolveHealthGeography({ location: locationAt('Austin', 30.2672, -97.7431) });
    const tokyo = resolveHealthGeography({ location: locationAt('Tokyo', 35.6762, 139.6503) });
    const saoPaulo = resolveHealthGeography({
      location: locationAt('São Paulo', -23.5505, -46.6333),
    });
    const nairobi = resolveHealthGeography({
      location: locationAt('Nairobi', -1.2921, 36.8219),
    });
    const sydney = resolveHealthGeography({
      location: locationAt('Sydney', -33.8688, 151.2093),
    });

    expect(prague).toMatchObject({ countryCode: 'CZ', name: 'Czechia' });
    expect(brno).toMatchObject({ countryCode: 'CZ', name: 'Czechia' });
    expect(berlin).toMatchObject({ countryCode: 'DE', name: 'Germany' });
    expect(austin).toMatchObject({ countryCode: 'US', name: 'United States' });
    expect(tokyo).toMatchObject({ countryCode: 'JP', name: 'Japan' });
    expect(saoPaulo).toMatchObject({ countryCode: 'BR', name: 'Brazil' });
    expect(nairobi).toMatchObject({ countryCode: 'KE', name: 'Kenya' });
    expect(sydney).toMatchObject({ countryCode: 'AU', name: 'Australia' });
    expect(prague && brno && healthCacheKey(prague)).toBe(brno && healthCacheKey(brno));
    expect(berlin && healthCacheKey(berlin)).toBe('country:DE');
  });

  it('uses ISO country metadata before legacy coordinate fallbacks', () => {
    const canada = resolveHealthGeography({
      location: {
        ...pragueLocation,
        activeLocationName: 'Montreal',
        coordinates: null,
        countryCode: 'CA',
        countryName: 'Canada',
      },
    });
    const franceFromIso3 = resolveHealthGeography({
      location: {
        ...pragueLocation,
        activeLocationName: 'Paris',
        coordinates: null,
        countryCode: 'FRA',
        countryName: 'France',
      },
    });

    expect(canada).toMatchObject({
      countryCode: 'CA',
      providerCodes: expect.objectContaining({ who: 'CAN' }),
    });
    expect(franceFromIso3).toMatchObject({
      countryCode: 'FR',
      providerCodes: expect.objectContaining({ who: 'FRA', eurostat: 'FR' }),
    });
  });

  it('does not invent a default country when geography cannot be resolved', () => {
    expect(
      resolveHealthGeography({
        location: { ...pragueLocation, coordinates: { latitude: 0, longitude: -30 } },
      }),
    ).toBeNull();
  });

  it('calculates freshness and comparable trends without fabricating categories', () => {
    expect(
      calculateHealthSignalFreshness({
        updatedAt: '2026-06-17T00:00:00Z',
        now: '2026-08-25T00:00:00Z',
        policy: EXCESS_MORTALITY_FRESHNESS,
      }).status,
    ).toBe('fresh');
    expect(RESPIRATORY_SURVEILLANCE_FRESHNESS.expectedUpdateIntervalMs).toBeGreaterThan(0);
    expect(
      calculateComparableTrend({ current: 4.2, previous: -5.9, minimumAbsoluteChange: 2 }),
    ).toBe('rising');
    expect(
      calculateComparableTrend({ current: 4.2, previous: 3.3, minimumAbsoluteChange: 2 }),
    ).toBe('stable');
    expect(
      calculateComparableTrend({ current: undefined, previous: 3.3, minimumAbsoluteChange: 2 }),
    ).toBe('unknown');
  });
});

describe('health providers and caches', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    jest.restoreAllMocks();
    setAppLanguagePreference('en');
  });

  it('normalizes Eurostat excess mortality without converting missing category to Low', () => {
    const signal = normalizeEurostatExcessMortality(eurostatFixture(), {
      geography: czechia,
      now: '2026-08-25T00:00:00Z',
    });

    expect(signal).toMatchObject({
      domain: 'population-health',
      type: 'excess-mortality',
      value: 4.2,
      unit: '%',
      category: 'unknown',
      trend: 'rising',
      source: { provider: 'Eurostat', dataset: 'demo_mexrt' },
    });
    expect(signal?.history).toHaveLength(2);
    expect(healthSignalValueLabel(signal as HealthSignal)).toBe('+4.2%');
    expect(healthSignalTypeLabel('excess-mortality')).toBe('Excess mortality');
  });

  it('ignores malformed and null Eurostat values without invalidating valid observations', () => {
    const signal = normalizeEurostatExcessMortality(
      {
        ...eurostatFixture({ '2026-01': null, '2026-02': 1.1, '2026-03': 3.4 }),
        value: { 1: 1.1, 2: 3.4, x: Number.NaN },
      },
      { geography: czechia, now: '2026-08-25T00:00:00Z' },
    );

    expect(signal?.value).toBeCloseTo(3.4);
    expect(signal?.reportingPeriod).toMatchObject({ type: 'month', year: 2026, month: 3 });
    expect(healthSignalPeriodLabel(signal as HealthSignal)).toBe('March 2026');
  });

  it('keeps Eurostat provider requests free of names, coordinates, profile, and RevenueCat data', () => {
    const url = eurostatExcessMortalityUrl({
      ...czechia,
      name: 'Prague Home',
      providerCodes: { eurostat: 'CZ', who: 'CZE', whoEurope: 'CZE' },
    });

    expect(url).toContain('demo_mexrt');
    expect(url).toContain('geo=CZ');
    expect(url).not.toContain('Prague');
    expect(url).not.toContain('50.0755');
    expect(url).not.toContain('profile');
    expect(url).not.toContain('RevenueCat');
  });

  it('builds country-scoped WHO requests without private local context', () => {
    const url = whoRespiratoryUrl({
      ...czechia,
      name: 'Prague Home',
    });

    expect(url).toContain('FLUMART/VIW_FNT');
    expect(url).toContain('COUNTRY_CODE+eq+%27CZE%27');
    expect(url).not.toContain('Prague');
    expect(url).not.toContain('50.0755');
    expect(url).not.toContain('allergy');
    expect(url).not.toContain('RevenueCat');
  });

  it('normalizes WHO influenza and RSV positivity without fabricating Low activity', () => {
    const signals = normalizeWhoRespiratorySignals(whoFluNetFixture(), {
      geography: czechia,
      now: '2026-08-25T00:00:00Z',
    });

    expect(signals[0]).toMatchObject({
      domain: 'biological',
      type: 'influenza',
      value: 14,
      unit: '% positivity',
      category: 'unknown',
      trend: 'rising',
      source: { provider: 'WHO GISRS / FluNet', dataset: 'FLUMART/VIW_FNT' },
    });
    expect(signals[1]).toMatchObject({
      type: 'covid-19',
      category: 'unknown',
      trend: 'unknown',
    });
    expect(healthSignalValueLabel(signals[1] as HealthSignal)).toBe('No recent data');
    expect(signals[2]).toMatchObject({
      type: 'rsv',
      value: 2.5,
      category: 'unknown',
      trend: 'falling',
    });
    expect(signals.at(0)?.evidence?.[0]).toMatchObject({
      provider: 'who',
      pathogen: 'influenza',
      measure: 'Influenza virological test positivity',
    });
  });

  it('normalizes WHO COVID-19 when supported SARS-CoV-2 rows are present', () => {
    const signals = normalizeWhoRespiratorySignals(
      whoFluNetFixture([
        {
          COUNTRY_CODE: 'CZE',
          COUNTRY_AREA_TERRITORY: 'Czechia',
          ISO_WEEKSTARTDATE: '2026-08-03',
          ISO_YEAR: 2026,
          ISO_WEEK: 32,
          SARS_COV_2_PROCESSED: 100,
          SARS_COV_2: 8,
        },
        {
          COUNTRY_CODE: 'CZE',
          COUNTRY_AREA_TERRITORY: 'Czechia',
          ISO_WEEKSTARTDATE: '2026-08-10',
          ISO_YEAR: 2026,
          ISO_WEEK: 33,
          SARS_COV_2_PROCESSED: 100,
          SARS_COV_2: 8.8,
        },
      ]),
      { geography: czechia, now: '2026-08-25T00:00:00Z', signalTypes: ['covid-19'] },
    );

    expect(signals).toEqual([
      expect.objectContaining({
        type: 'covid-19',
        value: 8.8,
        category: 'unknown',
        trend: 'stable',
      }),
    ]);
    expect(healthSignalTypeLabel('covid-19')).toBe('COVID-19');
  });

  it('ignores missing, null, duplicate, and malformed WHO observations independently', () => {
    const signals = normalizeWhoRespiratorySignals(
      whoFluNetFixture([
        {
          COUNTRY_CODE: 'CZE',
          COUNTRY_AREA_TERRITORY: 'Czechia',
          ISO_WEEKSTARTDATE: '2026-08-10',
          ISO_YEAR: 2026,
          ISO_WEEK: 33,
          SPEC_PROCESSED_NB: null,
          INF_ALL: 4,
        },
        {
          COUNTRY_CODE: 'CZE',
          COUNTRY_AREA_TERRITORY: 'Czechia',
          ISO_WEEKSTARTDATE: '2026-08-03',
          ISO_YEAR: 2026,
          ISO_WEEK: 32,
          SPEC_PROCESSED_NB: 100,
          INF_ALL: 4,
        },
        {
          COUNTRY_CODE: 'CZE',
          COUNTRY_AREA_TERRITORY: 'Czechia',
          ISO_WEEKSTARTDATE: '2026-08-03',
          ISO_YEAR: 2026,
          ISO_WEEK: 32,
          SPEC_PROCESSED_NB: 100,
          INF_ALL: 6,
        },
        {
          COUNTRY_CODE: 'CZE',
          COUNTRY_AREA_TERRITORY: 'Czechia',
          ISO_WEEKSTARTDATE: '2026-08-17',
          ISO_YEAR: 2026,
          ISO_WEEK: 54,
          SPEC_PROCESSED_NB: 100,
          INF_ALL: 90,
        },
      ]),
      { geography: czechia, now: '2026-08-25T00:00:00Z', signalTypes: ['influenza'] },
    );

    expect(signals).toEqual([
      expect.objectContaining({
        type: 'influenza',
        value: 5,
        reportingPeriod: expect.objectContaining({ type: 'week', year: 2026, week: 32 }),
      }),
    ]);
  });

  it('returns explicit WHO no-data signals instead of fake Low activity', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => whoFluNetFixture([]),
    } as Response);

    const result = await whoRespiratoryProvider.fetchSignals({
      geography: czechia,
      now: '2026-08-25T00:00:00Z',
    });

    expect(result.signals).toEqual([
      expect.objectContaining({
        type: 'influenza',
        metadata: expect.objectContaining({ unavailable: true }),
      }),
      expect.objectContaining({
        type: 'covid-19',
        metadata: expect.objectContaining({ unavailable: true }),
      }),
      expect.objectContaining({
        type: 'rsv',
        metadata: expect.objectContaining({ unavailable: true }),
      }),
    ]);
    expect(result.signals.every((signal) => signal.category === 'unknown')).toBe(true);
    expect(result.unavailableSignals).toEqual(['influenza', 'covid-19', 'rsv']);
  });

  it('keeps cached health signals language-neutral across locale changes', async () => {
    setAppLanguagePreference('en');
    const [signal] = normalizeWhoRespiratorySignals(whoFluNetFixture([]), {
      geography: czechia,
      now: '2026-08-25T00:00:00Z',
      signalTypes: ['influenza'],
    });
    expect(healthSignalValueLabel(signal as HealthSignal)).toBe('No recent data');

    await saveHealthSignalsCache({
      version: 1,
      savedAt: '2026-08-25T00:00:00Z',
      cacheKey: 'country:CZ',
      geography: czechia,
      signals: [signal as HealthSignal],
    });

    setAppLanguagePreference('fr');
    const cached = await loadHealthSignalsCacheForGeography('country:CZ');
    expect(JSON.stringify(cached)).not.toContain('No recent data');
    expect(healthSignalValueLabel(cached?.signals[0] as HealthSignal)).toBe(
      'Aucune donnée récente',
    );
    expect(healthSignalTypeLabel(cached?.signals[0]?.type ?? 'influenza')).toBe('Grippe');
  });

  it('uses provider, pathogen, geography, and measure in biological provider cache keys', () => {
    expect(
      biologicalProviderCacheKey({
        provider: 'who',
        pathogen: 'influenza',
        geography: czechia,
        measure: 'positivity',
      }),
    ).toBe('who:influenza:CZ:positivity');
  });

  it('persists and validates country-level health caches', async () => {
    const cache: CachedHealthSignals = {
      version: 1,
      savedAt: '2026-08-25T00:00:00Z',
      cacheKey: 'country:CZ',
      geography: czechia,
      signals: [
        normalizeEurostatExcessMortality(eurostatFixture(), {
          geography: czechia,
          now: '2026-08-25T00:00:00Z',
        }) as HealthSignal,
      ],
    };

    await saveHealthSignalsCache(cache);
    await expect(loadHealthSignalsCacheForGeography('country:CZ')).resolves.toMatchObject({
      cacheKey: 'country:CZ',
      signals: [expect.objectContaining({ type: 'excess-mortality' })],
    });

    await AsyncStorage.setItem('airaware.health-signals-cache.v1', '{"version":1,"entries":[{}]}');
    await expect(loadHealthSignalsCacheForGeography('country:CZ')).resolves.toBeNull();
  });

  it('shares a country-level health cache between Prague and Brno', async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => whoFluNetFixture(),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => eurostatFixture(),
      });
    jest.spyOn(global, 'fetch').mockImplementation(fetchMock);

    const prague = await refreshHealthSignalsForLocation({
      location: pragueLocation,
      environment: null,
      now: '2026-08-25T00:00:00Z',
    });
    const brno = await refreshHealthSignalsForLocation({
      location: brnoLocation,
      environment: null,
      now: '2026-08-25T01:00:00Z',
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(prague.geography?.countryCode).toBe('CZ');
    expect(brno.geography?.countryCode).toBe('CZ');
    expect(brno.signals.map((signal) => signal.id)).toEqual(
      prague.signals.map((signal) => signal.id),
    );
  });

  it('merges successful health providers with non-stale cache from failed providers', async () => {
    const cachedWhoSignal = normalizeWhoRespiratorySignals(whoFluNetFixture(), {
      geography: czechia,
      now: '2026-08-25T00:00:00Z',
      signalTypes: ['influenza'],
    })[0] as HealthSignal;
    const cachedEurostatSignal = normalizeEurostatExcessMortality(eurostatFixture(), {
      geography: czechia,
      now: '2026-08-25T00:00:00Z',
    }) as HealthSignal;
    await saveHealthSignalsCache({
      version: 1,
      savedAt: '2026-08-24T00:00:00Z',
      cacheKey: 'country:CZ',
      geography: czechia,
      signals: [cachedWhoSignal, cachedEurostatSignal],
    });

    jest.spyOn(global, 'fetch').mockImplementation((async (url: string) => {
      if (url.includes('FLUMART/VIW_FNT')) {
        return {
          ok: true,
          json: async () => whoFluNetFixture(),
        } as Response;
      }

      throw new Error('Eurostat unavailable');
    }) as typeof fetch);

    const state = await refreshHealthSignalsForLocation({
      location: pragueLocation,
      environment: null,
      force: true,
      now: '2026-08-25T01:00:00Z',
    });

    expect(state.error).toBe('Some health surveillance signals are temporarily unavailable.');
    expect(state.signals.map((signal) => signal.type)).toEqual([
      'influenza',
      'covid-19',
      'rsv',
      'excess-mortality',
    ]);
    expect(state.signals.find((signal) => signal.type === 'excess-mortality')?.value).toBeCloseTo(
      4.2,
    );
  });

  it('does not display stale cached health signals after provider failure', async () => {
    const staleSignal = normalizeWhoRespiratorySignals(whoFluNetFixture(), {
      geography: czechia,
      now: '2026-08-25T00:00:00Z',
      signalTypes: ['influenza'],
    })[0] as HealthSignal;
    await saveHealthSignalsCache({
      version: 1,
      savedAt: '2026-08-01T00:00:00Z',
      cacheKey: 'country:CZ',
      geography: czechia,
      signals: [
        {
          ...staleSignal,
          periodEnd: '2026-07-01',
          updatedAt: '2026-07-01T00:00:00Z',
          freshness: { status: 'stale' },
        },
      ],
    });
    jest.spyOn(global, 'fetch').mockRejectedValue(new Error('network unavailable'));

    const state = await refreshHealthSignalsForLocation({
      location: pragueLocation,
      environment: null,
      force: true,
      now: '2026-08-25T00:00:00Z',
    });

    expect(state.signals).toEqual([]);
    expect(state.error).toBe('Health surveillance is temporarily unavailable.');
  });

  it('fails health providers independently without throwing away existing environmental state', async () => {
    jest.spyOn(global, 'fetch').mockRejectedValue(new Error('network unavailable'));

    const state = await refreshHealthSignalsForLocation({
      location: pragueLocation,
      environment: null,
      now: '2026-08-25T00:00:00Z',
    });

    expect(state.signals).toEqual([]);
    expect(state.error).toBe('Health surveillance is temporarily unavailable.');
  });
});

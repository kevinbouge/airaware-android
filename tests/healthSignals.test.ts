import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  eurostatExcessMortalityUrl,
  normalizeEurostatExcessMortality,
} from '../src/api/health/eurostatExcessMortality';
import {
  cdcWastewaterProvider,
  cdcWastewaterUrl,
  normalizeCdcWastewaterSignal,
  type WastewaterDataset,
} from '../src/api/health/cdcWastewater';
import { ecdcDengueProvider, normalizeEcdcDengueSignal } from '../src/api/health/ecdcDengue';
import { fetchHealthJson } from '../src/api/health/providerFetch';
import {
  normalizePhacWastewaterSignals,
  phacWastewaterProvider,
} from '../src/api/health/phacWastewater';
import { normalizeRivmWastewaterSignal } from '../src/api/health/rivmWastewater';
import {
  normalizeSumeauWastewaterSignal,
  sumeauWastewaterProvider,
} from '../src/api/health/sumeauWastewater';
import {
  normalizeOwidExcessMortality,
  owidExcessMortalityUrl,
} from '../src/api/health/owidExcessMortality';
import {
  normalizeSafecastRadiationMeasurements,
  radiologicalSignalFromSafecast,
  radiologicalSpatialCacheKey,
  safecastRadiologicalProvider,
  safecastRadiationUrl,
  safecastSensorHistoryUrl,
} from '../src/api/health/safecastRadiological';
import {
  RESPIRATORY_SIGNAL_TYPES,
  biologicalProviderCacheKey,
  normalizeWhoRespiratorySignals,
  whoRespiratoryProvider,
  whoRespiratoryUrl,
} from '../src/api/health/whoRespiratory';
import { normalizeWhoMalariaContext, whoMalariaUrl } from '../src/api/health/whoVectorDisease';
import {
  healthSignalPeriodLabel,
  healthSignalTrendLabel,
  healthSignalTypeLabel,
  healthSignalValueLabel,
} from '../src/core/healthSignals';
import {
  calculateRadiationBaseline,
  calculateRadiationTrend,
  interpretRadiation,
  normalizeDoseRate,
  selectBestRadiologicalObservation,
} from '../src/core/radiologicalSignals';
import {
  apparentTemperatureThermalCategory,
  calculateUtci,
  thermalStressSignalFromEnvironment,
  utciThermalStressCategory,
} from '../src/core/thermalStress';
import { setAppLanguagePreference } from '../src/i18n';
import type { LocationInfo } from '../src/models/environment';
import type {
  CachedHealthSignals,
  HealthGeography,
  HealthSignal,
  HealthSignalCategory,
  HealthSignalDomain,
  HealthSignalProviderResult,
} from '../src/models/healthSignals';
import { resolveHealthGeography, healthCacheKey } from '../src/services/healthGeography';
import {
  EXCESS_MORTALITY_FRESHNESS,
  OWID_EXCESS_MORTALITY_FRESHNESS,
  RESPIRATORY_SURVEILLANCE_FRESHNESS,
  calculateComparableTrend,
  calculateHealthSignalFreshness,
} from '../src/services/healthSignalFreshness';
import { refreshHealthSignalsForLocation } from '../src/services/healthSignalService';
import { loadHealthSignalsCacheForGeography, saveHealthSignalsCache } from '../src/storage/storage';
import { environmentFixtureForLocation } from './coverage/coverageFixtures';

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

const wastewaterCovidDataset: WastewaterDataset = {
  signalType: 'wastewater-covid-19',
  datasetId: 'j9g8-acpt',
  target: 'sars-cov-2',
  label: 'SARS-CoV-2 wastewater concentration',
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

function cdcWastewaterFixture(rows: Record<string, unknown>[] = []) {
  return rows;
}

function phacWastewaterCsv(rows: string[]) {
  return [
    'Location,measureid,latestTrend,pruid,t_low,t_high,latestLevel,grouping,city,province,country,Viral_Activity_Level,weekStart',
    ...rows,
  ].join('\n');
}

function sumeauFixture(rows: Record<string, unknown>[]) {
  return {
    total_count: rows.length,
    results: rows,
  };
}

function ecdcDengueCsv(rows: string[]) {
  return [
    '"CountryName","ClusterId","Nuts3Name","LAUName","Status","DateOfOnsetFirst","DateOfOnsetLast","NCases"',
    ...rows,
  ].join('\n');
}

function ecdcDengueNoLocalClusterResponse(): Response {
  return {
    ok: true,
    text: async () =>
      ecdcDengueCsv([
        '"France","FR-2026-002","Bouches-du-Rhône","Marseille","Active","2026-08-02","2026-08-05","3"',
      ]),
  } as Response;
}

function whoMalariaFixture(rows: Record<string, unknown>[] = []) {
  return {
    '@odata.context': 'https://ghoapi.azureedge.net/api/$metadata#MALARIA_EST_INCIDENCE',
    value: rows,
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
  values: Record<string, number | null> = { '2026-06': -5.9, '2026-07': 4.2 },
) {
  const periods = Object.keys(values);
  return {
    label: 'Excess mortality by month',
    updated: '2026-08-17T11:00:00+0200',
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

function owidFixture(
  rows: [entity: string, code: string, week: string, value: string | number][] = [
    ['Czechia', 'CZE', '2026-W30', -5.9],
    ['Czechia', 'CZE', '2026-W31', 4.2],
    ['Japan', 'JPN', '2026-W30', 1.2],
    ['Japan', 'JPN', '2026-W31', 3.6],
  ],
) {
  return [
    'entity,code,week,p_avg_all_ages',
    ...rows.map(([entity, code, week, value]) => `${entity},${code},${week},${value}`),
  ].join('\n');
}

function safecastFixture(rows: Record<string, unknown>[]) {
  return {
    count: rows.length,
    measurements: rows,
    query: { lat: 50.0755, lon: 14.4378, radius_m: 25_000 },
    source: 'database',
  };
}

function safecastMeasurement(input: {
  id: string | number;
  value: number;
  unit?: string | undefined;
  capturedAt: string;
  distanceM?: number | undefined;
  includeDistance?: boolean | undefined;
  trackId?: string | undefined;
}) {
  return {
    id: input.id,
    value: input.value,
    unit: input.unit ?? 'µSv/h',
    captured_at: input.capturedAt,
    ...(input.includeDistance === false ? {} : { distance_m: input.distanceM ?? 800 }),
    location: {
      latitude: 50.08,
      longitude: 14.44,
    },
    track_id: input.trackId ?? 'track-1',
    detector: 'bGeigie-2022',
  };
}

describe('health signal domain and geography', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    jest.restoreAllMocks();
    setAppLanguagePreference('en');
  });

  it('represents environmental, biological, population-health, and radiological domains explicitly', () => {
    const domain: HealthSignalDomain = 'radiological';
    const category: HealthSignalCategory = 'normal-background';
    const providerResult: HealthSignalProviderResult = {
      providerId: 'test',
      fetchedAt: '2026-08-24T00:00:00Z',
      signals: [],
    };
    const signal: HealthSignal = {
      id: 'radiological:safecast:ambient-dose-rate',
      domain,
      type: 'ambient-dose-rate',
      geography: { level: 'local', code: 'radiological:safecast:50.1:14.4', name: 'Prague' },
      updatedAt: '2026-08-24T00:00:00Z',
      category,
      trend: 'unknown',
      source: { provider: 'WHO GISRS / FluNet' },
      freshness: { status: 'fresh' },
    };

    expect(signal.domain).toBe('radiological');
    expect(signal.category).toBe('normal-background');
    expect(healthSignalTrendLabel(signal.trend)).toBe('Trend unavailable');
    expect(providerResult.providerId).toBe('test');
  });

  it('derives thermal stress from Open-Meteo apparent temperature without fabricating UTCI', () => {
    const environment = environmentFixtureForLocation({
      id: 'dubai',
      name: 'Dubai',
      country: 'AE',
      continent: 'middle-east',
      latitude: 25.2048,
      longitude: 55.2708,
      coverageTags: ['desert'],
    });
    const signal = thermalStressSignalFromEnvironment({
      environment,
      now: '2026-08-28T12:00:00Z',
    });

    expect(apparentTemperatureThermalCategory(34)).toBe('high-heat-strain');
    expect(signal).toMatchObject({
      domain: 'environmental',
      type: 'thermal-stress',
      source: {
        provider: 'Open-Meteo',
        dataset: 'Weather Forecast API',
        measure: 'apparent_temperature',
      },
      metadata: expect.objectContaining({
        metric: 'apparent-temperature',
        utciAvailable: false,
        utciUnavailableReason: 'validated-mean-radiant-temperature-unavailable',
      }),
    });
    expect(
      signal?.history?.every((entry) => entry.source?.measure === 'apparent_temperature'),
    ).toBe(true);
  });

  it('calculates UTCI from validated inputs using published reference examples', () => {
    expect(
      calculateUtci({
        airTemperatureC: 25,
        relativeHumidityPercent: 50,
        windSpeed10mMs: 1,
        meanRadiantTemperatureC: 25,
      }),
    ).toBeCloseTo(24.6, 1);
    expect(
      calculateUtci({
        airTemperatureC: 40,
        relativeHumidityPercent: 50,
        windSpeed10mMs: 1,
        meanRadiantTemperatureC: 25,
      }),
    ).toBeCloseTo(40.6, 1);
    expect(utciThermalStressCategory(8.9)).toBe('slight-cold-stress');
    expect(utciThermalStressCategory(26)).toBe('moderate-heat-stress');
    expect(
      calculateUtci({
        airTemperatureC: 25,
        relativeHumidityPercent: 50,
        windSpeed10mMs: 1,
        meanRadiantTemperatureC: undefined,
      }),
    ).toBeNull();
  });

  it('uses UTCI thermal stress when mean radiant temperature is available', () => {
    const environment = environmentFixtureForLocation({
      id: 'paris',
      name: 'Paris',
      country: 'FR',
      continent: 'europe',
      latitude: 48.8566,
      longitude: 2.3522,
      coverageTags: ['europe'],
    });
    const withMrt = {
      ...environment,
      current: {
        ...environment.current,
        extended: {
          ...environment.current.extended!,
          weather: {
            ...environment.current.extended!.weather,
            meanRadiantTemperature: 30,
          },
        },
      },
      hourly: environment.hourly.map((hour) => ({
        ...hour,
        extended: {
          ...hour.extended!,
          weather: {
            ...hour.extended!.weather,
            meanRadiantTemperature: 30,
          },
        },
      })),
    };

    const signal = thermalStressSignalFromEnvironment({
      environment: withMrt,
      now: '2026-08-28T12:00:00Z',
    });

    expect(signal).toMatchObject({
      source: { measure: 'utci' },
      metadata: expect.objectContaining({
        metric: 'utci',
        calculationMethod: 'utci',
        utciAvailable: true,
      }),
    });
    expect(signal?.history?.every((entry) => entry.source?.measure === 'utci')).toBe(true);
  });

  it('omits thermal stress when apparent temperature is unavailable', () => {
    const environment = environmentFixtureForLocation({
      id: 'prague',
      name: 'Prague',
      country: 'CZ',
      continent: 'europe',
      latitude: 50.0755,
      longitude: 14.4378,
      coverageTags: ['europe'],
    });
    const missingApparentTemperature = {
      ...environment,
      current: {
        ...environment.current,
        extended: {
          ...environment.current.extended!,
          weather: {
            ...environment.current.extended!.weather,
            apparentTemperature: null,
          },
        },
      },
    };

    expect(
      thermalStressSignalFromEnvironment({
        environment: missingApparentTemperature,
        now: '2026-08-28T12:00:00Z',
      }),
    ).toBeNull();
  });

  it('keeps CDC raw wastewater samples unavailable until stable aggregation is integrated', () => {
    const signal = normalizeCdcWastewaterSignal({
      payload: cdcWastewaterFixture([
        {
          site: 'site-1',
          state_territory: 'TX',
          counties_served: 'Travis',
          sample_collect_date: '2026-08-11',
          pcr_target: 'sars-cov-2',
          pcr_target_avg_conc_lin: '100',
          pcr_target_units: 'copies/L',
          date_updated: '2026-08-14T00:00:00.000',
        },
        {
          site: 'site-1',
          state_territory: 'TX',
          counties_served: 'Travis',
          sample_collect_date: '2026-08-18',
          pcr_target: 'sars-cov-2',
          pcr_target_avg_conc_lin: '180',
          pcr_target_units: 'copies/L',
          date_updated: '2026-08-21T00:00:00.000',
        },
      ]),
      dataset: wastewaterCovidDataset,
      geography: {
        level: 'country',
        code: 'US',
        name: 'United States',
        countryCode: 'US',
        countryName: 'United States',
        providerCodes: { who: 'USA' },
      },
      now: '2026-08-22T00:00:00Z',
    });

    expect(cdcWastewaterUrl(wastewaterCovidDataset)).toContain('j9g8-acpt');
    expect(cdcWastewaterUrl(wastewaterCovidDataset)).not.toContain('app_token');
    expect(signal).toMatchObject({
      domain: 'biological',
      type: 'wastewater-covid-19',
      geography: { level: 'country', code: 'US', name: 'United States' },
      category: 'unknown',
      trend: 'unknown',
      metadata: expect.objectContaining({
        unavailable: true,
        reason: 'cdc-wastewater-aggregation-unavailable',
        surveillanceBasis: 'wastewater surveillance',
        sourceRows: 2,
        scopeLimitation:
          'The public CDC site/sample dataset is not displayed as a national, state, or sewershed signal until a documented stable aggregation is integrated.',
        noClinicalPrevalenceInference: true,
      }),
    });
    expect(signal.value).toBeUndefined();
    expect(signal.unit).toBeUndefined();
    expect(signal.trend).toBe('unknown');
  });

  it('keeps missing CDC wastewater data unavailable rather than Low activity', () => {
    const signal = normalizeCdcWastewaterSignal({
      payload: cdcWastewaterFixture([]),
      dataset: wastewaterCovidDataset,
      geography: {
        level: 'country',
        code: 'US',
        name: 'United States',
        countryCode: 'US',
        countryName: 'United States',
      },
      now: '2026-08-22T00:00:00Z',
    });

    expect(signal.type).toBe('wastewater-covid-19');
    expect(signal.metadata?.unavailable).toBe(true);
    expect(signal.metadata?.reason).toBe('cdc-wastewater-aggregation-unavailable');
    expect(signal.category).toBe('unknown');
    expect(signal.category).not.toBe('low');
  });

  it('normalizes PHAC Canada wastewater city rows without fabricating national evidence', () => {
    const signals = normalizePhacWastewaterSignals({
      csv: phacWastewaterCsv([
        'Metro Vancouver,covN2,Increasing,59,,,,City,Metro Vancouver,British Columbia,Canada,High,2026-08-16',
        'Metro Vancouver,fluA,No Change,59,,,,City,Metro Vancouver,British Columbia,Canada,Moderate,2026-08-16',
        'Metro Vancouver,rsv,Decreasing,59,,,,City,Metro Vancouver,British Columbia,Canada,Low,2026-08-16',
      ]),
      geography: {
        level: 'country',
        code: 'CA',
        name: 'Canada',
        countryCode: 'CA',
        countryName: 'Canada',
      },
      locationName: 'Metro Vancouver',
      now: '2026-08-22T00:00:00Z',
    });

    expect(signals).toHaveLength(3);
    expect(signals.find((signal) => signal.type === 'wastewater-covid-19')).toMatchObject({
      geography: {
        level: 'subregion',
        name: 'Metro Vancouver',
        countryCode: 'CA',
      },
      category: 'high',
      trend: 'rising',
      metadata: expect.objectContaining({
        reportingGeography: 'Metro Vancouver',
        noClinicalPrevalenceInference: true,
      }),
    });
    expect(signals.find((signal) => signal.type === 'wastewater-influenza')?.trend).toBe('stable');
    expect(signals.find((signal) => signal.type === 'wastewater-rsv')?.trend).toBe('falling');
  });

  it('does not match PHAC wastewater rows by substring-only place names', () => {
    const signals = normalizePhacWastewaterSignals({
      csv: phacWastewaterCsv([
        'Metro Vancouver,covN2,Increasing,59,,,,City,Metro Vancouver,British Columbia,Canada,High,2026-08-16',
      ]),
      geography: {
        level: 'country',
        code: 'CA',
        name: 'Canada',
        countryCode: 'CA',
        countryName: 'Canada',
      },
      locationName: 'Vancouver',
      now: '2026-08-22T00:00:00Z',
    });

    expect(signals.find((signal) => signal.type === 'wastewater-covid-19')).toMatchObject({
      metadata: expect.objectContaining({
        unavailable: true,
        reason: 'no-phac-wastewater-observation',
      }),
    });
  });

  it('keeps unmatched PHAC Canada wastewater unavailable rather than Low activity', () => {
    const signals = normalizePhacWastewaterSignals({
      csv: phacWastewaterCsv([
        'Metro Vancouver,covN2,Increasing,59,,,,City,Metro Vancouver,British Columbia,Canada,High,2026-08-16',
      ]),
      geography: {
        level: 'country',
        code: 'CA',
        name: 'Canada',
        countryCode: 'CA',
        countryName: 'Canada',
      },
      locationName: 'Toronto',
      now: '2026-08-22T00:00:00Z',
    });

    expect(signals).toHaveLength(3);
    expect(signals.every((signal) => signal.metadata?.unavailable === true)).toBe(true);
    expect(signals.every((signal) => signal.category === 'unknown')).toBe(true);
    expect(signals.every((signal) => signal.category !== 'low')).toBe(true);
  });

  it('normalizes Santé publique France SUM’Eau national wastewater without localizing it to Paris', () => {
    const signal = normalizeSumeauWastewaterSignal({
      payload: sumeauFixture([
        {
          date_complet: '2026-08-03',
          semaine: '2026-S32',
          national_54: 400,
        },
        {
          date_complet: '2026-08-10',
          semaine: '2026-S33',
          national_54: null,
          national_12: 565,
        },
      ]),
      geography: {
        level: 'country',
        code: 'FR',
        name: 'France',
        countryCode: 'FR',
        countryName: 'France',
      },
      now: '2026-08-22T00:00:00Z',
    });

    expect(signal).toMatchObject({
      domain: 'biological',
      type: 'wastewater-covid-19',
      geography: { level: 'country', code: 'FR', countryCode: 'FR' },
      value: 565,
      unit: 'normalized indicator',
      category: 'unknown',
      trend: 'rising',
      reportingPeriod: { type: 'week', year: 2026, week: 33 },
      metadata: expect.objectContaining({
        reportingGeography: 'France',
        sourceColumn: 'national_12',
        noClinicalPrevalenceInference: true,
      }),
    });
    expect(signal.history?.at(-1)?.source?.measure).toBe('national_12');
  });

  it('keeps missing SUM’Eau data unavailable rather than Low activity', () => {
    const signal = normalizeSumeauWastewaterSignal({
      payload: sumeauFixture([]),
      geography: {
        level: 'country',
        code: 'FR',
        name: 'France',
        countryCode: 'FR',
        countryName: 'France',
      },
      now: '2026-08-22T00:00:00Z',
    });

    expect(signal.metadata?.unavailable).toBe(true);
    expect(signal.category).toBe('unknown');
    expect(signal.category).not.toBe('low');
  });

  it('normalizes RIVM national wastewater without treating it as clinical prevalence', () => {
    const signal = normalizeRivmWastewaterSignal({
      payload: [
        {
          Date_of_report: '2026-08-26',
          Date_measurement: '2026-08-12',
          RNA_flow_per_100000: 1000,
        },
        {
          Date_of_report: '2026-08-26',
          Date_measurement: '2026-08-19',
          RNA_flow_per_100000: 1500,
        },
      ],
      geography: {
        level: 'country',
        code: 'NL',
        name: 'Netherlands',
        countryCode: 'NL',
        countryName: 'Netherlands',
        providerCodes: { who: 'NLD' },
      },
      now: '2026-08-29T00:00:00Z',
    });

    expect(signal).toMatchObject({
      domain: 'biological',
      type: 'wastewater-covid-19',
      geography: { level: 'country', code: 'NL', countryCode: 'NL' },
      value: 1500,
      unit: 'virus particles per 100,000 inhabitants',
      category: 'unknown',
      trend: 'rising',
      source: {
        provider: 'RIVM',
        dataset: 'COVID-19_rioolwaterdata_landelijk',
      },
      metadata: expect.objectContaining({
        surveillanceBasis: 'national wastewater concentration',
        noClinicalPrevalenceInference: true,
      }),
    });
  });

  it('keeps missing RIVM wastewater data unavailable rather than Low activity', () => {
    const signal = normalizeRivmWastewaterSignal({
      payload: [],
      geography: {
        level: 'country',
        code: 'NL',
        name: 'Netherlands',
        countryCode: 'NL',
        countryName: 'Netherlands',
      },
      now: '2026-08-29T00:00:00Z',
    });

    expect(signal.metadata?.unavailable).toBe(true);
    expect(signal.category).toBe('unknown');
    expect(signal.category).not.toBe('low');
  });

  it('normalizes WHO malaria as annual context rather than current vector activity', () => {
    const signal = normalizeWhoMalariaContext({
      payload: whoMalariaFixture([
        {
          IndicatorCode: 'MALARIA_EST_INCIDENCE',
          SpatialDimType: 'COUNTRY',
          SpatialDim: 'KEN',
          TimeDim: 2023,
          NumericValue: 60,
          Date: '2024-12-19T00:00:00Z',
          TimeDimensionBegin: '2023-01-01T00:00:00Z',
          TimeDimensionEnd: '2023-12-31T23:59:59Z',
        },
        {
          IndicatorCode: 'MALARIA_EST_INCIDENCE',
          SpatialDimType: 'COUNTRY',
          SpatialDim: 'KEN',
          TimeDim: 2024,
          NumericValue: 74.2,
          Date: '2025-12-19T00:00:00Z',
          TimeDimensionBegin: '2024-01-01T00:00:00Z',
          TimeDimensionEnd: '2024-12-31T23:59:59Z',
        },
      ]),
      geography: {
        level: 'country',
        code: 'KE',
        name: 'Kenya',
        countryCode: 'KE',
        countryName: 'Kenya',
        providerCodes: { who: 'KEN' },
      },
      now: '2026-08-28T12:00:00Z',
    });

    expect(whoMalariaUrl({ ...czechia, providerCodes: { who: 'KEN' } })).toContain(
      'MALARIA_EST_INCIDENCE',
    );
    expect(signal).toMatchObject({
      domain: 'biological',
      type: 'malaria',
      reportingPeriod: { type: 'year', year: 2024 },
      category: 'unknown',
      trend: 'rising',
      source: {
        provider: 'WHO Global Health Observatory',
        dataset: 'MALARIA_EST_INCIDENCE',
      },
      metadata: expect.objectContaining({
        surveillanceBasis: 'annual incidence context',
        notCurrentActivity: true,
        noPersonalRiskInference: true,
      }),
    });
  });

  it('omits zero-incidence malaria context instead of inventing a Low vector signal', () => {
    const signal = normalizeWhoMalariaContext({
      payload: whoMalariaFixture([
        {
          IndicatorCode: 'MALARIA_EST_INCIDENCE',
          SpatialDimType: 'COUNTRY',
          SpatialDim: 'CZE',
          TimeDim: 2024,
          NumericValue: 0,
          TimeDimensionEnd: '2024-12-31T23:59:59Z',
        },
      ]),
      geography: czechia,
      now: '2026-08-28T12:00:00Z',
    });

    expect(signal).toBeNull();
  });

  it('normalizes ECDC dengue clusters without converting them to personal risk', () => {
    const signal = normalizeEcdcDengueSignal({
      csv: ecdcDengueCsv([
        '"France","FR-2026-001","Bouches-du-Rhône","Marseille","Closed","2026-07-15","2026-07-19","2"',
        '"France","FR-2026-002","Bouches-du-Rhône","Marseille","Active","2026-08-02","2026-08-05","3"',
      ]),
      geography: {
        level: 'country',
        code: 'FR',
        name: 'France',
        countryCode: 'FR',
        countryName: 'France',
      },
      locationName: 'Marseille',
      now: '2026-08-22T00:00:00Z',
    });

    expect(signal).toMatchObject({
      domain: 'biological',
      type: 'dengue',
      geography: {
        level: 'subregion',
        code: 'FR-2026-002',
        name: 'Marseille',
        countryCode: 'FR',
      },
      value: 3,
      unit: 'cases',
      category: 'unknown',
      trend: 'rising',
      updatedAt: '2026-08-05T00:00:00.000Z',
      freshness: expect.objectContaining({ status: 'aging' }),
      metadata: expect.objectContaining({
        providerCategory: 'Active',
        clusterId: 'FR-2026-002',
        surveillanceBasis: 'locally acquired dengue cluster surveillance',
        noPersonalRiskInference: true,
      }),
    });
  });

  it('does not match ECDC dengue clusters by substring-only place names', () => {
    const signal = normalizeEcdcDengueSignal({
      csv: ecdcDengueCsv([
        '"France","FR-2026-002","Bouches-du-Rhône","Marseille","Active","2026-08-02","2026-08-05","3"',
      ]),
      geography: {
        level: 'country',
        code: 'FR',
        name: 'France',
        countryCode: 'FR',
        countryName: 'France',
      },
      locationName: 'Rhône',
      now: '2026-08-22T00:00:00Z',
    });

    expect(signal).toMatchObject({
      type: 'dengue',
      metadata: expect.objectContaining({
        unavailable: true,
        reason: 'no-ecdc-dengue-cluster',
      }),
    });
  });

  it('keeps missing ECDC dengue clusters unavailable rather than Low activity', () => {
    const signal = normalizeEcdcDengueSignal({
      csv: ecdcDengueCsv([
        '"France","FR-2026-002","Bouches-du-Rhône","Marseille","Active","2026-08-02","2026-08-05","3"',
      ]),
      geography: czechia,
      now: '2026-08-22T00:00:00Z',
    });

    expect(signal.metadata?.unavailable).toBe(true);
    expect(signal.category).toBe('unknown');
    expect(signal.category).not.toBe('low');
    expect(signal.metadata?.reason).toBe('no-ecdc-dengue-cluster');
  });

  it('supports Greece for ECDC dengue through the provider country-code alias', () => {
    expect(
      ecdcDengueProvider.supports({
        geography: {
          level: 'country',
          code: 'GR',
          name: 'Greece',
          countryCode: 'GR',
          countryName: 'Greece',
        },
        now: '2026-08-22T00:00:00Z',
      }),
    ).toBe(true);
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

  it('classifies stalled JSON body reads as provider timeouts', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: () => new Promise(() => undefined),
    } as Response);

    await expect(fetchHealthJson('https://example.test/health.json', 1)).rejects.toThrow(
      'Request timed out',
    );
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

  it('normalizes global OWID excess mortality without converting missing category to Low', () => {
    const signal = normalizeOwidExcessMortality(owidFixture(), {
      geography: {
        level: 'country',
        code: 'JP',
        name: 'Japan',
        countryCode: 'JP',
        countryName: 'Japan',
        providerCodes: { who: 'JPN' },
      },
      now: '2026-08-25T00:00:00Z',
    });

    expect(signal).toMatchObject({
      domain: 'population-health',
      type: 'excess-mortality',
      value: 3.6,
      unit: '%',
      category: 'unknown',
      trend: 'rising',
      source: {
        provider: 'Our World in Data',
        dataset: 'excess-mortality-p-scores-average-baseline',
      },
      reportingPeriod: { type: 'week', year: 2026, week: 31 },
    });
    expect(signal.history).toHaveLength(2);
    expect(healthSignalValueLabel(signal)).toBe('+3.6%');
  });

  it('keeps missing OWID mortality observations explicit instead of normal', () => {
    const signal = normalizeOwidExcessMortality(owidFixture(), {
      geography: {
        level: 'country',
        code: 'KE',
        name: 'Kenya',
        countryCode: 'KE',
        countryName: 'Kenya',
        providerCodes: { who: 'KEN' },
      },
      now: '2026-08-25T00:00:00Z',
    });

    expect(signal).toMatchObject({
      type: 'excess-mortality',
      category: 'unknown',
      freshness: { status: 'stale' },
      metadata: expect.objectContaining({ unavailable: true }),
    });
    expect(signal.value).toBeUndefined();
    expect(healthSignalValueLabel(signal)).toBe('No recent data');
  });

  it('keeps OWID provider requests free of names, coordinates, profile, and RevenueCat data', () => {
    const url = owidExcessMortalityUrl();

    expect(url).toContain('ourworldindata.org/grapher');
    expect(url).toContain('excess-mortality-p-scores-average-baseline');
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

  it('returns explicit WHO provider-error signals on schema failures', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ value: 'not-a-row-list' }),
    } as Response);

    const result = await whoRespiratoryProvider.fetchSignals({
      geography: czechia,
      now: '2026-08-25T00:00:00Z',
    });

    expect(result.signals).toHaveLength(3);
    expect(result.signals).toEqual(
      expect.arrayContaining(
        RESPIRATORY_SIGNAL_TYPES.map((type) =>
          expect.objectContaining({
            type,
            category: 'unknown',
            metadata: expect.objectContaining({
              unavailable: true,
              providerStatus: 'provider-error',
              reason: 'who-respiratory-provider-error',
            }),
          }),
        ),
      ),
    );
    expect(result.signalStatuses).toEqual(
      RESPIRATORY_SIGNAL_TYPES.map((type) =>
        expect.objectContaining({
          type,
          status: 'provider-error',
          reason: 'who-respiratory-provider-error',
          providerErrorKind: 'schema',
        }),
      ),
    );
  });

  it('keeps CDC wastewater provider errors isolated per pathogen', async () => {
    const fetchMock = jest.fn().mockImplementation((url: string) => {
      if (url.includes('ymmh-divb')) {
        return Promise.reject(new Error('CDC flu dataset unavailable'));
      }

      return Promise.resolve({
        ok: true,
        json: async () =>
          cdcWastewaterFixture([
            {
              sample_collect_date: '2026-08-11',
              pcr_target: url.includes('45cq-cw4i') ? 'rsv' : 'sars-cov-2',
              pcr_target_avg_conc_lin: '100',
              pcr_target_units: 'copies/L',
              date_updated: '2026-08-14T00:00:00.000',
            },
            {
              sample_collect_date: '2026-08-18',
              pcr_target: url.includes('45cq-cw4i') ? 'rsv' : 'sars-cov-2',
              pcr_target_avg_conc_lin: '120',
              pcr_target_units: 'copies/L',
              date_updated: '2026-08-21T00:00:00.000',
            },
          ]),
      } as Response);
    });
    jest.spyOn(global, 'fetch').mockImplementation(fetchMock);

    const result = await cdcWastewaterProvider.fetchSignals({
      geography: {
        level: 'country',
        code: 'US',
        name: 'United States',
        countryCode: 'US',
        countryName: 'United States',
      },
      now: '2026-08-22T00:00:00Z',
    });

    expect(result.signals).toHaveLength(3);
    expect(result.signals.find((signal) => signal.type === 'wastewater-influenza')).toMatchObject({
      geography: { level: 'country', code: 'US', countryCode: 'US' },
      metadata: expect.objectContaining({
        unavailable: true,
        providerStatus: 'provider-error',
        reason: 'cdc-wastewater-provider-error',
        providerErrorKind: 'network',
      }),
    });
    expect(result.signals.find((signal) => signal.type === 'wastewater-covid-19')).toMatchObject({
      metadata: expect.objectContaining({
        unavailable: true,
        reason: 'cdc-wastewater-aggregation-unavailable',
        surveillanceBasis: 'wastewater surveillance',
      }),
    });
    expect(result.signals.find((signal) => signal.type === 'wastewater-rsv')).toMatchObject({
      metadata: expect.objectContaining({
        unavailable: true,
        reason: 'cdc-wastewater-aggregation-unavailable',
        surveillanceBasis: 'wastewater surveillance',
      }),
    });
    expect(result.signalStatuses).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: 'wastewater-covid-19',
          status: 'no-data',
          reason: 'cdc-wastewater-aggregation-unavailable',
        }),
        expect.objectContaining({
          type: 'wastewater-influenza',
          status: 'provider-error',
          reason: 'cdc-wastewater-provider-error',
          providerErrorKind: 'network',
        }),
        expect.objectContaining({
          type: 'wastewater-rsv',
          status: 'no-data',
          reason: 'cdc-wastewater-aggregation-unavailable',
        }),
      ]),
    );
  });

  it('returns explicit provider-error signals for PHAC wastewater schema failures', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      text: async () => 'not,the,expected,schema\n1,2,3,4',
    } as Response);

    const result = await phacWastewaterProvider.fetchSignals({
      geography: {
        level: 'country',
        code: 'CA',
        name: 'Canada',
        countryCode: 'CA',
        countryName: 'Canada',
      },
      locationName: 'Vancouver',
      now: '2026-08-22T00:00:00Z',
    });

    expect(result.signals).toHaveLength(3);
    expect(
      result.signals.every((signal) => signal.metadata?.providerStatus === 'provider-error'),
    ).toBe(true);
    expect(result.signalStatuses?.every((status) => status.status === 'provider-error')).toBe(true);
  });

  it('returns explicit provider-error signals for SUM’Eau schema failures', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ value: [] }),
    } as Response);

    const result = await sumeauWastewaterProvider.fetchSignals({
      geography: {
        level: 'country',
        code: 'FR',
        name: 'France',
        countryCode: 'FR',
        countryName: 'France',
      },
      now: '2026-08-22T00:00:00Z',
    });

    expect(result.signals).toHaveLength(1);
    expect(result.signals[0]).toMatchObject({
      type: 'wastewater-covid-19',
      metadata: expect.objectContaining({
        providerStatus: 'provider-error',
        reason: 'sumeau-wastewater-provider-error',
      }),
    });
    expect(result.signalStatuses).toEqual([
      expect.objectContaining({
        type: 'wastewater-covid-19',
        status: 'provider-error',
        reason: 'sumeau-wastewater-provider-error',
        providerErrorKind: 'schema',
      }),
    ]);
  });

  it('returns explicit provider-error signals for ECDC dengue schema failures', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      text: async () => 'not,the,expected,schema\n1,2,3,4',
    } as Response);

    const result = await ecdcDengueProvider.fetchSignals({
      geography: {
        level: 'country',
        code: 'FR',
        name: 'France',
        countryCode: 'FR',
        countryName: 'France',
      },
      now: '2026-08-22T00:00:00Z',
    });

    expect(result.signals).toHaveLength(1);
    expect(result.signals[0]).toMatchObject({
      type: 'dengue',
      metadata: expect.objectContaining({
        providerStatus: 'provider-error',
        reason: 'ecdc-dengue-provider-error',
        providerErrorKind: 'schema',
      }),
    });
    expect(result.signalStatuses).toEqual([
      expect.objectContaining({
        type: 'dengue',
        status: 'provider-error',
        reason: 'ecdc-dengue-provider-error',
        providerErrorKind: 'schema',
      }),
    ]);
  });

  it('extends excess mortality to non-Eurostat countries through OWID', async () => {
    const tokyo = locationAt('Tokyo', 35.6762, 139.6503);
    const fetchMock = jest.fn().mockImplementation((url: string) => {
      if (url.includes('FLUMART/VIW_FNT')) {
        return Promise.resolve({
          ok: true,
          json: async () =>
            whoFluNetFixture([
              {
                COUNTRY_CODE: 'JPN',
                COUNTRY_AREA_TERRITORY: 'Japan',
                ISO_WEEKSTARTDATE: '2026-08-10',
                ISO_YEAR: 2026,
                ISO_WEEK: 33,
                SPEC_PROCESSED_NB: 100,
                INF_ALL: 11,
              },
            ]),
        } as Response);
      }
      if (url.includes('ourworldindata.org/grapher')) {
        return Promise.resolve({
          ok: true,
          text: async () =>
            owidFixture([
              ['Czechia', 'CZE', '2026-W30', -5.9],
              ['Czechia', 'CZE', '2026-W31', 4.2],
              ['Japan', 'JPN', '2026-W30', 1.2],
              ['Japan', 'JPN', '2026-W31', 3.6],
            ]),
        } as Response);
      }

      return Promise.resolve({
        ok: true,
        json: async () => safecastFixture([]),
      } as Response);
    });
    jest.spyOn(global, 'fetch').mockImplementation(fetchMock);

    const result = await refreshHealthSignalsForLocation({
      location: tokyo,
      environment: null,
      force: true,
      now: '2026-08-25T00:00:00Z',
    });

    expect(result.geography).toMatchObject({ countryCode: 'JP', name: 'Japan' });
    expect(fetchMock.mock.calls.some(([url]) => String(url).includes('demo_mexrt'))).toBe(false);
    expect(fetchMock.mock.calls.some(([url]) => String(url).includes('ourworldindata'))).toBe(true);
    expect(result.signals).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: 'excess-mortality',
          geography: expect.objectContaining({ countryCode: 'JP' }),
          source: expect.objectContaining({ provider: 'Our World in Data' }),
          category: 'unknown',
          value: 3.6,
        }),
      ]),
    );
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

  it('does not let a partial multi-signal provider cache suppress refreshes', async () => {
    const [cachedInfluenza] = normalizeWhoRespiratorySignals(whoFluNetFixture(), {
      geography: czechia,
      now: '2026-08-25T00:00:00Z',
      signalTypes: ['influenza'],
    });
    await saveHealthSignalsCache({
      version: 1,
      savedAt: '2026-08-25T00:00:00Z',
      cacheKey: 'country:CZ',
      geography: czechia,
      signals: [cachedInfluenza as HealthSignal],
    });

    const fetchMock = jest.fn().mockImplementation((url: string) => {
      if (url.includes('FLUMART/VIW_FNT')) {
        return Promise.resolve({
          ok: true,
          json: async () => whoFluNetFixture(),
        } as Response);
      }
      if (url.includes('demo_mexrt')) {
        return Promise.resolve({
          ok: true,
          json: async () => eurostatFixture(),
        } as Response);
      }
      if (url.includes('ourworldindata.org/grapher')) {
        return Promise.resolve({
          ok: true,
          text: async () => owidFixture([['Czechia', 'CZE', '2026-W33', 4.2]]),
        } as Response);
      }
      if (url.includes('MALARIA_EST_INCIDENCE')) {
        return Promise.resolve({
          ok: true,
          json: async () => whoMalariaFixture([]),
        } as Response);
      }
      if (url.includes('dengue-weekly.ecdc.europa.eu')) {
        return Promise.resolve(ecdcDengueNoLocalClusterResponse());
      }

      return Promise.resolve({
        ok: true,
        json: async () => safecastFixture([]),
      } as Response);
    });
    jest.spyOn(global, 'fetch').mockImplementation(fetchMock);

    const state = await refreshHealthSignalsForLocation({
      location: pragueLocation,
      environment: null,
      now: '2026-08-25T01:00:00Z',
    });

    expect(
      fetchMock.mock.calls.filter(([url]) => String(url).includes('FLUMART/VIW_FNT')),
    ).toHaveLength(1);
    const respiratoryTypes = new Set<string>(RESPIRATORY_SIGNAL_TYPES);
    expect(
      state.signals
        .filter((signal) => respiratoryTypes.has(signal.type))
        .map((signal) => signal.type),
    ).toEqual(['influenza', 'covid-19', 'rsv']);
  });

  it('does not let a fresh Eurostat cache suppress the preferred OWID mortality fetch', async () => {
    const cachedEurostatSignal = normalizeEurostatExcessMortality(
      eurostatFixture({ '2026-07': 2.4 }),
      {
        geography: czechia,
        now: '2026-08-25T00:00:00Z',
      },
    ) as HealthSignal;
    await saveHealthSignalsCache({
      version: 1,
      savedAt: '2026-08-24T00:00:00Z',
      cacheKey: 'country:CZ',
      geography: czechia,
      signals: [cachedEurostatSignal],
    });

    const fetchMock = jest.fn().mockImplementation((url: string) => {
      if (url.includes('FLUMART/VIW_FNT')) {
        return Promise.resolve({
          ok: true,
          json: async () => whoFluNetFixture(),
        } as Response);
      }
      if (url.includes('ourworldindata.org/grapher')) {
        return Promise.resolve({
          ok: true,
          text: async () =>
            owidFixture([
              ['Czechia', 'CZE', '2026-W33', 4.2],
              ['Czechia', 'CZE', '2026-W34', 5.1],
            ]),
        } as Response);
      }
      if (url.includes('MALARIA_EST_INCIDENCE')) {
        return Promise.resolve({
          ok: true,
          json: async () => whoMalariaFixture([]),
        } as Response);
      }
      if (url.includes('dengue-weekly.ecdc.europa.eu')) {
        return Promise.resolve(ecdcDengueNoLocalClusterResponse());
      }

      return Promise.resolve({
        ok: true,
        json: async () => safecastFixture([]),
      } as Response);
    });
    jest.spyOn(global, 'fetch').mockImplementation(fetchMock);

    const state = await refreshHealthSignalsForLocation({
      location: pragueLocation,
      environment: null,
      now: '2026-08-25T00:00:00Z',
    });

    expect(fetchMock.mock.calls.some(([url]) => String(url).includes('demo_mexrt'))).toBe(false);
    expect(fetchMock.mock.calls.some(([url]) => String(url).includes('ourworldindata'))).toBe(true);
    expect(state.signals.find((signal) => signal.type === 'excess-mortality')).toMatchObject({
      source: expect.objectContaining({ provider: 'Our World in Data' }),
      reportingPeriod: { type: 'week', year: 2026, week: 34 },
      value: 5.1,
    });
    await expect(loadHealthSignalsCacheForGeography('country:CZ')).resolves.toMatchObject({
      signals: expect.arrayContaining([
        expect.objectContaining({
          type: 'excess-mortality',
          source: expect.objectContaining({ provider: 'Eurostat' }),
        }),
        expect.objectContaining({
          type: 'excess-mortality',
          source: expect.objectContaining({ provider: 'Our World in Data' }),
        }),
      ]),
    });
  });

  it('does not reuse PHAC wastewater evidence across Canadian saved locations', async () => {
    const vancouver: LocationInfo = {
      ...pragueLocation,
      activeLocationId: 'manual-vancouver',
      activeLocationName: 'Vancouver',
      coordinates: { latitude: 49.2827, longitude: -123.1207 },
      placeName: 'Metro Vancouver',
      countryCode: 'CA',
      countryName: 'Canada',
    };
    const toronto: LocationInfo = {
      ...vancouver,
      activeLocationId: 'manual-toronto',
      activeLocationName: 'Toronto',
      coordinates: { latitude: 43.6532, longitude: -79.3832 },
      placeName: 'Toronto',
    };
    const userNamedMetroVancouver: LocationInfo = {
      ...vancouver,
      activeLocationId: 'manual-home',
      activeLocationName: 'Metro Vancouver',
      placeName: null,
    };
    const fetchMock = jest.fn().mockImplementation((url: string) => {
      if (url.includes('FLUMART/VIW_FNT')) {
        return Promise.resolve({
          ok: true,
          json: async () =>
            whoFluNetFixture([
              {
                COUNTRY_CODE: 'CAN',
                COUNTRY_AREA_TERRITORY: 'Canada',
                ISO_WEEKSTARTDATE: '2026-08-10',
                ISO_YEAR: 2026,
                ISO_WEEK: 33,
                SPEC_PROCESSED_NB: 100,
                INF_ALL: 14,
                RSV_PROCESSED: 80,
                RSV: 2,
              },
            ]),
        } as Response);
      }
      if (url.includes('health-infobase.canada.ca')) {
        return Promise.resolve({
          ok: true,
          text: async () =>
            phacWastewaterCsv([
              'Metro Vancouver,covN2,Increasing,59,,,,City,Metro Vancouver,British Columbia,Canada,High,2026-08-16',
              'Metro Vancouver,fluA,No Change,59,,,,City,Metro Vancouver,British Columbia,Canada,Moderate,2026-08-16',
              'Metro Vancouver,rsv,Decreasing,59,,,,City,Metro Vancouver,British Columbia,Canada,Low,2026-08-16',
            ]),
        } as Response);
      }
      if (url.includes('ourworldindata.org/grapher')) {
        return Promise.resolve({
          ok: true,
          text: async () =>
            owidFixture([
              ['Canada', 'CAN', '2026-W33', 1.2],
              ['Canada', 'CAN', '2026-W34', 1.4],
            ]),
        } as Response);
      }
      if (url.includes('MALARIA_EST_INCIDENCE')) {
        return Promise.resolve({
          ok: true,
          json: async () => whoMalariaFixture([]),
        } as Response);
      }

      return Promise.resolve({
        ok: true,
        json: async () => safecastFixture([]),
      } as Response);
    });
    jest.spyOn(global, 'fetch').mockImplementation(fetchMock);

    const userNamedState = await refreshHealthSignalsForLocation({
      location: userNamedMetroVancouver,
      environment: null,
      now: '2026-08-25T00:00:00Z',
    });
    const vancouverState = await refreshHealthSignalsForLocation({
      location: vancouver,
      environment: null,
      now: '2026-08-25T01:00:00Z',
    });
    const torontoState = await refreshHealthSignalsForLocation({
      location: toronto,
      environment: null,
      now: '2026-08-25T02:00:00Z',
    });

    expect(
      fetchMock.mock.calls.filter(([url]) => String(url).includes('health-infobase.canada.ca')),
    ).toHaveLength(3);
    const userNamedCovid = userNamedState.signals.find(
      (signal) => signal.type === 'wastewater-covid-19',
    );
    const vancouverCovid = vancouverState.signals.find(
      (signal) => signal.type === 'wastewater-covid-19',
    );
    const torontoCovid = torontoState.signals.find(
      (signal) => signal.type === 'wastewater-covid-19',
    );

    expect(userNamedCovid).toMatchObject({
      metadata: expect.objectContaining({
        unavailable: true,
        reason: 'no-phac-wastewater-observation',
      }),
    });
    expect(vancouverCovid).toMatchObject({
      geography: expect.objectContaining({ name: 'Metro Vancouver' }),
    });
    expect(vancouverCovid?.metadata?.unavailable).not.toBe(true);
    expect(torontoCovid).toMatchObject({
      geography: expect.objectContaining({ countryCode: 'CA' }),
      metadata: expect.objectContaining({
        unavailable: true,
        reason: 'no-phac-wastewater-observation',
      }),
    });
  });

  it('normalizes only calibrated Safecast dose-rate measurements', () => {
    expect(normalizeDoseRate(120, 'nSv/h')?.value).toBeCloseTo(0.12);
    expect(normalizeDoseRate(0.002, 'mSv/h')?.value).toBeCloseTo(2);
    expect(normalizeDoseRate(0.11, 'µSv/h')?.value).toBeCloseTo(0.11);
    expect(normalizeDoseRate(45, 'cpm')).toBeNull();
    expect(normalizeDoseRate(2000, 'mSv/h')).toBeNull();

    const observations = normalizeSafecastRadiationMeasurements(
      safecastFixture([
        safecastMeasurement({
          id: 1,
          value: 0.12,
          capturedAt: '2026-08-25T10:00:00Z',
        }),
        safecastMeasurement({
          id: 2,
          value: 45,
          unit: 'cpm',
          capturedAt: '2026-08-25T10:05:00Z',
        }),
      ]),
    );

    expect(observations).toHaveLength(1);
    expect(observations[0]).toMatchObject({
      value: 0.12,
      unit: 'µSv/h',
      sensor: expect.objectContaining({ distanceKm: 0.8 }),
    });
  });

  it('uses measurement coordinates as a Safecast distance fallback for current queries', () => {
    const observations = normalizeSafecastRadiationMeasurements(
      safecastFixture([
        safecastMeasurement({
          id: 'no-distance',
          value: 0.12,
          capturedAt: '2026-08-25T10:00:00Z',
          includeDistance: false,
        }),
      ]),
      { originCoordinates: pragueLocation.coordinates ?? undefined },
    );

    const selected = selectBestRadiologicalObservation({
      observations,
      now: '2026-08-25T12:00:00Z',
      staleAfterMs: 180 * 24 * 60 * 60 * 1000,
    });

    expect(selected?.measurementId).toBe('no-distance');
    expect(selected?.sensor.distanceKm).toBeGreaterThan(0.4);
    expect(selected?.sensor.distanceKm).toBeLessThan(0.7);
  });

  it('prefers a recent valid Safecast reading over a stale closer reading', () => {
    const observations = normalizeSafecastRadiationMeasurements(
      safecastFixture([
        safecastMeasurement({
          id: 'stale-close',
          value: 0.1,
          capturedAt: '2025-01-01T00:00:00Z',
          distanceM: 100,
        }),
        safecastMeasurement({
          id: 'fresh-farther',
          value: 0.13,
          capturedAt: '2026-08-25T10:00:00Z',
          distanceM: 1800,
        }),
      ]),
    );

    const selected = selectBestRadiologicalObservation({
      observations,
      now: '2026-08-25T12:00:00Z',
      staleAfterMs: 180 * 24 * 60 * 60 * 1000,
    });

    expect(selected?.measurementId).toBe('fresh-farther');
  });

  it('calculates a robust local radiation baseline and ignores a single high outlier', () => {
    const rows = Array.from({ length: 10 }, (_, index) =>
      safecastMeasurement({
        id: `baseline-${index}`,
        value: index === 9 ? 3.5 : 0.1 + index * 0.001,
        capturedAt: `2026-08-${(10 + index).toString().padStart(2, '0')}T00:00:00Z`,
      }),
    );
    const observations = normalizeSafecastRadiationMeasurements(safecastFixture(rows));
    const baseline = calculateRadiationBaseline({
      observations,
      now: '2026-08-25T00:00:00Z',
    });

    expect(baseline?.sampleCount).toBe(10);
    expect(baseline?.median).toBeGreaterThan(0.1);
    expect(baseline?.median).toBeLessThan(0.11);
    expect(interpretRadiation({ current: 0.11, baseline }).status).toBe('normal-background');
  });

  it('does not use the selected current radiation measurement to satisfy baseline sample count', () => {
    const rows = [
      ...Array.from({ length: 7 }, (_, index) =>
        safecastMeasurement({
          id: `history-${index}`,
          trackId: 'sensor:alpha',
          value: 0.1 + index * 0.001,
          capturedAt: `2026-08-${(10 + index).toString().padStart(2, '0')}T00:00:00Z`,
        }),
      ),
      safecastMeasurement({
        id: 'current',
        trackId: 'sensor:alpha',
        value: 0.16,
        capturedAt: '2026-08-25T11:30:00Z',
      }),
    ];
    const observations = normalizeSafecastRadiationMeasurements(safecastFixture(rows));
    const current = observations.find((observation) => observation.measurementId === 'current');

    const signal = radiologicalSignalFromSafecast({
      coordinates: pragueLocation.coordinates as NonNullable<LocationInfo['coordinates']>,
      observations,
      currentObservation: current,
      now: '2026-08-25T12:00:00Z',
      locationName: 'Czechia',
    });

    expect(signal.metadata?.baseline).toBeUndefined();
    expect(signal.category).toBe('unknown');
  });

  it('calculates radiation trend only from observations before the selected current reading', () => {
    const observations = normalizeSafecastRadiationMeasurements(
      safecastFixture([
        safecastMeasurement({
          id: 'older',
          trackId: 'sensor:alpha',
          value: 0.1,
          capturedAt: '2026-08-25T10:30:00Z',
        }),
        safecastMeasurement({
          id: 'current',
          trackId: 'sensor:alpha',
          value: 0.16,
          capturedAt: '2026-08-25T11:30:00Z',
        }),
        safecastMeasurement({
          id: 'newer-history',
          trackId: 'sensor:alpha',
          value: 0.9,
          capturedAt: '2026-08-25T11:55:00Z',
        }),
      ]),
    );
    const current = observations.find((observation) => observation.measurementId === 'current');

    expect(current).toBeDefined();
    expect(calculateRadiationTrend({ current: current!, observations })).toBe('rising');
  });

  it('does not treat missing Safecast data as normal background', () => {
    const signal = radiologicalSignalFromSafecast({
      coordinates: pragueLocation.coordinates as NonNullable<LocationInfo['coordinates']>,
      observations: [],
      now: '2026-08-25T00:00:00Z',
      locationName: 'Czechia',
    });

    expect(signal.domain).toBe('radiological');
    expect(signal.type).toBe('ambient-dose-rate');
    expect(signal.category).toBe('unknown');
    expect(signal.freshness.status).toBe('fresh');
    expect(signal.metadata?.unavailable).toBe(true);
    expect(healthSignalValueLabel(signal)).toBe('No recent local measurement');
  });

  it('derives elevated radiation status from baseline deviation with absolute guardrails', () => {
    const baseline = { median: 0.1, mad: 0.004, sampleCount: 12, periodDays: 30 };

    expect(interpretRadiation({ current: 0.13, baseline }).status).toBe('normal-background');
    expect(interpretRadiation({ current: 0.22, baseline }).status).toBe('elevated');
    expect(interpretRadiation({ current: 0.55, baseline }).status).toBe('strongly-elevated');
  });

  it('uses a spatial Safecast cache key instead of saved location names', () => {
    expect(
      safecastRadiationUrl({ coordinates: pragueLocation.coordinates!, radiusMeters: 25_000 }),
    ).toContain('lat=50.075500&lon=14.437800');
    expect(radiologicalSpatialCacheKey(pragueLocation.coordinates!)).toBe(
      radiologicalSpatialCacheKey({ latitude: 50.0799, longitude: 14.4399 }),
    );
    expect(radiologicalSpatialCacheKey(pragueLocation.coordinates!)).not.toContain('Prague');
  });

  it('uses Safecast sensor history as best-effort baseline evidence', async () => {
    expect(
      safecastSensorHistoryUrl({
        sensorId: 'sensor:alpha',
        now: '2026-08-25T12:00:00Z',
        periodDays: 30,
      }),
    ).toContain('/api/sensor/sensor%3Aalpha/history?start_date=2026-07-26&end_date=2026-08-25');

    const fetchMock = jest.fn().mockImplementation((url: string) => {
      if (url.includes('/api/radiation')) {
        return Promise.resolve({
          ok: true,
          json: async () =>
            safecastFixture([
              safecastMeasurement({
                id: 'current',
                trackId: 'sensor:alpha',
                value: 0.2,
                capturedAt: '2026-08-25T11:30:00Z',
              }),
            ]),
        } as Response);
      }

      return Promise.resolve({
        ok: true,
        json: async () =>
          safecastFixture(
            Array.from({ length: 9 }, (_, index) =>
              safecastMeasurement({
                id: `history-${index}`,
                trackId: 'sensor:alpha',
                value: 0.1 + index * 0.001,
                capturedAt: `2026-08-${(10 + index).toString().padStart(2, '0')}T00:00:00Z`,
              }),
            ),
          ),
      } as Response);
    });
    jest.spyOn(global, 'fetch').mockImplementation(fetchMock);

    const result = await safecastRadiologicalProvider.fetchSignals({
      geography: czechia,
      coordinates: pragueLocation.coordinates as NonNullable<LocationInfo['coordinates']>,
      now: '2026-08-25T12:00:00Z',
    });

    expect(fetchMock.mock.calls.map(([url]) => String(url))).toEqual([
      expect.stringContaining('/api/radiation'),
      expect.stringContaining('/api/sensor/sensor%3Aalpha/history'),
    ]);
    expect(result.signals[0]?.metadata?.baseline).toMatchObject({
      sampleCount: 9,
      periodDays: 30,
    });
    expect(result.signals[0]?.value).toBeCloseTo(0.2);
    expect(result.signals[0]?.metadata?.nearestSensorDistanceKm).toBeCloseTo(0.8);
  });

  it('does not let Safecast history rows without distance replace the selected current reading', async () => {
    const fetchMock = jest.fn().mockImplementation((url: string) => {
      if (url.includes('/api/radiation')) {
        return Promise.resolve({
          ok: true,
          json: async () =>
            safecastFixture([
              safecastMeasurement({
                id: 'current',
                trackId: 'sensor:alpha',
                value: 0.16,
                capturedAt: '2026-08-25T11:30:00Z',
                distanceM: 3_200,
              }),
            ]),
        } as Response);
      }

      return Promise.resolve({
        ok: true,
        json: async () =>
          safecastFixture([
            safecastMeasurement({
              id: 'newer-history-without-distance',
              trackId: 'sensor:alpha',
              value: 0.88,
              capturedAt: '2026-08-25T11:55:00Z',
              includeDistance: false,
            }),
            ...Array.from({ length: 8 }, (_, index) =>
              safecastMeasurement({
                id: `history-${index}`,
                trackId: 'sensor:alpha',
                value: 0.1 + index * 0.001,
                capturedAt: `2026-08-${(10 + index).toString().padStart(2, '0')}T00:00:00Z`,
                includeDistance: false,
              }),
            ),
          ]),
      } as Response);
    });
    jest.spyOn(global, 'fetch').mockImplementation(fetchMock);

    const result = await safecastRadiologicalProvider.fetchSignals({
      geography: czechia,
      coordinates: pragueLocation.coordinates as NonNullable<LocationInfo['coordinates']>,
      now: '2026-08-25T12:00:00Z',
    });

    expect(result.signals[0]?.value).toBeCloseTo(0.16);
    expect(result.signals[0]?.metadata?.measuredAt).toBe('2026-08-25T11:30:00.000Z');
    expect(result.signals[0]?.metadata?.nearestSensorDistanceKm).toBeCloseTo(3.2);
    expect(result.signals[0]?.trend).toBe('rising');
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
    const fetchMock = jest.fn().mockImplementation((url: string) => {
      if (url.includes('FLUMART/VIW_FNT')) {
        return Promise.resolve({
          ok: true,
          json: async () => whoFluNetFixture(),
        } as Response);
      }
      if (url.includes('demo_mexrt')) {
        return Promise.resolve({
          ok: true,
          json: async () => eurostatFixture(),
        } as Response);
      }
      if (url.includes('ourworldindata.org/grapher')) {
        return Promise.resolve({
          ok: true,
          text: async () =>
            owidFixture([
              ['Czechia', 'CZE', '2026-W33', 3.1],
              ['Czechia', 'CZE', '2026-W34', 3.4],
            ]),
        } as Response);
      }

      return Promise.resolve({
        ok: true,
        json: async () => safecastFixture([]),
      } as Response);
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

    expect(
      fetchMock.mock.calls.filter(([url]) => String(url).includes('FLUMART/VIW_FNT')),
    ).toHaveLength(1);
    expect(fetchMock.mock.calls.filter(([url]) => String(url).includes('demo_mexrt'))).toHaveLength(
      1,
    );
    expect(
      fetchMock.mock.calls.filter(([url]) => String(url).includes('ourworldindata.org/grapher')),
    ).toHaveLength(1);
    expect(
      fetchMock.mock.calls.filter(([url]) => String(url).includes('simplemap.safecast.org')),
    ).toHaveLength(6);
    expect(prague.geography?.countryCode).toBe('CZ');
    expect(brno.geography?.countryCode).toBe('CZ');
    expect(
      brno.signals.filter((signal) => signal.domain !== 'radiological').map((signal) => signal.id),
    ).toEqual(
      prague.signals
        .filter((signal) => signal.domain !== 'radiological')
        .map((signal) => signal.id),
    );
  });

  it('prefers fresher OWID mortality data over delayed Eurostat data for Eurostat countries', async () => {
    const fetchMock = jest.fn().mockImplementation((url: string) => {
      if (url.includes('FLUMART/VIW_FNT')) {
        return Promise.resolve({
          ok: true,
          json: async () => whoFluNetFixture(),
        } as Response);
      }
      if (url.includes('demo_mexrt')) {
        return Promise.resolve({
          ok: true,
          json: async () => eurostatFixture({ '2026-02': 0.2, '2026-03': 1.1 }),
        } as Response);
      }
      if (url.includes('ourworldindata.org/grapher')) {
        return Promise.resolve({
          ok: true,
          text: async () =>
            owidFixture([
              ['Czechia', 'CZE', '2026-W30', -5.9],
              ['Czechia', 'CZE', '2026-W31', 4.2],
            ]),
        } as Response);
      }
      if (url.includes('dengue-weekly.ecdc.europa.eu')) {
        return Promise.resolve(ecdcDengueNoLocalClusterResponse());
      }

      return Promise.resolve({
        ok: true,
        json: async () => safecastFixture([]),
      } as Response);
    });
    jest.spyOn(global, 'fetch').mockImplementation(fetchMock);

    const state = await refreshHealthSignalsForLocation({
      location: pragueLocation,
      environment: null,
      force: true,
      now: '2026-08-25T00:00:00Z',
    });
    const mortality = state.signals.find((signal) => signal.type === 'excess-mortality');

    expect(fetchMock.mock.calls.some(([url]) => String(url).includes('demo_mexrt'))).toBe(true);
    expect(fetchMock.mock.calls.some(([url]) => String(url).includes('ourworldindata'))).toBe(true);
    expect(mortality).toMatchObject({
      source: expect.objectContaining({ provider: 'Our World in Data' }),
      reportingPeriod: { type: 'week', year: 2026, week: 31 },
      value: 4.2,
    });
  });

  it('does not prefer stale OWID mortality over fresher Eurostat data', async () => {
    const fetchMock = jest.fn().mockImplementation((url: string) => {
      if (url.includes('FLUMART/VIW_FNT')) {
        return Promise.resolve({
          ok: true,
          json: async () => whoFluNetFixture(),
        } as Response);
      }
      if (url.includes('demo_mexrt')) {
        return Promise.resolve({
          ok: true,
          json: async () => eurostatFixture({ '2026-07': 2.4 }),
        } as Response);
      }
      if (url.includes('ourworldindata.org/grapher')) {
        return Promise.resolve({
          ok: true,
          text: async () =>
            owidFixture([
              ['Czechia', 'CZE', '2023-W51', 10.7],
              ['Czechia', 'CZE', '2023-W52', 9.8],
            ]),
        } as Response);
      }

      return Promise.resolve({
        ok: true,
        json: async () => safecastFixture([]),
      } as Response);
    });
    jest.spyOn(global, 'fetch').mockImplementation(fetchMock);

    const state = await refreshHealthSignalsForLocation({
      location: pragueLocation,
      environment: null,
      force: true,
      now: '2026-08-25T00:00:00Z',
    });

    expect(state.signals.find((signal) => signal.type === 'excess-mortality')).toMatchObject({
      source: expect.objectContaining({ provider: 'Eurostat' }),
      reportingPeriod: { type: 'month', year: 2026, month: 7 },
      value: 2.4,
    });
  });

  it('refreshes OWID mortality cache on a weekly cadence', async () => {
    const cachedOwidSignal = normalizeOwidExcessMortality(owidFixture(), {
      geography: czechia,
      now: '2026-08-25T00:00:00Z',
    });
    await saveHealthSignalsCache({
      version: 1,
      savedAt: '2026-08-17T00:00:00Z',
      cacheKey: 'country:CZ',
      geography: czechia,
      signals: [cachedOwidSignal],
    });

    const fetchMock = jest.fn().mockImplementation((url: string) => {
      if (url.includes('FLUMART/VIW_FNT')) {
        return Promise.resolve({
          ok: true,
          json: async () => whoFluNetFixture(),
        } as Response);
      }
      if (url.includes('demo_mexrt')) {
        return Promise.resolve({
          ok: true,
          json: async () => eurostatFixture({ '2026-07': 2.4 }),
        } as Response);
      }
      if (url.includes('ourworldindata.org/grapher')) {
        return Promise.resolve({
          ok: true,
          text: async () =>
            owidFixture([
              ['Czechia', 'CZE', '2026-W31', 4.2],
              ['Czechia', 'CZE', '2026-W32', 5.1],
            ]),
        } as Response);
      }

      return Promise.resolve({
        ok: true,
        json: async () => safecastFixture([]),
      } as Response);
    });
    jest.spyOn(global, 'fetch').mockImplementation(fetchMock);

    const state = await refreshHealthSignalsForLocation({
      location: pragueLocation,
      environment: null,
      now: '2026-08-25T00:00:00Z',
    });

    expect(OWID_EXCESS_MORTALITY_FRESHNESS.expectedUpdateIntervalMs).toBe(7 * 24 * 60 * 60 * 1000);
    expect(fetchMock.mock.calls.some(([url]) => String(url).includes('ourworldindata'))).toBe(true);
    expect(state.signals.find((signal) => signal.type === 'excess-mortality')).toMatchObject({
      source: expect.objectContaining({ provider: 'Our World in Data' }),
      value: 5.1,
    });
  });

  it('suppresses alternate mortality provider failures when OWID supplies usable data', async () => {
    jest.spyOn(global, 'fetch').mockImplementation((async (url: string) => {
      if (url.includes('FLUMART/VIW_FNT')) {
        return {
          ok: true,
          json: async () => whoFluNetFixture(),
        } as Response;
      }
      if (url.includes('demo_mexrt')) {
        throw new Error('Eurostat unavailable');
      }
      if (url.includes('ourworldindata.org/grapher')) {
        return {
          ok: true,
          text: async () =>
            owidFixture([
              ['Czechia', 'CZE', '2026-W30', -5.9],
              ['Czechia', 'CZE', '2026-W31', 4.2],
            ]),
        } as Response;
      }
      if (url.includes('MALARIA_EST_INCIDENCE')) {
        return {
          ok: true,
          json: async () => whoMalariaFixture([]),
        } as Response;
      }
      if (url.includes('dengue-weekly.ecdc.europa.eu')) {
        return ecdcDengueNoLocalClusterResponse();
      }

      return {
        ok: true,
        json: async () => safecastFixture([]),
      } as Response;
    }) as typeof fetch);

    const state = await refreshHealthSignalsForLocation({
      location: pragueLocation,
      environment: null,
      force: true,
      now: '2026-08-25T00:00:00Z',
    });

    expect(state.error).toBeNull();
    expect(state.signals.find((signal) => signal.type === 'excess-mortality')).toMatchObject({
      source: expect.objectContaining({ provider: 'Our World in Data' }),
    });
  });

  it('suppresses preferred mortality provider failures when Eurostat fallback supplies usable data', async () => {
    jest.spyOn(global, 'fetch').mockImplementation((async (url: string) => {
      if (url.includes('FLUMART/VIW_FNT')) {
        return {
          ok: true,
          json: async () => whoFluNetFixture(),
        } as Response;
      }
      if (url.includes('demo_mexrt')) {
        return {
          ok: true,
          json: async () => eurostatFixture({ '2026-07': 2.4 }),
        } as Response;
      }
      if (url.includes('ourworldindata.org/grapher')) {
        throw new Error('OWID unavailable');
      }
      if (url.includes('MALARIA_EST_INCIDENCE')) {
        return {
          ok: true,
          json: async () => whoMalariaFixture([]),
        } as Response;
      }
      if (url.includes('dengue-weekly.ecdc.europa.eu')) {
        return ecdcDengueNoLocalClusterResponse();
      }

      return {
        ok: true,
        json: async () => safecastFixture([]),
      } as Response;
    }) as typeof fetch);

    const state = await refreshHealthSignalsForLocation({
      location: pragueLocation,
      environment: null,
      force: true,
      now: '2026-08-25T00:00:00Z',
    });

    expect(state.error).toBeNull();
    expect(state.signals.find((signal) => signal.type === 'excess-mortality')).toMatchObject({
      source: expect.objectContaining({ provider: 'Eurostat' }),
      value: 2.4,
    });
  });

  it('surfaces provider-error signals even when providers resolve successfully', async () => {
    jest.spyOn(global, 'fetch').mockImplementation((async (url: string) => {
      if (url.includes('FLUMART/VIW_FNT')) {
        return {
          ok: true,
          json: async () => whoFluNetFixture(),
        } as Response;
      }
      if (url.includes('demo_mexrt')) {
        return {
          ok: true,
          json: async () => eurostatFixture({ '2026-07': 2.4 }),
        } as Response;
      }
      if (url.includes('ourworldindata.org/grapher')) {
        return {
          ok: true,
          text: async () =>
            owidFixture([
              ['Czechia', 'CZE', '2026-W30', -5.9],
              ['Czechia', 'CZE', '2026-W31', 4.2],
            ]),
        } as Response;
      }
      if (url.includes('simplemap.safecast.org')) {
        throw new Error('Safecast unavailable');
      }
      if (url.includes('MALARIA_EST_INCIDENCE')) {
        return {
          ok: true,
          json: async () => whoMalariaFixture([]),
        } as Response;
      }

      return {
        ok: true,
        json: async () => [],
      } as Response;
    }) as typeof fetch);

    const state = await refreshHealthSignalsForLocation({
      location: pragueLocation,
      environment: null,
      force: true,
      now: '2026-08-25T00:00:00Z',
    });

    expect(state.error).toBe('Some health surveillance signals are temporarily unavailable.');
    expect(state.signals.find((signal) => signal.type === 'ambient-dose-rate')).toMatchObject({
      metadata: expect.objectContaining({
        unavailable: true,
        providerStatus: 'provider-error',
        reason: 'safecast-provider-error',
      }),
    });
  });

  it('surfaces alternate mortality provider failures when the remaining mortality signal is stale', async () => {
    jest.spyOn(global, 'fetch').mockImplementation((async (url: string) => {
      if (url.includes('FLUMART/VIW_FNT')) {
        return {
          ok: true,
          json: async () => whoFluNetFixture(),
        } as Response;
      }
      if (url.includes('demo_mexrt')) {
        throw new Error('Eurostat unavailable');
      }
      if (url.includes('ourworldindata.org/grapher')) {
        return {
          ok: true,
          text: async () =>
            owidFixture([
              ['Czechia', 'CZE', '2023-W51', 10.7],
              ['Czechia', 'CZE', '2023-W52', 9.8],
            ]),
        } as Response;
      }
      if (url.includes('MALARIA_EST_INCIDENCE')) {
        return {
          ok: true,
          json: async () => whoMalariaFixture([]),
        } as Response;
      }

      return {
        ok: true,
        json: async () => safecastFixture([]),
      } as Response;
    }) as typeof fetch);

    const state = await refreshHealthSignalsForLocation({
      location: pragueLocation,
      environment: null,
      force: true,
      now: '2026-08-25T00:00:00Z',
    });

    expect(state.error).toBe('Some health surveillance signals are temporarily unavailable.');
    expect(state.signals.find((signal) => signal.type === 'excess-mortality')).toMatchObject({
      source: expect.objectContaining({ provider: 'Our World in Data' }),
      freshness: { status: 'stale' },
    });
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
      if (url.includes('MALARIA_EST_INCIDENCE')) {
        return {
          ok: true,
          json: async () => whoMalariaFixture([]),
        } as Response;
      }
      if (url.includes('simplemap.safecast.org')) {
        return {
          ok: true,
          json: async () => safecastFixture([]),
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
    expect(state.signals).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: 'influenza' }),
        expect.objectContaining({ type: 'covid-19' }),
        expect.objectContaining({ type: 'rsv' }),
        expect.objectContaining({ type: 'excess-mortality' }),
      ]),
    );
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

    expect(
      state.signals.some((signal) => signal.type === 'influenza' && signal.id === staleSignal.id),
    ).toBe(false);
    expect(
      state.signals.every((signal) => signal.metadata?.providerStatus === 'provider-error'),
    ).toBe(true);
    expect(state.error).toBe('Health surveillance is temporarily unavailable.');
  });

  it('fails health providers independently without throwing away existing environmental state', async () => {
    jest.spyOn(global, 'fetch').mockRejectedValue(new Error('network unavailable'));

    const state = await refreshHealthSignalsForLocation({
      location: pragueLocation,
      environment: null,
      now: '2026-08-25T00:00:00Z',
    });

    expect(
      state.signals.every((signal) => signal.metadata?.providerStatus === 'provider-error'),
    ).toBe(true);
    expect(state.error).toBe('Health surveillance is temporarily unavailable.');
  });
});

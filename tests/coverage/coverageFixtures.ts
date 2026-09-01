import { normalizeEurostatExcessMortality } from '../../src/api/health/eurostatExcessMortality';
import {
  normalizeCdcWastewaterSignal,
  type WastewaterDataset,
} from '../../src/api/health/cdcWastewater';
import { normalizeEcdcDengueSignal } from '../../src/api/health/ecdcDengue';
import { normalizeEcdcChikungunyaSignal } from '../../src/api/health/ecdcVectorSurveillance';
import { normalizePhacWastewaterSignals } from '../../src/api/health/phacWastewater';
import { normalizeRivmWastewaterSignal } from '../../src/api/health/rivmWastewater';
import { normalizeSumeauWastewaterSignal } from '../../src/api/health/sumeauWastewater';
import { normalizeOwidExcessMortality } from '../../src/api/health/owidExcessMortality';
import { normalizeWhoOutbreakSignals } from '../../src/api/health/whoOutbreaks';
import {
  normalizeSafecastRadiationMeasurements,
  radiologicalSignalFromSafecast,
} from '../../src/api/health/safecastRadiological';
import { normalizeWhoRespiratorySignals } from '../../src/api/health/whoRespiratory';
import { normalizeWhoMalariaContext } from '../../src/api/health/whoVectorDisease';
import { normalizeAirQuality } from '../../src/api/openMeteoAirQuality';
import { normalizeWeather } from '../../src/api/openMeteoWeather';
import { assembleEnvironment } from '../../src/services/environmentAssembler';
import { resolveHealthGeography } from '../../src/services/healthGeography';
import type { GlobalTestLocation } from './coverageTypes';
import { locationInfoFromGlobalLocation } from './globalLocations';

export const COVERAGE_NOW = '2026-08-28T12:00:00Z';

const WASTEWATER_COVID_DATASET: WastewaterDataset = {
  signalType: 'wastewater-covid-19',
  datasetId: 'j9g8-acpt',
  target: 'sars-cov-2',
  label: 'SARS-CoV-2 wastewater concentration',
};

const WASTEWATER_INFLUENZA_DATASET: WastewaterDataset = {
  signalType: 'wastewater-influenza',
  datasetId: 'ymmh-divb',
  target: 'fluav',
  label: 'Influenza A wastewater concentration',
};

const WASTEWATER_RSV_DATASET: WastewaterDataset = {
  signalType: 'wastewater-rsv',
  datasetId: '45cq-cw4i',
  target: 'rsv',
  label: 'RSV wastewater concentration',
};

function maybeValue(unavailable: boolean, value: number): number | null {
  return unavailable ? null : value;
}

function maybeValues(unavailable: boolean, values: number[]): (number | null)[] {
  return unavailable ? values.map(() => null) : values;
}

export function environmentFixtureForLocation(
  location: GlobalTestLocation,
  options: {
    missingOptional?: boolean | undefined;
    missingCore?: boolean | undefined;
    partial?: boolean | undefined;
    utciAvailable?: boolean | undefined;
  } = {},
) {
  const coordinates = { latitude: location.latitude, longitude: location.longitude };
  const currentTime = '2026-08-28T12:00';
  const hourlyTimes = ['2026-08-28T12:00', '2026-08-28T13:00', '2026-08-28T14:00'];
  const missingCore = options.missingCore === true;
  const missingOptional = options.missingOptional === true;
  const airQuality = normalizeAirQuality({
    latitude: location.latitude,
    longitude: location.longitude,
    timezone: location.country === 'US' ? 'America/Chicago' : 'Europe/Prague',
    utc_offset_seconds: 0,
    current: {
      time: currentTime,
      pm2_5: maybeValue(missingCore, 9),
      pm10: maybeValue(missingCore, 18),
      european_aqi_pm2_5: maybeValue(missingCore, 20),
      european_aqi_pm10: maybeValue(missingCore, 28),
      us_aqi_pm2_5: maybeValue(missingCore, 36),
      us_aqi_pm10: maybeValue(missingCore, 22),
      nitrogen_dioxide: 12,
      ozone: 58,
      sulphur_dioxide: 2,
      carbon_monoxide: 180,
      uv_index: maybeValue(missingCore, 6.2),
      aerosol_optical_depth: maybeValue(missingOptional, 0.18),
      dust: maybeValue(missingOptional, 8),
      pm10_wildfires: maybeValue(missingOptional, 1.5),
      grass_pollen: maybeValue(missingOptional, 24),
    },
    hourly: {
      time: hourlyTimes,
      pm2_5: maybeValues(missingCore, [9, 10, 11]),
      pm10: maybeValues(missingCore, [18, 19, 20]),
      european_aqi_pm2_5: maybeValues(missingCore, [20, 22, 24]),
      european_aqi_pm10: maybeValues(missingCore, [28, 29, 30]),
      us_aqi_pm2_5: maybeValues(missingCore, [36, 38, 40]),
      us_aqi_pm10: maybeValues(missingCore, [22, 23, 24]),
      uv_index: maybeValues(missingCore, [6.2, 6.4, 6.1]),
      aerosol_optical_depth: maybeValues(missingOptional, [0.18, 0.2, 0.19]),
      dust: maybeValues(missingOptional, [8, 9, 8.5]),
      pm10_wildfires: maybeValues(missingOptional, [1.5, 1.6, 1.4]),
      grass_pollen: maybeValues(missingOptional, [24, 25, 26]),
    },
  });
  const weather = normalizeWeather({
    latitude: location.latitude,
    longitude: location.longitude,
    timezone: location.country === 'US' ? 'America/Chicago' : 'Europe/Prague',
    utc_offset_seconds: 0,
    current: {
      time: currentTime,
      temperature_2m: maybeValue(missingCore, 21),
      apparent_temperature: maybeValue(missingCore, 23),
      relative_humidity_2m: maybeValue(missingCore, 62),
      mean_radiant_temperature: options.utciAvailable ? 30 : undefined,
      dew_point_2m: 12,
      precipitation: maybeValue(missingCore, 0),
      wind_speed_10m: maybeValue(missingCore, 4.2),
      wind_direction_10m: 170,
      wind_gusts_10m: 6.4,
      visibility: 18000,
      uv_index: maybeValue(missingCore, 6.2),
    },
    hourly: {
      time: hourlyTimes,
      temperature_2m: maybeValues(missingCore, [21, 22, 22]),
      apparent_temperature: maybeValues(missingCore, [23, 24, 24.5]),
      relative_humidity_2m: maybeValues(missingCore, [62, 60, 59]),
      mean_radiant_temperature: options.utciAvailable ? [30, 31, 32] : undefined,
      dew_point_2m: [12, 12, 11],
      precipitation: maybeValues(missingCore, [0, 0.1, 0]),
      wind_speed_10m: maybeValues(missingCore, [4.2, 4.6, 4.9]),
      wind_direction_10m: [170, 175, 180],
      wind_gusts_10m: [6.4, 7.1, 7.2],
      visibility: [18000, 17500, 17000],
      uv_index: maybeValues(missingCore, [6.2, 6.4, 6.1]),
    },
    daily: {
      time: ['2026-08-28'],
      leaf_wetness_probability_mean: [20],
      temperature_2m_mean: [21],
      relative_humidity_2m_mean: [62],
      precipitation_sum: [0.1],
      wind_speed_10m_mean: [4.5],
    },
  });

  return assembleEnvironment({
    coordinates,
    placeName: location.name,
    airQuality: { ...airQuality, partial: options.partial === true || airQuality.partial },
    weather: { ...weather, partial: options.partial === true || weather.partial },
  });
}

export function whoRespiratoryFixture(rows: Record<string, unknown>[]) {
  return {
    '@odata.context': 'https://xmart-api-public.who.int/FLUMART/$metadata#VIW_FNT',
    value: rows,
  };
}

export function whoRowsForCountry(countryCode: string) {
  return [
    {
      COUNTRY_CODE: countryCode,
      COUNTRY_AREA_TERRITORY: countryCode,
      ISO_WEEKSTARTDATE: '2026-08-03',
      ISO_YEAR: 2026,
      ISO_WEEK: 32,
      SPEC_PROCESSED_NB: 100,
      INF_ALL: 10,
      RSV_PROCESSED: 90,
      RSV: 7,
    },
    {
      COUNTRY_CODE: countryCode,
      COUNTRY_AREA_TERRITORY: countryCode,
      ISO_WEEKSTARTDATE: '2026-08-10',
      ISO_YEAR: 2026,
      ISO_WEEK: 33,
      SPEC_PROCESSED_NB: 100,
      INF_ALL: 15,
      RSV_PROCESSED: 90,
      RSV: 6,
    },
  ];
}

export function biologicalSignalsForLocation(
  location: GlobalTestLocation,
  options: { noObservation?: boolean | undefined; stale?: boolean | undefined } = {},
) {
  const geography = resolveHealthGeography({ location: locationInfoFromGlobalLocation(location) });
  if (!geography) return [];
  const rows = options.noObservation
    ? []
    : whoRowsForCountry(geography.providerCodes?.who ?? location.country);
  const now = options.stale ? '2027-12-01T00:00:00Z' : COVERAGE_NOW;
  return normalizeWhoRespiratorySignals(whoRespiratoryFixture(rows), { geography, now });
}

export function outbreakSignalsForLocation(
  location: GlobalTestLocation,
  options: { irrelevant?: boolean | undefined; stale?: boolean | undefined } = {},
) {
  const geography = resolveHealthGeography({ location: locationInfoFromGlobalLocation(location) });
  if (!geography) return [];
  const now = options.stale ? '2027-12-01T00:00:00Z' : COVERAGE_NOW;
  return normalizeWhoOutbreakSignals({
    payload: {
      value: [
        {
          Id: 'coverage-don',
          DonId: '2026-DON-COVERAGE',
          PublicationDateAndTime: '2026-08-24T00:00:00Z',
          Title: options.irrelevant
            ? 'Dengue - Brazil'
            : `Public health event - ${geography.countryName ?? geography.name}`,
          ItemDefaultUrl: '/2026-DON-COVERAGE',
          Summary: options.irrelevant
            ? 'Reported outbreak event in Brazil.'
            : `Reported outbreak event in ${geography.countryName ?? geography.name}.`,
        },
      ],
    },
    geography,
    now,
  });
}

function cdcWastewaterRows(target: string, state = 'TX') {
  return [
    {
      site: 'coverage-site',
      state_territory: state,
      counties_served: 'Coverage County',
      sample_collect_date: '2026-08-11',
      pcr_target: target,
      pcr_target_avg_conc_lin: '120',
      pcr_target_units: 'copies/L',
      date_updated: '2026-08-14T00:00:00.000',
    },
    {
      site: 'coverage-site',
      state_territory: state,
      counties_served: 'Coverage County',
      sample_collect_date: '2026-08-18',
      pcr_target: target,
      pcr_target_avg_conc_lin: '180',
      pcr_target_units: 'copies/L',
      date_updated: '2026-08-21T00:00:00.000',
    },
  ];
}

function rivmWastewaterRows() {
  return [
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
  ];
}

function phacWastewaterCsv(noObservation: boolean) {
  return [
    'Location,measureid,latestTrend,pruid,t_low,t_high,latestLevel,grouping,city,province,country,Viral_Activity_Level,weekStart',
    ...(noObservation
      ? []
      : [
          'Metro Vancouver,covN2,Increasing,59,,,,City,Metro Vancouver,British Columbia,Canada,High,2026-08-16',
          'Metro Vancouver,fluA,No Change,59,,,,City,Metro Vancouver,British Columbia,Canada,Moderate,2026-08-16',
          'Metro Vancouver,rsv,Decreasing,59,,,,City,Metro Vancouver,British Columbia,Canada,Low,2026-08-16',
        ]),
  ].join('\n');
}

function sumeauWastewaterRows(noObservation: boolean) {
  return {
    results: noObservation
      ? []
      : [
          {
            date_complet: '2026-08-03',
            semaine: '2026-S32',
            national_54: 400,
          },
          {
            date_complet: '2026-08-10',
            semaine: '2026-S33',
            national_54: 565,
          },
        ],
  };
}

export function wastewaterSignalsForLocation(
  location: GlobalTestLocation,
  options: { noObservation?: boolean | undefined; stale?: boolean | undefined } = {},
) {
  const geography = resolveHealthGeography({ location: locationInfoFromGlobalLocation(location) });
  if (!geography) return [];
  const now = options.stale ? '2027-12-01T00:00:00Z' : COVERAGE_NOW;
  const rows = options.noObservation ? [] : undefined;

  if (geography.countryCode === 'NL') {
    return [
      normalizeRivmWastewaterSignal({
        payload: rows ?? rivmWastewaterRows(),
        geography,
        now,
      }),
    ];
  }

  if (geography.countryCode === 'CA') {
    return normalizePhacWastewaterSignals({
      csv: phacWastewaterCsv(options.noObservation === true),
      geography,
      locationName: location.name,
      now,
    });
  }

  if (geography.countryCode === 'FR') {
    return [
      normalizeSumeauWastewaterSignal({
        payload: sumeauWastewaterRows(options.noObservation === true),
        geography,
        now,
      }),
    ];
  }

  if (geography.countryCode !== 'US') return [];

  const datasets: readonly [WastewaterDataset, string][] = [
    [WASTEWATER_COVID_DATASET, 'sars-cov-2'],
    [WASTEWATER_INFLUENZA_DATASET, 'fluav'],
    [WASTEWATER_RSV_DATASET, 'rsv'],
  ];

  return datasets.map(([dataset, target]) =>
    normalizeCdcWastewaterSignal({
      payload: rows ?? cdcWastewaterRows(target),
      dataset,
      geography,
      now,
    }),
  );
}

export function dengueSignalForLocation(
  location: GlobalTestLocation,
  options: { noObservation?: boolean | undefined } = {},
) {
  const geography = resolveHealthGeography({ location: locationInfoFromGlobalLocation(location) });
  if (!geography) return null;

  return normalizeEcdcDengueSignal({
    csv: [
      '"CountryName","ClusterId","Nuts3Name","LAUName","Status","DateOfOnsetFirst","DateOfOnsetLast","NCases"',
      ...(options.noObservation === true
        ? []
        : [
            '"France","FR-2026-002","Bouches-du-Rhône","Marseille","Active","2026-08-02","2026-08-05","3"',
          ]),
    ].join('\n'),
    geography,
    locationName: location.name,
    now: COVERAGE_NOW,
  });
}

export function chikungunyaSignalForLocation(
  location: GlobalTestLocation,
  options: { noObservation?: boolean | undefined } = {},
) {
  const geography = resolveHealthGeography({ location: locationInfoFromGlobalLocation(location) });
  if (!geography) return null;

  return normalizeEcdcChikungunyaSignal({
    csv: [
      '"CountryName","ClusterId","Nuts3Name","LAUName","Status","DateOfOnsetFirst","DateOfOnsetLast","NCases"',
      ...(options.noObservation === true
        ? []
        : [
            '"France","2026-CHIK-33-PRIGNAC-ET-MARCAMPS","Gironde","Prignac-et-Marcamps","Active","2026-07-20","2026-08-19","19"',
          ]),
    ].join('\n'),
    geography,
    locationName: location.name,
    now: COVERAGE_NOW,
  });
}

function whoMalariaFixture(rows: Record<string, unknown>[]) {
  return {
    '@odata.context': 'https://ghoapi.azureedge.net/api/$metadata#MALARIA_EST_INCIDENCE',
    value: rows,
  };
}

export function malariaSignalForLocation(
  location: GlobalTestLocation,
  options: { noObservation?: boolean | undefined; zeroContext?: boolean | undefined } = {},
) {
  const geography = resolveHealthGeography({ location: locationInfoFromGlobalLocation(location) });
  if (!geography) return null;
  const whoCode = geography.providerCodes?.who ?? location.country;
  const rows = options.noObservation
    ? []
    : [
        {
          IndicatorCode: 'MALARIA_EST_INCIDENCE',
          SpatialDimType: 'COUNTRY',
          SpatialDim: whoCode,
          TimeDim: 2023,
          NumericValue: options.zeroContext ? 0 : 52,
          Date: '2024-12-19T00:00:00Z',
          TimeDimensionBegin: '2023-01-01T00:00:00Z',
          TimeDimensionEnd: '2023-12-31T23:59:59Z',
        },
        {
          IndicatorCode: 'MALARIA_EST_INCIDENCE',
          SpatialDimType: 'COUNTRY',
          SpatialDim: whoCode,
          TimeDim: 2024,
          NumericValue: options.zeroContext ? 0 : 74,
          Date: '2025-12-19T00:00:00Z',
          TimeDimensionBegin: '2024-01-01T00:00:00Z',
          TimeDimensionEnd: '2024-12-31T23:59:59Z',
        },
      ];

  return normalizeWhoMalariaContext({
    payload: whoMalariaFixture(rows),
    geography,
    now: COVERAGE_NOW,
  });
}

export function eurostatFixture(values: Record<string, number | null>, updated = '2026-06-17T11:00:00+0200') {
  const periods = Object.keys(values);
  return {
    label: 'Excess mortality by month',
    updated,
    value: Object.fromEntries(
      periods.flatMap((period, index) =>
        typeof values[period] === 'number' ? [[String(index), values[period]]] : [],
      ),
    ),
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

export function populationSignalForLocation(
  location: GlobalTestLocation,
  values: Record<string, number | null>,
  options: { updated?: string | undefined } = {},
) {
  const geography = resolveHealthGeography({ location: locationInfoFromGlobalLocation(location) });
  if (!geography) return null;

  return normalizeEurostatExcessMortality(eurostatFixture(values, options.updated), {
    geography,
    now: COVERAGE_NOW,
  });
}

function owidExcessMortalityCsv(
  rows: [entity: string, code: string, week: string, value: string | number][] = [
    ['Japan', 'JPN', '2026-W32', 1.2],
    ['Japan', 'JPN', '2026-W33', 3.6],
    ['Brazil', 'BRA', '2026-W32', -1.1],
    ['Brazil', 'BRA', '2026-W33', 0.2],
  ],
) {
  return [
    'entity,code,week,p_avg_all_ages',
    ...rows.map(([entity, code, week, value]) => `${entity},${code},${week},${value}`),
  ].join('\n');
}

export function globalPopulationSignalForLocation(
  location: GlobalTestLocation,
  options: { noObservation?: boolean | undefined; stale?: boolean | undefined } = {},
) {
  const geography = resolveHealthGeography({ location: locationInfoFromGlobalLocation(location) });
  if (!geography) return null;

  const csv = options.noObservation ? owidExcessMortalityCsv([]) : owidExcessMortalityCsv();
  const now = options.stale ? '2027-12-01T00:00:00Z' : COVERAGE_NOW;
  return normalizeOwidExcessMortality(csv, { geography, now });
}

export function safecastMeasurement(input: {
  id: string | number;
  value: number;
  unit?: string | undefined;
  capturedAt: string;
  distanceM?: number | undefined;
  latitude?: number | undefined;
  longitude?: number | undefined;
}) {
  return {
    id: input.id,
    value: input.value,
    unit: input.unit ?? 'µSv/h',
    captured_at: input.capturedAt,
    distance_m: input.distanceM ?? 1000,
    location: {
      latitude: input.latitude ?? 50.08,
      longitude: input.longitude ?? 14.44,
    },
    device_id: 'coverage-sensor',
    detector: 'calibrated-dose-rate',
  };
}

export function radiologicalSignalForLocation(
  location: GlobalTestLocation,
  rows: Record<string, unknown>[],
) {
  const observations = normalizeSafecastRadiationMeasurements(
    { measurements: rows },
    { originCoordinates: { latitude: location.latitude, longitude: location.longitude } },
  );

  return radiologicalSignalFromSafecast({
    coordinates: { latitude: location.latitude, longitude: location.longitude },
    observations,
    now: COVERAGE_NOW,
    locationName: location.name,
  });
}

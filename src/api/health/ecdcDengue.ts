import { z } from 'zod';
import type {
  HealthGeography,
  HealthSignal,
  HealthSignalProvider,
  HealthSignalTrend,
} from '../../models/healthSignals';
import {
  DENGUE_CLUSTER_SURVEILLANCE_FRESHNESS,
  calculateHealthSignalFreshness,
} from '../../services/healthSignalFreshness';
import { delimitedRecords } from './csv';
import {
  HealthProviderSchemaError,
  fetchHealthText,
  providerErrorSignal,
  signalProviderStatus,
} from './providerFetch';

const ECDC_DENGUE_CASE_SUMMARY_URL = 'https://dengue-weekly.ecdc.europa.eu/case_summary.csv';

const ECDC_DENGUE_PROVIDER_COUNTRY_CODES = new Set([
  'AT',
  'BE',
  'BG',
  'CY',
  'CZ',
  'DE',
  'DK',
  'EE',
  'EL',
  'ES',
  'FI',
  'FR',
  'HR',
  'HU',
  'IE',
  'IS',
  'IT',
  'LI',
  'LT',
  'LU',
  'LV',
  'MT',
  'NL',
  'NO',
  'PL',
  'PT',
  'RO',
  'SE',
  'SI',
  'SK',
]);

function ecdcCountryCode(countryCode: string | undefined): string | undefined {
  if (countryCode === 'GR') return 'EL';
  return countryCode;
}

const ecdcDengueRowSchema = z
  .object({
    CountryName: z.string(),
    ClusterId: z.string(),
    Nuts3Name: z.string().optional().nullable(),
    LAUName: z.string().optional().nullable(),
    Status: z.string(),
    DateOfOnsetFirst: z.string().optional().nullable(),
    DateOfOnsetLast: z.string().optional().nullable(),
    NCases: z.union([z.string(), z.number()]),
  })
  .passthrough();

type EcdcDengueRow = z.infer<typeof ecdcDengueRowSchema>;

function normalizedText(value: string | null | undefined): string {
  return (value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function countryName(geography: HealthGeography): string {
  if (geography.countryName?.trim()) return geography.countryName.trim();
  if (!geography.countryCode) return geography.name;

  try {
    return (
      new Intl.DisplayNames(['en'], { type: 'region' }).of(geography.countryCode) ?? geography.name
    );
  } catch {
    return geography.name;
  }
}

function numberFrom(value: string | number): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function rowsFromCsv(csv: string): EcdcDengueRow[] {
  const records = delimitedRecords(csv);
  if (!records.some((record) => 'CountryName' in record && 'ClusterId' in record)) {
    throw new HealthProviderSchemaError('Invalid ECDC dengue response');
  }

  return records.flatMap((record) => {
    const parsed = ecdcDengueRowSchema.safeParse(record);
    return parsed.success ? [parsed.data] : [];
  });
}

function onsetTime(row: EcdcDengueRow): number {
  const last = row.DateOfOnsetLast ? Date.parse(row.DateOfOnsetLast) : NaN;
  if (Number.isFinite(last)) return last;
  const first = row.DateOfOnsetFirst ? Date.parse(row.DateOfOnsetFirst) : NaN;
  return Number.isFinite(first) ? first : 0;
}

function activeRank(row: EcdcDengueRow): number {
  const normalized = normalizedText(row.Status);
  if (normalized.includes('active')) return 2;
  if (normalized.includes('closed')) return 1;
  return 0;
}

function rowMatchesLocation(row: EcdcDengueRow, locationName: string | undefined): boolean {
  const normalizedLocation = normalizedText(locationName);
  if (!normalizedLocation) return false;

  const localValues = [row.LAUName, row.Nuts3Name].map(normalizedText).filter(Boolean);
  return localValues.some((value) => value === normalizedLocation);
}

function trendFromStatus(row: EcdcDengueRow): HealthSignalTrend {
  return normalizedText(row.Status).includes('active') ? 'rising' : 'unknown';
}

function clusterGeography(row: EcdcDengueRow, base: HealthGeography): HealthGeography {
  const name = row.LAUName?.trim() || row.Nuts3Name?.trim() || row.CountryName.trim();
  return {
    level: name === row.CountryName ? 'country' : 'subregion',
    code: row.ClusterId,
    name,
    countryCode: base.countryCode,
    countryName: countryName(base),
  };
}

function unavailableSignal(input: { geography: HealthGeography; now: string }): HealthSignal {
  return {
    id: `ecdc-dengue:${input.geography.countryCode ?? input.geography.code}:unavailable`,
    domain: 'biological',
    type: 'dengue',
    geography: input.geography,
    updatedAt: input.now,
    category: 'unknown',
    trend: 'unknown',
    source: {
      provider: 'ECDC',
      dataset: 'Dengue weekly case summary',
      measure: 'Locally acquired dengue clusters',
    },
    freshness: { status: 'stale', ageMs: Number.POSITIVE_INFINITY },
    metadata: {
      unavailable: true,
      reason: 'no-ecdc-dengue-cluster',
      surveillanceBasis: 'locally acquired dengue cluster surveillance',
      matchingLimitation:
        'ECDC dengue rows are matched to the active location name when explicit cluster geometry is unavailable.',
      noPersonalRiskInference: true,
    },
  };
}

export function normalizeEcdcDengueSignal(input: {
  csv: string;
  geography: HealthGeography;
  locationName?: string | undefined;
  now: string;
}): HealthSignal {
  const targetCountry = normalizedText(countryName(input.geography));
  const rows = rowsFromCsv(input.csv).filter(
    (row) =>
      normalizedText(row.CountryName) === targetCountry &&
      rowMatchesLocation(row, input.locationName),
  );
  const selected = [...rows].sort((left, right) => {
    const rankDelta = activeRank(right) - activeRank(left);
    if (rankDelta !== 0) return rankDelta;
    return onsetTime(right) - onsetTime(left);
  })[0];

  if (!selected) return unavailableSignal({ geography: input.geography, now: input.now });

  const value = numberFrom(selected.NCases);
  const periodEnd = selected.DateOfOnsetLast
    ? `${selected.DateOfOnsetLast}T00:00:00.000Z`
    : undefined;
  const periodStart = selected.DateOfOnsetFirst
    ? `${selected.DateOfOnsetFirst}T00:00:00.000Z`
    : undefined;
  const sourceUpdatedAt = periodEnd ?? periodStart;

  return {
    id: `ecdc-dengue:${input.geography.countryCode ?? selected.CountryName}:${selected.ClusterId}`,
    domain: 'biological',
    type: 'dengue',
    geography: clusterGeography(selected, input.geography),
    periodStart,
    periodEnd,
    updatedAt: sourceUpdatedAt ?? input.now,
    value: value ?? undefined,
    unit: value === null ? undefined : 'cases',
    category: 'unknown',
    trend: trendFromStatus(selected),
    source: {
      provider: 'ECDC',
      dataset: 'Dengue weekly case summary',
      measure: 'Locally acquired dengue clusters',
    },
    freshness: calculateHealthSignalFreshness({
      updatedAt: sourceUpdatedAt ?? '',
      now: input.now,
      policy: DENGUE_CLUSTER_SURVEILLANCE_FRESHNESS,
    }),
    metadata: {
      providerCategory: selected.Status,
      clusterId: selected.ClusterId,
      nuts3Name: selected.Nuts3Name,
      lauName: selected.LAUName,
      surveillanceBasis: 'locally acquired dengue cluster surveillance',
      matchingLimitation:
        'ECDC dengue rows are matched to the active location name when explicit cluster geometry is unavailable.',
      noPersonalRiskInference: true,
    },
  };
}

export const ecdcDengueProvider: HealthSignalProvider = {
  id: 'ecdc-dengue',
  access: 'anonymous',
  coverage: 'regional',
  documentationUrl: 'https://dengue-weekly.ecdc.europa.eu/',
  supports: (context) =>
    Boolean(
      context.geography?.countryCode &&
      ECDC_DENGUE_PROVIDER_COUNTRY_CODES.has(ecdcCountryCode(context.geography.countryCode) ?? ''),
    ),
  fetchSignals: async (context) => {
    if (!context.geography) {
      return { providerId: 'ecdc-dengue', fetchedAt: context.now, signals: [] };
    }

    if (context.signalTypes !== undefined && !context.signalTypes.includes('dengue')) {
      return { providerId: 'ecdc-dengue', fetchedAt: context.now, signals: [] };
    }

    let signal: HealthSignal;
    try {
      signal = normalizeEcdcDengueSignal({
        csv: await fetchHealthText(ECDC_DENGUE_CASE_SUMMARY_URL),
        geography: context.geography,
        locationName: context.locationName,
        now: context.now,
      });
    } catch (error) {
      signal = providerErrorSignal({
        id: `ecdc-dengue:${context.geography.countryCode ?? context.geography.code}:provider-error`,
        domain: 'biological',
        type: 'dengue',
        geography: context.geography,
        now: context.now,
        source: {
          provider: 'ECDC',
          dataset: 'Dengue weekly case summary',
          measure: 'Locally acquired dengue clusters',
        },
        reason: 'ecdc-dengue-provider-error',
        error,
      });
    }

    return {
      providerId: 'ecdc-dengue',
      fetchedAt: context.now,
      signals: [signal],
      unavailableSignals: signal.metadata?.unavailable === true ? ['dengue'] : [],
      signalStatuses: [signalProviderStatus(signal)],
    };
  },
};

export const ECDC_DENGUE_SIGNAL_TYPES = ['dengue'] as const;

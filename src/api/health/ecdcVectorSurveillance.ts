import { z } from 'zod';
import type {
  HealthGeography,
  HealthSignal,
  HealthSignalProvider,
  HealthSignalTrend,
  HealthSignalType,
} from '../../models/healthSignals';
import {
  DENGUE_CLUSTER_SURVEILLANCE_FRESHNESS,
  calculateHealthSignalFreshness,
} from '../../services/healthSignalFreshness';
import { geographyInProviderRegion } from '../../services/providerRegions';
import { delimitedRecords } from './csv';
import {
  HealthProviderSchemaError,
  fetchHealthText,
  providerErrorSignal,
  signalProviderStatus,
} from './providerFetch';

type EcdcVectorSignalType = Extract<HealthSignalType, 'dengue' | 'chikungunya'>;

interface EcdcVectorConfig {
  providerId: string;
  signalType: EcdcVectorSignalType;
  url: string;
  dataset: string;
  measure: string;
  documentationUrl: string;
  unavailableReason: string;
  providerErrorReason: string;
  surveillanceBasis: string;
}

const ECDC_DENGUE_CONFIG: EcdcVectorConfig = {
  providerId: 'ecdc-dengue',
  signalType: 'dengue',
  url: 'https://dengue-weekly.ecdc.europa.eu/case_summary.csv',
  dataset: 'Dengue weekly case summary',
  measure: 'Locally acquired dengue clusters',
  documentationUrl: 'https://dengue-weekly.ecdc.europa.eu/',
  unavailableReason: 'no-ecdc-dengue-cluster',
  providerErrorReason: 'ecdc-dengue-provider-error',
  surveillanceBasis: 'locally acquired dengue cluster surveillance',
};

const ECDC_CHIKUNGUNYA_CONFIG: EcdcVectorConfig = {
  providerId: 'ecdc-chikungunya',
  signalType: 'chikungunya',
  url: 'https://chik-weekly.ecdc.europa.eu/case_summary.csv',
  dataset: 'Chikungunya weekly case summary',
  measure: 'Locally acquired chikungunya clusters',
  documentationUrl: 'https://chik-weekly.ecdc.europa.eu/',
  unavailableReason: 'no-ecdc-chikungunya-cluster',
  providerErrorReason: 'ecdc-chikungunya-provider-error',
  surveillanceBasis: 'locally acquired chikungunya cluster surveillance',
};

const ecdcVectorRowSchema = z
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

type EcdcVectorRow = z.infer<typeof ecdcVectorRowSchema>;

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

function rowsFromCsv(csv: string, dataset: string): EcdcVectorRow[] {
  const records = delimitedRecords(csv);
  const headerColumns = new Set(
    csv
      .split(/\r?\n/, 1)[0]
      ?.split(',')
      .map((value) => value.replaceAll('"', '').trim()) ?? [],
  );
  const hasExpectedHeader = headerColumns.has('CountryName') && headerColumns.has('ClusterId');
  if (
    !records.some((record) => 'CountryName' in record && 'ClusterId' in record) &&
    !hasExpectedHeader
  ) {
    throw new HealthProviderSchemaError(`Invalid ECDC ${dataset} response`);
  }

  return records.flatMap((record) => {
    const parsed = ecdcVectorRowSchema.safeParse(record);
    return parsed.success ? [parsed.data] : [];
  });
}

function onsetTime(row: EcdcVectorRow): number {
  const last = row.DateOfOnsetLast ? Date.parse(row.DateOfOnsetLast) : NaN;
  if (Number.isFinite(last)) return last;
  const first = row.DateOfOnsetFirst ? Date.parse(row.DateOfOnsetFirst) : NaN;
  return Number.isFinite(first) ? first : 0;
}

function activeRank(row: EcdcVectorRow): number {
  const normalized = normalizedText(row.Status);
  if (normalized.includes('active')) return 2;
  if (normalized.includes('closed')) return 1;
  return 0;
}

function rowMatchesLocation(row: EcdcVectorRow, locationName: string | undefined): boolean {
  const normalizedLocation = normalizedText(locationName);
  if (!normalizedLocation) return false;

  const localValues = [row.LAUName, row.Nuts3Name].map(normalizedText).filter(Boolean);
  return localValues.some((value) => value === normalizedLocation);
}

function trendFromStatus(row: EcdcVectorRow): HealthSignalTrend {
  return normalizedText(row.Status).includes('active') ? 'rising' : 'unknown';
}

function clusterGeography(row: EcdcVectorRow, base: HealthGeography): HealthGeography {
  const name = row.LAUName?.trim() || row.Nuts3Name?.trim() || row.CountryName.trim();
  return {
    level: name === row.CountryName ? 'country' : 'subregion',
    code: row.ClusterId,
    name,
    countryCode: base.countryCode,
    countryName: countryName(base),
  };
}

function unavailableSignal(input: {
  config: EcdcVectorConfig;
  geography: HealthGeography;
  now: string;
}): HealthSignal {
  return {
    id: `${input.config.providerId}:${input.geography.countryCode ?? input.geography.code}:unavailable`,
    domain: 'biological',
    type: input.config.signalType,
    geography: input.geography,
    updatedAt: input.now,
    category: 'unknown',
    trend: 'unknown',
    source: {
      provider: 'ECDC',
      dataset: input.config.dataset,
      measure: input.config.measure,
    },
    freshness: { status: 'stale', ageMs: Number.POSITIVE_INFINITY },
    temporalClass: 'current',
    metadata: {
      unavailable: true,
      reason: input.config.unavailableReason,
      surveillanceBasis: input.config.surveillanceBasis,
      matchingLimitation:
        'ECDC vector rows are matched to the active location name when explicit cluster geometry is unavailable.',
      noPersonalRiskInference: true,
    },
  };
}

function normalizeEcdcVectorSignal(input: {
  csv: string;
  geography: HealthGeography;
  locationName?: string | undefined;
  now: string;
  config: EcdcVectorConfig;
}): HealthSignal {
  const targetCountry = normalizedText(countryName(input.geography));
  const rows = rowsFromCsv(input.csv, input.config.dataset).filter(
    (row) =>
      normalizedText(row.CountryName) === targetCountry &&
      rowMatchesLocation(row, input.locationName),
  );
  const selected = [...rows].sort((left, right) => {
    const rankDelta = activeRank(right) - activeRank(left);
    if (rankDelta !== 0) return rankDelta;
    return onsetTime(right) - onsetTime(left);
  })[0];

  if (!selected) {
    return unavailableSignal({
      config: input.config,
      geography: input.geography,
      now: input.now,
    });
  }

  const value = numberFrom(selected.NCases);
  const periodEnd = selected.DateOfOnsetLast
    ? `${selected.DateOfOnsetLast}T00:00:00.000Z`
    : undefined;
  const periodStart = selected.DateOfOnsetFirst
    ? `${selected.DateOfOnsetFirst}T00:00:00.000Z`
    : undefined;
  const sourceUpdatedAt = periodEnd ?? periodStart;

  return {
    id: `${input.config.providerId}:${input.geography.countryCode ?? selected.CountryName}:${selected.ClusterId}`,
    domain: 'biological',
    type: input.config.signalType,
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
      dataset: input.config.dataset,
      measure: input.config.measure,
    },
    freshness: calculateHealthSignalFreshness({
      updatedAt: sourceUpdatedAt ?? '',
      now: input.now,
      policy: DENGUE_CLUSTER_SURVEILLANCE_FRESHNESS,
    }),
    temporalClass: 'current',
    metadata: {
      providerCategory: selected.Status,
      clusterId: selected.ClusterId,
      nuts3Name: selected.Nuts3Name,
      lauName: selected.LAUName,
      surveillanceBasis: input.config.surveillanceBasis,
      matchingLimitation:
        'ECDC vector rows are matched to the active location name when explicit cluster geometry is unavailable.',
      noPersonalRiskInference: true,
    },
  };
}

function createEcdcVectorProvider(config: EcdcVectorConfig): HealthSignalProvider {
  return {
    id: config.providerId,
    access: 'anonymous',
    coverage: 'regional',
    authority: 'regional-authority',
    regions: ['europe'],
    signals: [config.signalType],
    temporalClasses: ['current'],
    documentationUrl: config.documentationUrl,
    supports: (context) =>
      geographyInProviderRegion(context.geography, 'europe') &&
      (context.signalTypes === undefined || context.signalTypes.includes(config.signalType)),
    fetchSignals: async (context) => {
      if (!context.geography) {
        return { providerId: config.providerId, fetchedAt: context.now, signals: [] };
      }

      let signal: HealthSignal;
      try {
        signal = normalizeEcdcVectorSignal({
          csv: await fetchHealthText(config.url),
          geography: context.geography,
          locationName: context.locationName,
          now: context.now,
          config,
        });
      } catch (error) {
        signal = providerErrorSignal({
          id: `${config.providerId}:${context.geography.countryCode ?? context.geography.code}:provider-error`,
          domain: 'biological',
          type: config.signalType,
          geography: context.geography,
          now: context.now,
          source: {
            provider: 'ECDC',
            dataset: config.dataset,
            measure: config.measure,
          },
          reason: config.providerErrorReason,
          error,
        });
      }

      return {
        providerId: config.providerId,
        fetchedAt: context.now,
        signals: [signal],
        unavailableSignals: signal.metadata?.unavailable === true ? [config.signalType] : [],
        signalStatuses: [signalProviderStatus(signal)],
      };
    },
  };
}

export function ecdcDengueUrl(): string {
  return ECDC_DENGUE_CONFIG.url;
}

export function ecdcChikungunyaUrl(): string {
  return ECDC_CHIKUNGUNYA_CONFIG.url;
}

export function normalizeEcdcDengueSignal(input: {
  csv: string;
  geography: HealthGeography;
  locationName?: string | undefined;
  now: string;
}): HealthSignal {
  return normalizeEcdcVectorSignal({ ...input, config: ECDC_DENGUE_CONFIG });
}

export function normalizeEcdcChikungunyaSignal(input: {
  csv: string;
  geography: HealthGeography;
  locationName?: string | undefined;
  now: string;
}): HealthSignal {
  return normalizeEcdcVectorSignal({ ...input, config: ECDC_CHIKUNGUNYA_CONFIG });
}

export const ecdcDengueProvider = createEcdcVectorProvider(ECDC_DENGUE_CONFIG);
export const ecdcChikungunyaProvider = createEcdcVectorProvider(ECDC_CHIKUNGUNYA_CONFIG);

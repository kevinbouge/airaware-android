import { z } from 'zod';
import type {
  HealthGeography,
  HealthSignal,
  HealthSignalProvider,
  HealthSignalProviderContext,
  WastewaterSignalType,
} from '../../models/healthSignals';
import {
  HealthProviderSchemaError,
  fetchHealthJson,
  providerErrorSignal,
  signalProviderStatus,
} from './providerFetch';

export interface WastewaterDataset {
  signalType: WastewaterSignalType;
  datasetId: string;
  target: string;
  label: string;
}

const CDC_WASTEWATER_DATASETS: WastewaterDataset[] = [
  {
    signalType: 'wastewater-covid-19',
    datasetId: 'j9g8-acpt',
    target: 'sars-cov-2',
    label: 'SARS-CoV-2 wastewater concentration',
  },
  {
    signalType: 'wastewater-influenza',
    datasetId: 'ymmh-divb',
    target: 'fluav',
    label: 'Influenza A wastewater concentration',
  },
  {
    signalType: 'wastewater-rsv',
    datasetId: '45cq-cw4i',
    target: 'rsv',
    label: 'RSV wastewater concentration',
  },
];

const CDC_WASTEWATER_HISTORY_LIMIT = 120;

const cdcWastewaterRowSchema = z
  .object({
    site: z.string().optional().nullable(),
    state_territory: z.string().optional().nullable(),
    counties_served: z.string().optional().nullable(),
    sample_collect_date: z.string(),
    pcr_target: z.string(),
    pcr_target_avg_conc: z.union([z.string(), z.number()]).optional().nullable(),
    pcr_target_avg_conc_lin: z.union([z.string(), z.number()]).optional().nullable(),
    pcr_target_units: z.string().optional().nullable(),
    date_updated: z.string().optional().nullable(),
    source: z.string().optional().nullable(),
  })
  .passthrough();

function numberFrom(value: string | number | null | undefined): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value !== 'string' || !value.trim()) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function wastewaterGeography(base: HealthGeography) {
  return {
    level: 'country' as const,
    code: 'US',
    name: base.countryName ?? base.name,
    countryCode: 'US',
    countryName: base.countryName ?? base.name,
  };
}

function compatibleRows(
  payload: unknown,
  target: string,
): z.infer<typeof cdcWastewaterRowSchema>[] {
  if (!Array.isArray(payload)) {
    throw new HealthProviderSchemaError('Invalid CDC wastewater response');
  }

  return payload
    .flatMap((row) => {
      const parsed = cdcWastewaterRowSchema.safeParse(row);
      return parsed.success ? [parsed.data] : [];
    })
    .filter((row) => row.pcr_target.toLowerCase() === target)
    .filter((row) => {
      const value = numberFrom(row.pcr_target_avg_conc_lin ?? row.pcr_target_avg_conc);
      const time = Date.parse(`${row.sample_collect_date}T00:00:00Z`);
      return value !== null && value >= 0 && Number.isFinite(time) && Boolean(row.pcr_target_units);
    });
}

function unavailableSignal(input: {
  dataset: WastewaterDataset;
  geography: HealthGeography;
  now: string;
  sourceRows?: number | undefined;
}): HealthSignal {
  return {
    id: `cdc-nwss:${input.dataset.signalType}:US:unavailable`,
    domain: 'biological',
    type: input.dataset.signalType,
    geography: {
      level: 'country',
      code: 'US',
      name: input.geography.countryName ?? input.geography.name,
      countryCode: 'US',
      countryName: input.geography.countryName ?? input.geography.name,
    },
    updatedAt: input.now,
    category: 'unknown',
    trend: 'unknown',
    source: {
      provider: 'CDC NWSS',
      dataset: input.dataset.datasetId,
      measure: input.dataset.label,
    },
    freshness: { status: 'stale', ageMs: Number.POSITIVE_INFINITY },
    metadata: {
      unavailable: true,
      reason: 'cdc-wastewater-aggregation-unavailable',
      surveillanceBasis: 'wastewater surveillance',
      noClinicalPrevalenceInference: true,
      sourceRows: input.sourceRows ?? 0,
      scopeLimitation:
        'The public CDC site/sample dataset is not displayed as a national, state, or sewershed signal until a documented stable aggregation is integrated.',
    },
  };
}

export function cdcWastewaterUrl(dataset: WastewaterDataset): string {
  const url = new URL(`https://data.cdc.gov/resource/${dataset.datasetId}.json`);
  url.searchParams.set(
    '$select',
    [
      'site',
      'state_territory',
      'counties_served',
      'sample_collect_date',
      'pcr_target',
      'pcr_target_avg_conc',
      'pcr_target_avg_conc_lin',
      'pcr_target_units',
      'date_updated',
      'source',
    ].join(','),
  );
  url.searchParams.set('$where', `pcr_target='${dataset.target}'`);
  url.searchParams.set('$order', 'sample_collect_date DESC');
  url.searchParams.set('$limit', CDC_WASTEWATER_HISTORY_LIMIT.toString());
  return url.toString();
}

export function normalizeCdcWastewaterSignal(input: {
  payload: unknown;
  dataset: WastewaterDataset;
  geography: HealthGeography;
  now: string;
}): HealthSignal {
  const rows = compatibleRows(input.payload, input.dataset.target);

  return unavailableSignal({
    dataset: input.dataset,
    geography: input.geography,
    now: input.now,
    sourceRows: rows.length,
  });
}

export const cdcWastewaterProvider: HealthSignalProvider = {
  id: 'cdc-wastewater',
  supports: (context: HealthSignalProviderContext) => context.geography?.countryCode === 'US',
  fetchSignals: async (context) => {
    if (!context.geography) {
      return { providerId: 'cdc-wastewater', fetchedAt: context.now, signals: [] };
    }

    const selectedDatasets = CDC_WASTEWATER_DATASETS.filter(
      (dataset) =>
        context.signalTypes === undefined || context.signalTypes.includes(dataset.signalType),
    );
    const signals = await Promise.all(
      selectedDatasets.map(async (dataset) => {
        try {
          return normalizeCdcWastewaterSignal({
            payload: await fetchHealthJson(cdcWastewaterUrl(dataset)),
            dataset,
            geography: context.geography as HealthGeography,
            now: context.now,
          });
        } catch (error) {
          return providerErrorSignal({
            id: `cdc-nwss:${dataset.signalType}:US:provider-error`,
            domain: 'biological',
            type: dataset.signalType,
            geography: wastewaterGeography(context.geography as HealthGeography),
            now: context.now,
            source: {
              provider: 'CDC NWSS',
              dataset: dataset.datasetId,
              measure: dataset.label,
            },
            reason: 'cdc-wastewater-provider-error',
            error,
          });
        }
      }),
    );

    return {
      providerId: 'cdc-wastewater',
      fetchedAt: context.now,
      signals,
      unavailableSignals: signals
        .filter((signal) => signal.metadata?.unavailable === true)
        .map((signal) => signal.type),
      signalStatuses: signals.map(signalProviderStatus),
    };
  },
};

export const CDC_WASTEWATER_SIGNAL_TYPES = CDC_WASTEWATER_DATASETS.map(
  (dataset) => dataset.signalType,
);

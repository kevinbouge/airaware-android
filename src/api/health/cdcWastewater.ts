import { z } from 'zod';
import type {
  HealthGeography,
  HealthSignal,
  HealthSignalObservation,
  HealthSignalProvider,
  HealthSignalProviderContext,
  WastewaterSignalType,
} from '../../models/healthSignals';
import {
  WASTEWATER_SURVEILLANCE_FRESHNESS,
  calculateComparableTrend,
  calculateHealthSignalFreshness,
} from '../../services/healthSignalFreshness';
import { isFiniteNumber } from '../../utils/number';

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

function median(values: number[]): number | null {
  const sorted = values.filter(isFiniteNumber).sort((left, right) => left - right);
  if (sorted.length === 0) return null;
  const middle = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[middle] ?? null;
  const left = sorted[middle - 1];
  const right = sorted[middle];
  return left === undefined || right === undefined ? null : (left + right) / 2;
}

function stateName(abbreviation: string | null | undefined): string | null {
  if (!abbreviation) return null;
  const region = abbreviation.toUpperCase();
  try {
    const displayNames = new Intl.DisplayNames(['en'], { type: 'region' });
    return displayNames.of(`US-${region}`) ?? region;
  } catch {
    return region;
  }
}

function wastewaterGeography(
  base: HealthGeography,
  rows: z.infer<typeof cdcWastewaterRowSchema>[],
) {
  const states = Array.from(
    new Set(
      rows.flatMap((row) => (row.state_territory ? [row.state_territory.toUpperCase()] : [])),
    ),
  );

  if (states.length === 1) {
    const state = states[0] as string;
    return {
      level: 'region' as const,
      code: `US-${state}`,
      name: stateName(state) ?? state,
      countryCode: 'US',
      countryName: base.countryName ?? 'United States',
    };
  }

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
  if (!Array.isArray(payload)) return [];

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

function groupedByDate(rows: z.infer<typeof cdcWastewaterRowSchema>[]) {
  const groups = new Map<string, z.infer<typeof cdcWastewaterRowSchema>[]>();
  rows.forEach((row) => {
    groups.set(row.sample_collect_date, [...(groups.get(row.sample_collect_date) ?? []), row]);
  });
  return Array.from(groups.entries()).sort(
    (left, right) => Date.parse(left[0]) - Date.parse(right[0]),
  );
}

function preferredUnitRows(rows: z.infer<typeof cdcWastewaterRowSchema>[]) {
  const unitCounts = new Map<string, number>();
  rows.forEach((row) => {
    const unit = row.pcr_target_units?.trim();
    if (unit) unitCounts.set(unit, (unitCounts.get(unit) ?? 0) + 1);
  });
  const unit = Array.from(unitCounts.entries()).sort((left, right) => right[1] - left[1])[0]?.[0];
  return unit ? rows.filter((row) => row.pcr_target_units === unit) : [];
}

function observationsFromRows(
  rows: z.infer<typeof cdcWastewaterRowSchema>[],
  dataset: WastewaterDataset,
): HealthSignalObservation[] {
  return groupedByDate(rows).flatMap(([date, dateRows]) => {
    const unitRows = preferredUnitRows(dateRows);
    const value = median(
      unitRows.flatMap((row) => {
        const number = numberFrom(row.pcr_target_avg_conc_lin ?? row.pcr_target_avg_conc);
        return number === null ? [] : [number];
      }),
    );
    const unit = unitRows[0]?.pcr_target_units?.trim();
    if (value === null || !unit) return [];

    return [
      {
        observedAt: `${date}T00:00:00.000Z`,
        updatedAt: unitRows[0]?.date_updated ?? `${date}T00:00:00.000Z`,
        measure: dataset.label,
        value,
        unit,
        source: {
          provider: 'CDC NWSS',
          dataset: dataset.datasetId,
          measure: dataset.target,
        },
        status: 'wastewater-concentration',
      },
    ];
  });
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
  const history = observationsFromRows(rows, input.dataset).slice(-12);
  const current = history.at(-1);
  if (!current) {
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
        reason: 'no-wastewater-observation',
      },
    };
  }

  const previous = history.at(-2);
  const geography = wastewaterGeography(input.geography, rows);

  return {
    id: `cdc-nwss:${input.dataset.signalType}:${geography.code ?? 'US'}`,
    domain: 'biological',
    type: input.dataset.signalType,
    geography,
    observedAt: current.observedAt,
    updatedAt: current.updatedAt ?? current.observedAt ?? input.now,
    value: current.value,
    unit: current.unit,
    category: 'unknown',
    trend: calculateComparableTrend({
      current: current.value,
      previous: previous?.value,
      minimumAbsoluteChange: Math.max(1, current.value * 0.2),
    }),
    source: {
      provider: 'CDC NWSS',
      dataset: input.dataset.datasetId,
      measure: input.dataset.label,
    },
    freshness: calculateHealthSignalFreshness({
      updatedAt: current.observedAt ?? current.updatedAt ?? input.now,
      now: input.now,
      policy: WASTEWATER_SURVEILLANCE_FRESHNESS,
    }),
    history,
    metadata: {
      surveillanceBasis: 'wastewater concentration',
      noClinicalPrevalenceInference: true,
      sourceRows: rows.length,
    },
  };
}

export const cdcWastewaterProvider: HealthSignalProvider = {
  id: 'cdc-wastewater',
  supports: (context: HealthSignalProviderContext) => context.geography?.countryCode === 'US',
  fetchSignals: async (context) => {
    if (!context.geography) {
      return { providerId: 'cdc-wastewater', fetchedAt: context.now, signals: [] };
    }

    const responses = await Promise.all(
      CDC_WASTEWATER_DATASETS.map(async (dataset) => {
        const response = await fetch(cdcWastewaterUrl(dataset), {
          headers: { Accept: 'application/json' },
        });
        if (!response.ok) throw new Error(`CDC wastewater request failed: ${response.status}`);
        return {
          dataset,
          payload: await response.json(),
        };
      }),
    );

    return {
      providerId: 'cdc-wastewater',
      fetchedAt: context.now,
      signals: responses.map(({ dataset, payload }) =>
        normalizeCdcWastewaterSignal({
          payload,
          dataset,
          geography: context.geography as HealthGeography,
          now: context.now,
        }),
      ),
    };
  },
};

export const CDC_WASTEWATER_SIGNAL_TYPES = CDC_WASTEWATER_DATASETS.map(
  (dataset) => dataset.signalType,
);

import { z } from 'zod';
import type {
  HealthGeography,
  HealthSignal,
  HealthSignalObservation,
  HealthSignalProvider,
  HealthSignalProviderContext,
} from '../../models/healthSignals';
import {
  VECTOR_SURVEILLANCE_FRESHNESS,
  calculateComparableTrend,
  calculateHealthSignalFreshness,
} from '../../services/healthSignalFreshness';
import { isFiniteNumber } from '../../utils/number';

const WHO_MALARIA_ENDPOINT = 'https://ghoapi.azureedge.net/api/MALARIA_EST_INCIDENCE';
const WHO_MALARIA_HISTORY_ROWS = 12;

const whoGhoResponseSchema = z
  .object({
    value: z.array(z.record(z.string(), z.unknown())),
  })
  .passthrough();

const whoMalariaRowSchema = z
  .object({
    IndicatorCode: z.string(),
    SpatialDimType: z.string(),
    SpatialDim: z.string(),
    TimeDim: z.number(),
    NumericValue: z.number().optional().nullable(),
    Date: z.string().optional().nullable(),
    TimeDimensionBegin: z.string().optional().nullable(),
    TimeDimensionEnd: z.string().optional().nullable(),
  })
  .passthrough();

export function whoMalariaUrl(geography: HealthGeography): string {
  const countryCode = geography.providerCodes?.who;
  const url = new URL(WHO_MALARIA_ENDPOINT);
  if (!countryCode) return url.toString();

  url.searchParams.set('$filter', `SpatialDim eq '${countryCode}' and SpatialDimType eq 'COUNTRY'`);
  url.searchParams.set('$orderby', 'TimeDim desc');
  url.searchParams.set('$top', WHO_MALARIA_HISTORY_ROWS.toString());
  return url.toString();
}

function sortedMalariaRows(payload: unknown): z.infer<typeof whoMalariaRowSchema>[] {
  const parsed = whoGhoResponseSchema.safeParse(payload);
  if (!parsed.success) return [];

  return parsed.data.value
    .flatMap((row) => {
      const parsedRow = whoMalariaRowSchema.safeParse(row);
      return parsedRow.success ? [parsedRow.data] : [];
    })
    .filter(
      (row) =>
        row.IndicatorCode === 'MALARIA_EST_INCIDENCE' &&
        row.SpatialDimType === 'COUNTRY' &&
        isFiniteNumber(row.NumericValue),
    )
    .sort((left, right) => left.TimeDim - right.TimeDim);
}

function malariaObservation(row: z.infer<typeof whoMalariaRowSchema>): HealthSignalObservation {
  return {
    period: { type: 'year', year: row.TimeDim },
    periodStart: row.TimeDimensionBegin ?? `${row.TimeDim}-01-01T00:00:00Z`,
    periodEnd: row.TimeDimensionEnd ?? `${row.TimeDim}-12-31T23:59:59Z`,
    updatedAt: row.Date ?? row.TimeDimensionEnd ?? `${row.TimeDim}-12-31T23:59:59Z`,
    measure: 'Estimated malaria incidence',
    value: row.NumericValue as number,
    unit: 'cases per 1k at risk',
    source: {
      provider: 'WHO Global Health Observatory',
      dataset: 'MALARIA_EST_INCIDENCE',
      measure: 'Estimated malaria incidence per 1,000 population at risk',
    },
    status: 'annual-context',
  };
}

function noMalariaContextSignal(input: { geography: HealthGeography; now: string }): HealthSignal {
  return {
    id: `who-gho:malaria:${input.geography.providerCodes?.who ?? input.geography.code}:unavailable`,
    domain: 'biological',
    type: 'malaria',
    geography: input.geography,
    updatedAt: input.now,
    category: 'unknown',
    trend: 'unknown',
    source: {
      provider: 'WHO Global Health Observatory',
      dataset: 'MALARIA_EST_INCIDENCE',
      measure: 'Estimated malaria incidence per 1,000 population at risk',
    },
    freshness: { status: 'stale', ageMs: Number.POSITIVE_INFINITY },
    metadata: {
      unavailable: true,
      reason: 'no-malaria-context-observation',
      surveillanceBasis: 'annual incidence context',
    },
  };
}

export function normalizeWhoMalariaContext(input: {
  payload: unknown;
  geography: HealthGeography;
  now: string;
}): HealthSignal | null {
  const history = sortedMalariaRows(input.payload).map(malariaObservation).slice(-12);
  const current = history.at(-1);
  if (!current) return noMalariaContextSignal(input);

  if (current.value === 0) {
    return null;
  }

  const previous = history.at(-2);

  return {
    id: `who-gho:malaria:${input.geography.providerCodes?.who ?? input.geography.code}`,
    domain: 'biological',
    type: 'malaria',
    geography: input.geography,
    periodStart: current.periodStart,
    periodEnd: current.periodEnd,
    reportingPeriod: current.period,
    updatedAt: current.updatedAt ?? input.now,
    value: current.value,
    unit: current.unit,
    category: 'unknown',
    trend: calculateComparableTrend({
      current: current.value,
      previous: previous?.value,
      minimumAbsoluteChange: 1,
    }),
    source: {
      provider: 'WHO Global Health Observatory',
      dataset: 'MALARIA_EST_INCIDENCE',
      measure: 'Estimated malaria incidence per 1,000 population at risk',
    },
    freshness: calculateHealthSignalFreshness({
      updatedAt: current.periodEnd ?? current.updatedAt ?? input.now,
      now: input.now,
      policy: VECTOR_SURVEILLANCE_FRESHNESS,
    }),
    history,
    metadata: {
      surveillanceBasis: 'annual incidence context',
      notCurrentActivity: true,
      noPersonalRiskInference: true,
    },
  };
}

export const whoVectorDiseaseProvider: HealthSignalProvider = {
  id: 'who-vector-disease',
  supports: (context: HealthSignalProviderContext) =>
    Boolean(context.geography?.providerCodes?.who),
  fetchSignals: async (context) => {
    if (!context.geography) {
      return { providerId: 'who-vector-disease', fetchedAt: context.now, signals: [] };
    }

    const response = await fetch(whoMalariaUrl(context.geography), {
      headers: { Accept: 'application/json' },
    });
    if (!response.ok) throw new Error(`WHO malaria request failed: ${response.status}`);
    const malaria = normalizeWhoMalariaContext({
      payload: await response.json(),
      geography: context.geography,
      now: context.now,
    });

    return {
      providerId: 'who-vector-disease',
      fetchedAt: context.now,
      signals: malaria ? [malaria] : [],
      unavailableSignals: malaria ? undefined : ['malaria'],
    };
  },
};

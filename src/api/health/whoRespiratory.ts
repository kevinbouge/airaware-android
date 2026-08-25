import { z } from 'zod';
import type {
  BiologicalEvidence,
  BiologicalSignalType,
  HealthGeography,
  HealthSignal,
  HealthSignalObservation,
  HealthSignalProvider,
  HealthSignalProviderContext,
  HealthSignalType,
  ReportingPeriod,
} from '../../models/healthSignals';
import {
  RESPIRATORY_SURVEILLANCE_FRESHNESS,
  calculateComparableTrend,
  calculateHealthSignalFreshness,
} from '../../services/healthSignalFreshness';

const WHO_FLUNET_ENDPOINT = 'https://xmart-api-public.who.int/FLUMART/VIW_FNT';
const WHO_FLUNET_HISTORY_ROWS = 160;

export const RESPIRATORY_SIGNAL_TYPES: BiologicalSignalType[] = ['influenza', 'covid-19', 'rsv'];

const whoFluNetResponseSchema = z
  .object({
    value: z.array(z.record(z.string(), z.unknown())),
  })
  .passthrough();

const whoFluNetRowSchema = z
  .object({
    COUNTRY_CODE: z.string(),
    COUNTRY_AREA_TERRITORY: z.string().optional().nullable(),
    ISO_WEEKSTARTDATE: z.string(),
    ISO_YEAR: z.number(),
    ISO_WEEK: z.number(),
    ORIGIN_SOURCE: z.string().optional().nullable(),
    SPEC_PROCESSED_NB: z.number().optional().nullable(),
    INF_ALL: z.number().optional().nullable(),
    INF_A: z.number().optional().nullable(),
    INF_B: z.number().optional().nullable(),
    RSV_PROCESSED: z.number().optional().nullable(),
    RSV: z.number().optional().nullable(),
  })
  .passthrough();

interface PathogenMeasureDefinition {
  pathogen: BiologicalSignalType;
  denominatorFields: string[];
  numeratorFields: string[];
  componentNumeratorFields?: string[] | undefined;
  measure: string;
  sourceMeasureCode: string;
}

const PATHOGEN_MEASURES: PathogenMeasureDefinition[] = [
  {
    pathogen: 'influenza',
    denominatorFields: ['SPEC_PROCESSED_NB'],
    numeratorFields: ['INF_ALL'],
    componentNumeratorFields: ['INF_A', 'INF_B'],
    measure: 'Influenza virological test positivity',
    sourceMeasureCode: 'INF_ALL / SPEC_PROCESSED_NB',
  },
  {
    pathogen: 'covid-19',
    denominatorFields: [
      'SARSCOV2_PROCESSED',
      'SARS_COV_2_PROCESSED',
      'SARS_COV2_PROCESSED',
      'COVID19_PROCESSED',
      'COVID_19_PROCESSED',
    ],
    numeratorFields: ['SARSCOV2', 'SARS_COV_2', 'SARS_COV2', 'COVID19', 'COVID_19'],
    measure: 'SARS-CoV-2 virological test positivity',
    sourceMeasureCode: 'SARS-CoV-2 positives / processed specimens',
  },
  {
    pathogen: 'rsv',
    denominatorFields: ['RSV_PROCESSED'],
    numeratorFields: ['RSV'],
    measure: 'RSV virological test positivity',
    sourceMeasureCode: 'RSV / RSV_PROCESSED',
  },
];

interface AggregatedWeek {
  geography: HealthGeography;
  period: ReportingPeriod;
  periodStart: string;
  periodEnd: string;
  updatedAt: string;
  numerator: number;
  denominator: number;
  sourceRows: number;
}

function fieldNumber(row: Record<string, unknown>, field: string): number | null {
  const value = row[field];
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  return null;
}

function firstFieldNumber(row: Record<string, unknown>, fields: string[]): number | null {
  for (const field of fields) {
    const value = fieldNumber(row, field);
    if (value !== null) return value;
  }
  return null;
}

function summedFieldNumber(row: Record<string, unknown>, fields: string[]): number | null {
  const values = fields.flatMap((field) => {
    const value = fieldNumber(row, field);
    return value === null ? [] : [value];
  });
  if (values.length === 0) return null;

  return values.reduce((sum, value) => sum + value, 0);
}

function weekPeriod(year: number, week: number): ReportingPeriod | null {
  if (!Number.isInteger(year) || !Number.isInteger(week) || year < 1997 || week < 1 || week > 53) {
    return null;
  }

  return {
    type: 'week',
    year,
    week,
  };
}

function addDays(date: string, days: number): string {
  const parsed = Date.parse(`${date}T00:00:00Z`);
  if (!Number.isFinite(parsed)) return date;
  const next = new Date(parsed + days * 24 * 60 * 60 * 1000);
  return next.toISOString().slice(0, 10);
}

function periodKey(period: ReportingPeriod): string {
  if (period.type === 'week') {
    return `${period.year}-W${period.week.toString().padStart(2, '0')}`;
  }
  return `${period.year}-${period.month.toString().padStart(2, '0')}`;
}

function sortedRows(payload: unknown): z.infer<typeof whoFluNetRowSchema>[] {
  const parsed = whoFluNetResponseSchema.safeParse(payload);
  if (!parsed.success) return [];

  return parsed.data.value
    .flatMap((row) => {
      const parsedRow = whoFluNetRowSchema.safeParse(row);
      return parsedRow.success ? [parsedRow.data] : [];
    })
    .sort((left, right) => {
      const leftPeriod = left.ISO_YEAR * 100 + left.ISO_WEEK;
      const rightPeriod = right.ISO_YEAR * 100 + right.ISO_WEEK;
      return leftPeriod - rightPeriod;
    });
}

function aggregateWeeks(input: {
  rows: z.infer<typeof whoFluNetRowSchema>[];
  geography: HealthGeography;
  now: string;
  measure: PathogenMeasureDefinition;
}): AggregatedWeek[] {
  const weeks = new Map<string, AggregatedWeek>();

  for (const row of input.rows) {
    const period = weekPeriod(row.ISO_YEAR, row.ISO_WEEK);
    if (!period) continue;

    const denominator = firstFieldNumber(row, input.measure.denominatorFields);
    const numerator =
      firstFieldNumber(row, input.measure.numeratorFields) ??
      summedFieldNumber(row, input.measure.componentNumeratorFields ?? []);

    if (
      denominator === null ||
      numerator === null ||
      denominator <= 0 ||
      numerator < 0 ||
      numerator > denominator
    ) {
      continue;
    }

    const key = periodKey(period);
    const existing = weeks.get(key);
    const countryName = row.COUNTRY_AREA_TERRITORY?.trim() || input.geography.name;
    const geography = {
      ...input.geography,
      name: countryName,
      countryName,
    };

    if (!existing) {
      weeks.set(key, {
        geography,
        period,
        periodStart: row.ISO_WEEKSTARTDATE,
        periodEnd: addDays(row.ISO_WEEKSTARTDATE, 6),
        updatedAt: addDays(row.ISO_WEEKSTARTDATE, 6),
        numerator,
        denominator,
        sourceRows: 1,
      });
      continue;
    }

    weeks.set(key, {
      ...existing,
      numerator: existing.numerator + numerator,
      denominator: existing.denominator + denominator,
      sourceRows: existing.sourceRows + 1,
    });
  }

  return [...weeks.values()].sort((left, right) =>
    periodKey(left.period).localeCompare(periodKey(right.period)),
  );
}

function observationFromWeek(input: {
  week: AggregatedWeek;
  measure: PathogenMeasureDefinition;
}): HealthSignalObservation {
  return {
    pathogen: input.measure.pathogen,
    period: input.week.period,
    periodStart: input.week.periodStart,
    periodEnd: input.week.periodEnd,
    observedAt: input.week.periodEnd,
    updatedAt: input.week.updatedAt,
    measure: input.measure.measure,
    value: Number(((input.week.numerator / input.week.denominator) * 100).toFixed(1)),
    unit: '% positivity',
    source: {
      provider: 'WHO GISRS / FluNet',
      dataset: 'FLUMART/VIW_FNT',
      measure: input.measure.sourceMeasureCode,
    },
  };
}

function evidenceFromWeek(input: {
  week: AggregatedWeek;
  measure: PathogenMeasureDefinition;
  trend: HealthSignal['trend'];
}): BiologicalEvidence {
  const value = Number(((input.week.numerator / input.week.denominator) * 100).toFixed(1));

  return {
    pathogen: input.measure.pathogen,
    provider: 'who',
    geography: input.week.geography,
    reportingPeriod: input.week.period,
    periodStart: input.week.periodStart,
    periodEnd: input.week.periodEnd,
    measure: input.measure.measure,
    value,
    unit: '% positivity',
    category: 'unknown',
    trend: input.trend,
    updatedAt: input.week.updatedAt,
    sourceDataset: 'FLUMART/VIW_FNT',
    sourceMeasureCode: input.measure.sourceMeasureCode,
  };
}

function unavailableSignal(input: {
  pathogen: BiologicalSignalType;
  geography: HealthGeography;
  now: string;
}): HealthSignal {
  return {
    id: `${input.pathogen}:${input.geography.countryCode ?? input.geography.code}:unavailable`,
    domain: 'biological',
    type: input.pathogen,
    geography: input.geography,
    updatedAt: input.now,
    category: 'unknown',
    trend: 'unknown',
    source: {
      provider: 'WHO GISRS / FluNet',
      dataset: 'FLUMART/VIW_FNT',
      measure: 'Country-level respiratory virological surveillance',
    },
    freshness: { status: 'stale' },
    metadata: {
      unavailable: true,
      semantics: 'Missing surveillance data is not interpreted as low activity.',
    },
  };
}

function signalFromWeeks(input: {
  measure: PathogenMeasureDefinition;
  weeks: AggregatedWeek[];
  geography: HealthGeography;
  now: string;
}): HealthSignal {
  const latest = input.weeks.at(-1);
  if (!latest) {
    return unavailableSignal({
      pathogen: input.measure.pathogen,
      geography: input.geography,
      now: input.now,
    });
  }

  const observations = input.weeks
    .slice(-12)
    .map((week) => observationFromWeek({ week, measure: input.measure }));
  const previous = observations.at(-2);
  const current = observations.at(-1);
  const trend = calculateComparableTrend({
    current: current?.value,
    previous: previous?.value,
    minimumAbsoluteChange: 2,
  });
  const evidence = evidenceFromWeek({ week: latest, measure: input.measure, trend });

  return {
    id: `${input.measure.pathogen}:${latest.geography.countryCode ?? latest.geography.code}:${periodKey(latest.period)}`,
    domain: 'biological',
    type: input.measure.pathogen,
    geography: latest.geography,
    observedAt: latest.periodEnd,
    periodStart: latest.periodStart,
    periodEnd: latest.periodEnd,
    reportingPeriod: latest.period,
    updatedAt: latest.updatedAt,
    value: evidence.value,
    unit: evidence.unit,
    category: 'unknown',
    trend,
    source: {
      provider: 'WHO GISRS / FluNet',
      dataset: 'FLUMART/VIW_FNT',
      measure: input.measure.measure,
    },
    freshness: calculateHealthSignalFreshness({
      updatedAt: latest.periodEnd,
      now: input.now,
      policy: RESPIRATORY_SURVEILLANCE_FRESHNESS,
    }),
    history: observations,
    evidence: [evidence],
    metadata: {
      numerator: latest.numerator,
      denominator: latest.denominator,
      sourceRows: latest.sourceRows,
      noCategoryReason: 'WHO FluNet does not provide a universal country-level Low/High category.',
    },
  };
}

export function whoRespiratoryUrl(geography: HealthGeography): string | null {
  const countryCode = geography.providerCodes?.who ?? geography.providerCodes?.whoEurope;
  if (!countryCode) return null;

  const url = new URL(WHO_FLUNET_ENDPOINT);
  url.searchParams.set('$top', String(WHO_FLUNET_HISTORY_ROWS));
  url.searchParams.set('$filter', `COUNTRY_CODE eq '${countryCode}'`);
  url.searchParams.set('$orderby', 'ISO_YEAR desc,ISO_WEEK desc');
  return url.toString();
}

export function biologicalProviderCacheKey(input: {
  provider: 'who' | 'cdc' | 'ecdc';
  pathogen: BiologicalSignalType;
  geography: HealthGeography;
  measure: string;
}): string {
  return [
    input.provider,
    input.pathogen,
    input.geography.countryCode ?? input.geography.code ?? 'unknown',
    input.measure,
  ].join(':');
}

export function normalizeWhoRespiratorySignals(
  payload: unknown,
  input: {
    geography: HealthGeography;
    now: string;
    signalTypes?: HealthSignalType[] | undefined;
  },
): HealthSignal[] {
  const rows = sortedRows(payload);
  const selected = new Set(input.signalTypes ?? RESPIRATORY_SIGNAL_TYPES);

  return PATHOGEN_MEASURES.filter((measure) => selected.has(measure.pathogen)).map((measure) =>
    signalFromWeeks({
      measure,
      weeks: aggregateWeeks({ rows, geography: input.geography, now: input.now, measure }),
      geography: input.geography,
      now: input.now,
    }),
  );
}

export const whoRespiratoryProvider: HealthSignalProvider = {
  id: 'who-respiratory',
  supports: (context: HealthSignalProviderContext) => Boolean(whoRespiratoryUrl(context.geography)),
  fetchSignals: async (context) => {
    const url = whoRespiratoryUrl(context.geography);
    if (!url) {
      return {
        providerId: 'who-respiratory',
        fetchedAt: context.now,
        signals: [],
        unavailableSignals: RESPIRATORY_SIGNAL_TYPES,
      };
    }

    const response = await fetch(url, { headers: { Accept: 'application/json' } });
    if (!response.ok) {
      throw new Error(`WHO respiratory surveillance request failed: ${response.status}`);
    }

    const signals = normalizeWhoRespiratorySignals(await response.json(), {
      geography: context.geography,
      now: context.now,
      signalTypes: context.signalTypes,
    });

    return {
      providerId: 'who-respiratory',
      fetchedAt: context.now,
      signals,
      unavailableSignals: signals
        .filter((signal) => signal.metadata?.unavailable === true)
        .map((signal) => signal.type),
    };
  },
};

import { z } from 'zod';
import type {
  HealthGeography,
  HealthSignal,
  HealthSignalObservation,
  HealthSignalProvider,
} from '../../models/healthSignals';
import {
  WASTEWATER_SURVEILLANCE_FRESHNESS,
  calculateComparableTrend,
  calculateHealthSignalFreshness,
} from '../../services/healthSignalFreshness';
import { isFiniteNumber } from '../../utils/number';
import {
  HealthProviderSchemaError,
  fetchHealthJson,
  providerErrorSignal,
  signalProviderStatus,
} from './providerFetch';

const SUMEAU_WASTEWATER_URL =
  'https://odisse.santepubliquefrance.fr/api/explore/v2.1/catalog/datasets/sum-eau-indicateurs/records?order_by=date_complet%20desc&limit=12';

const sumeauResponseSchema = z
  .object({
    results: z.array(z.record(z.string(), z.unknown())),
  })
  .passthrough();

const sumeauRowSchema = z
  .object({
    date_complet: z.string(),
    semaine: z.string(),
    national_54: z.number().optional().nullable(),
    national_12: z.number().optional().nullable(),
  })
  .passthrough();

type SumeauRow = z.infer<typeof sumeauRowSchema>;

function valueFromRow(
  row: SumeauRow,
): { value: number; measure: 'national_54' | 'national_12' } | null {
  if (isFiniteNumber(row.national_54)) return { value: row.national_54, measure: 'national_54' };
  if (isFiniteNumber(row.national_12)) return { value: row.national_12, measure: 'national_12' };
  return null;
}

function reportingWeek(value: string): HealthSignal['reportingPeriod'] | undefined {
  const match = /^(\d{4})-S(\d{1,2})$/.exec(value.trim());
  if (!match) return undefined;
  const year = Number(match[1]);
  const week = Number(match[2]);
  if (!Number.isInteger(year) || !Number.isInteger(week)) return undefined;
  return { type: 'week', year, week };
}

function sortedRows(payload: unknown): SumeauRow[] {
  const parsed = sumeauResponseSchema.safeParse(payload);
  if (!parsed.success) {
    throw new HealthProviderSchemaError('Invalid SUM’Eau wastewater response');
  }

  return parsed.data.results
    .flatMap((row) => {
      const parsedRow = sumeauRowSchema.safeParse(row);
      return parsedRow.success ? [parsedRow.data] : [];
    })
    .filter((row) => valueFromRow(row) !== null)
    .sort((left, right) => Date.parse(left.date_complet) - Date.parse(right.date_complet));
}

function observationFromRow(row: SumeauRow): HealthSignalObservation | null {
  const reading = valueFromRow(row);
  if (!reading) return null;

  return {
    period: reportingWeek(row.semaine),
    observedAt: `${row.date_complet}T00:00:00.000Z`,
    updatedAt: `${row.date_complet}T00:00:00.000Z`,
    measure: 'SARS-CoV-2 national wastewater indicator',
    value: reading.value,
    unit: 'normalized indicator',
    source: {
      provider: 'Santé publique France',
      dataset: 'SUM’Eau',
      measure: reading.measure,
    },
    status: 'wastewater-concentration',
  };
}

function franceGeography(geography: HealthGeography): HealthGeography {
  return {
    level: 'country',
    code: 'FR',
    name: geography.countryName ?? 'France',
    countryCode: 'FR',
    countryName: geography.countryName ?? 'France',
  };
}

function unavailableSignal(input: { geography: HealthGeography; now: string }): HealthSignal {
  return {
    id: 'sumeau:wastewater-covid-19:FR:unavailable',
    domain: 'biological',
    type: 'wastewater-covid-19',
    geography: franceGeography(input.geography),
    updatedAt: input.now,
    category: 'unknown',
    trend: 'unknown',
    source: {
      provider: 'Santé publique France',
      dataset: 'SUM’Eau',
      measure: 'SARS-CoV-2 national wastewater indicator',
    },
    freshness: { status: 'stale', ageMs: Number.POSITIVE_INFINITY },
    metadata: {
      unavailable: true,
      reason: 'no-sumeau-wastewater-observation',
      surveillanceBasis: 'national wastewater concentration',
      noClinicalPrevalenceInference: true,
    },
  };
}

export function normalizeSumeauWastewaterSignal(input: {
  payload: unknown;
  geography: HealthGeography;
  now: string;
}): HealthSignal {
  const history = sortedRows(input.payload).flatMap((row) => observationFromRow(row) ?? []);
  const current = history.at(-1);
  if (!current) return unavailableSignal({ geography: input.geography, now: input.now });

  const previous = history.at(-2);

  return {
    id: 'sumeau:wastewater-covid-19:FR',
    domain: 'biological',
    type: 'wastewater-covid-19',
    geography: franceGeography(input.geography),
    observedAt: current.observedAt,
    reportingPeriod: current.period,
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
      provider: 'Santé publique France',
      dataset: 'SUM’Eau',
      measure: 'SARS-CoV-2 national wastewater indicator',
    },
    freshness: calculateHealthSignalFreshness({
      updatedAt: current.observedAt ?? current.updatedAt ?? input.now,
      now: input.now,
      policy: WASTEWATER_SURVEILLANCE_FRESHNESS,
    }),
    history,
    metadata: {
      surveillanceBasis: 'national wastewater concentration',
      reportingGeography: 'France',
      sourceColumn: current.source?.measure,
      noClinicalPrevalenceInference: true,
    },
  };
}

export const sumeauWastewaterProvider: HealthSignalProvider = {
  id: 'sumeau-wastewater',
  access: 'anonymous',
  coverage: 'national',
  documentationUrl:
    'https://www.data.gouv.fr/datasets/surveillance-du-sars-cov-2-dans-les-eaux-usees-sumeau',
  supports: (context) => context.geography?.countryCode === 'FR',
  fetchSignals: async (context) => {
    if (!context.geography) {
      return { providerId: 'sumeau-wastewater', fetchedAt: context.now, signals: [] };
    }

    if (context.signalTypes !== undefined && !context.signalTypes.includes('wastewater-covid-19')) {
      return { providerId: 'sumeau-wastewater', fetchedAt: context.now, signals: [] };
    }

    let signal: HealthSignal;
    try {
      signal = normalizeSumeauWastewaterSignal({
        payload: await fetchHealthJson(SUMEAU_WASTEWATER_URL),
        geography: context.geography,
        now: context.now,
      });
    } catch (error) {
      signal = providerErrorSignal({
        id: 'sumeau:wastewater-covid-19:FR:provider-error',
        domain: 'biological',
        type: 'wastewater-covid-19',
        geography: franceGeography(context.geography),
        now: context.now,
        source: {
          provider: 'Santé publique France',
          dataset: 'SUM’Eau',
          measure: 'SARS-CoV-2 national wastewater indicator',
        },
        reason: 'sumeau-wastewater-provider-error',
        error,
      });
    }

    return {
      providerId: 'sumeau-wastewater',
      fetchedAt: context.now,
      signals: [signal],
      unavailableSignals: signal.metadata?.unavailable === true ? ['wastewater-covid-19'] : [],
      signalStatuses: [signalProviderStatus(signal)],
    };
  },
};

export const SUMEAU_WASTEWATER_SIGNAL_TYPES = ['wastewater-covid-19'] as const;

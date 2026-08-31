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

const RIVM_WASTEWATER_NATIONAL_URL =
  'https://data.rivm.nl/covid-19/COVID-19_rioolwaterdata_landelijk.json';

const RIVM_HISTORY_LIMIT = 12;

const rivmWastewaterRowSchema = z
  .object({
    Date_of_report: z.string(),
    Date_measurement: z.string(),
    RNA_flow_per_100000: z.union([z.string(), z.number()]).optional().nullable(),
  })
  .passthrough();

function numberFrom(value: string | number | null | undefined): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value !== 'string' || !value.trim()) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function sortedRows(payload: unknown): z.infer<typeof rivmWastewaterRowSchema>[] {
  if (!Array.isArray(payload)) {
    throw new HealthProviderSchemaError('Invalid RIVM wastewater response');
  }

  return payload
    .flatMap((row) => {
      const parsed = rivmWastewaterRowSchema.safeParse(row);
      return parsed.success ? [parsed.data] : [];
    })
    .filter((row) => {
      const value = numberFrom(row.RNA_flow_per_100000);
      const measuredAt = Date.parse(`${row.Date_measurement}T00:00:00Z`);
      return value !== null && value >= 0 && Number.isFinite(measuredAt);
    })
    .sort((left, right) => Date.parse(left.Date_measurement) - Date.parse(right.Date_measurement));
}

function observationFromRow(
  row: z.infer<typeof rivmWastewaterRowSchema>,
): HealthSignalObservation | null {
  const value = numberFrom(row.RNA_flow_per_100000);
  if (!isFiniteNumber(value)) return null;

  return {
    observedAt: `${row.Date_measurement}T00:00:00.000Z`,
    updatedAt: `${row.Date_of_report}T00:00:00.000Z`,
    measure: 'SARS-CoV-2 national wastewater viral load',
    value,
    unit: 'virus particles per 100,000 inhabitants',
    source: {
      provider: 'RIVM',
      dataset: 'COVID-19_rioolwaterdata_landelijk',
      measure: 'RNA_flow_per_100000',
    },
    status: 'wastewater-concentration',
  };
}

function unavailableSignal(input: { geography: HealthGeography; now: string }): HealthSignal {
  return {
    id: 'rivm-wastewater:wastewater-covid-19:NL:unavailable',
    domain: 'biological',
    type: 'wastewater-covid-19',
    geography: {
      level: 'country',
      code: 'NL',
      name: input.geography.countryName ?? 'Netherlands',
      countryCode: 'NL',
      countryName: input.geography.countryName ?? 'Netherlands',
    },
    updatedAt: input.now,
    category: 'unknown',
    trend: 'unknown',
    source: {
      provider: 'RIVM',
      dataset: 'COVID-19_rioolwaterdata_landelijk',
      measure: 'SARS-CoV-2 national wastewater viral load',
    },
    freshness: { status: 'stale', ageMs: Number.POSITIVE_INFINITY },
    metadata: {
      unavailable: true,
      reason: 'no-rivm-wastewater-observation',
      surveillanceBasis: 'national wastewater concentration',
    },
  };
}

export function normalizeRivmWastewaterSignal(input: {
  payload: unknown;
  geography: HealthGeography;
  now: string;
}): HealthSignal {
  const history = sortedRows(input.payload)
    .slice(-RIVM_HISTORY_LIMIT)
    .flatMap((row) => observationFromRow(row) ?? []);
  const current = history.at(-1);
  if (!current) return unavailableSignal({ geography: input.geography, now: input.now });

  const previous = history.at(-2);

  return {
    id: 'rivm-wastewater:wastewater-covid-19:NL',
    domain: 'biological',
    type: 'wastewater-covid-19',
    geography: {
      level: 'country',
      code: 'NL',
      name: input.geography.countryName ?? 'Netherlands',
      countryCode: 'NL',
      countryName: input.geography.countryName ?? 'Netherlands',
    },
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
      provider: 'RIVM',
      dataset: 'COVID-19_rioolwaterdata_landelijk',
      measure: 'SARS-CoV-2 national wastewater viral load',
    },
    freshness: calculateHealthSignalFreshness({
      updatedAt: current.updatedAt ?? current.observedAt ?? input.now,
      now: input.now,
      policy: WASTEWATER_SURVEILLANCE_FRESHNESS,
    }),
    history,
    metadata: {
      surveillanceBasis: 'national wastewater concentration',
      reportingGeography: 'Netherlands',
      noClinicalPrevalenceInference: true,
    },
  };
}

export const rivmWastewaterProvider: HealthSignalProvider = {
  id: 'rivm-wastewater',
  supports: (context) => context.geography?.countryCode === 'NL',
  fetchSignals: async (context) => {
    if (!context.geography) {
      return { providerId: 'rivm-wastewater', fetchedAt: context.now, signals: [] };
    }

    let signal: HealthSignal;
    try {
      signal = normalizeRivmWastewaterSignal({
        payload: await fetchHealthJson(RIVM_WASTEWATER_NATIONAL_URL),
        geography: context.geography,
        now: context.now,
      });
    } catch (error) {
      signal = providerErrorSignal({
        id: 'rivm-wastewater:wastewater-covid-19:NL:provider-error',
        domain: 'biological',
        type: 'wastewater-covid-19',
        geography: {
          level: 'country',
          code: 'NL',
          name: context.geography.countryName ?? 'Netherlands',
          countryCode: 'NL',
          countryName: context.geography.countryName ?? 'Netherlands',
        },
        now: context.now,
        source: {
          provider: 'RIVM',
          dataset: 'COVID-19_rioolwaterdata_landelijk',
          measure: 'SARS-CoV-2 national wastewater viral load',
        },
        reason: 'rivm-wastewater-provider-error',
        error,
      });
    }

    return {
      providerId: 'rivm-wastewater',
      fetchedAt: context.now,
      signals: [signal],
      unavailableSignals: signal.metadata?.unavailable === true ? ['wastewater-covid-19'] : [],
      signalStatuses: [signalProviderStatus(signal)],
    };
  },
};

export const RIVM_WASTEWATER_SIGNAL_TYPES = ['wastewater-covid-19'] as const;

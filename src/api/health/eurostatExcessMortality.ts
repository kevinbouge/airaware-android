import { z } from 'zod';
import type {
  HealthGeography,
  HealthSignal,
  HealthSignalObservation,
  HealthSignalProvider,
  HealthSignalProviderContext,
  ReportingPeriod,
} from '../../models/healthSignals';
import {
  EXCESS_MORTALITY_FRESHNESS,
  calculateComparableTrend,
  calculateHealthSignalFreshness,
} from '../../services/healthSignalFreshness';
import {
  HealthProviderSchemaError,
  fetchHealthJson,
  providerErrorSignal,
  signalProviderStatus,
} from './providerFetch';

const EUROSTAT_EXCESS_MORTALITY_ENDPOINT =
  'https://ec.europa.eu/eurostat/api/dissemination/statistics/1.0/data/demo_mexrt';

const jsonStatCategorySchema = z
  .object({
    index: z.record(z.string(), z.number()),
    label: z.record(z.string(), z.string()).optional(),
  })
  .passthrough();

const eurostatDatasetSchema = z
  .object({
    label: z.string().optional(),
    updated: z.string(),
    value: z.record(z.string(), z.unknown()),
    status: z.record(z.string(), z.string()).optional(),
    id: z.array(z.string()),
    size: z.array(z.number()),
    dimension: z.record(
      z.string(),
      z
        .object({
          label: z.string().optional(),
          category: jsonStatCategorySchema,
        })
        .passthrough(),
    ),
  })
  .passthrough();

export function eurostatExcessMortalityUrl(geography: HealthGeography): string | null {
  const geo =
    geography.providerCodes === undefined
      ? (geography.countryCode ?? geography.code)
      : geography.providerCodes.eurostat;
  if (!geo) return null;

  const url = new URL(EUROSTAT_EXCESS_MORTALITY_ENDPOINT);
  url.searchParams.set('geo', geo);
  url.searchParams.set('lang', 'en');
  return url.toString();
}

function monthPeriod(period: string): ReportingPeriod | null {
  const match = /^(\d{4})-(\d{2})$/.exec(period);
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) return null;

  return {
    type: 'month',
    year,
    month,
  };
}

function periodStart(period: ReportingPeriod): string {
  if (period.type === 'month') {
    return `${period.year}-${period.month.toString().padStart(2, '0')}-01`;
  }

  if (period.type === 'year') {
    return `${period.year}-01-01`;
  }

  return `${period.year}-W${period.week.toString().padStart(2, '0')}`;
}

function periodEnd(period: ReportingPeriod): string {
  if (period.type === 'month') {
    const end = new Date(Date.UTC(period.year, period.month, 0));
    return end.toISOString().slice(0, 10);
  }

  if (period.type === 'year') {
    return `${period.year}-12-31`;
  }

  return periodStart(period);
}

type EurostatExcessMortalityObservation = HealthSignalObservation & {
  period: ReportingPeriod;
  periodStart: string;
  periodEnd: string;
};

function sortedExcessMortalityObservations(
  parsed: z.infer<typeof eurostatDatasetSchema>,
): EurostatExcessMortalityObservation[] {
  const timeDimension = parsed.dimension.time?.category.index;
  if (!timeDimension) return [];

  return Object.entries(timeDimension)
    .flatMap(([time, index]) => {
      const value = parsed.value[String(index)];
      const period = monthPeriod(time);
      if (!period || typeof value !== 'number' || !Number.isFinite(value)) return [];

      return [
        {
          period,
          periodStart: periodStart(period),
          periodEnd: periodEnd(period),
          value,
          unit: '%',
          status: parsed.status?.[String(index)],
        },
      ];
    })
    .sort((left, right) => periodKey(left.period).localeCompare(periodKey(right.period)));
}

function periodKey(period: ReportingPeriod): string {
  if (period.type === 'week') {
    return `${period.year}-W${period.week.toString().padStart(2, '0')}`;
  }
  if (period.type === 'year') {
    return `${period.year}`;
  }
  return `${period.year}-${period.month.toString().padStart(2, '0')}`;
}

export function normalizeEurostatExcessMortality(
  payload: unknown,
  input: {
    geography: HealthGeography;
    now: string;
  },
): HealthSignal | null {
  const parsed = eurostatDatasetSchema.safeParse(payload);
  if (!parsed.success) {
    throw new HealthProviderSchemaError('Invalid Eurostat excess mortality response');
  }

  const observations = sortedExcessMortalityObservations(parsed.data);
  const latest = observations.at(-1);
  if (!latest) return null;

  const previous = observations.at(-2);
  const geography: HealthGeography = {
    ...input.geography,
    name:
      parsed.data.dimension.geo?.category.label?.[
        input.geography.providerCodes?.eurostat ?? input.geography.countryCode ?? ''
      ] ?? input.geography.name,
  };

  return {
    id: `excess-mortality:${geography.countryCode ?? geography.code}:${periodKey(latest.period)}`,
    domain: 'population-health',
    type: 'excess-mortality',
    geography,
    observedAt: latest.periodEnd,
    periodStart: latest.periodStart,
    periodEnd: latest.periodEnd,
    reportingPeriod: latest.period,
    updatedAt: parsed.data.updated,
    value: latest.value,
    unit: '%',
    category: 'unknown',
    trend: calculateComparableTrend({
      current: latest.value,
      previous: previous?.value,
      minimumAbsoluteChange: 2,
    }),
    source: {
      provider: 'Eurostat',
      dataset: 'demo_mexrt',
      measure: 'Excess mortality by month; percentage relative to the 2016-2019 monthly baseline',
    },
    freshness: calculateHealthSignalFreshness({
      updatedAt: latest.periodEnd,
      now: input.now,
      policy: EXCESS_MORTALITY_FRESHNESS,
    }),
    temporalClass: 'background',
    history: observations.slice(-24),
    metadata: {
      provisional: latest.status === 'p',
      datasetLabel: parsed.data.label ?? 'Excess mortality by month',
    },
  };
}

export const eurostatExcessMortalityProvider: HealthSignalProvider = {
  id: 'eurostat-excess-mortality',
  access: 'anonymous',
  coverage: 'regional',
  authority: 'regional-authority',
  regions: ['europe'],
  signals: ['excess-mortality'],
  temporalClasses: ['background'],
  documentationUrl: 'https://ec.europa.eu/eurostat/web/user-guides/data-browser/api-data-access',
  supports: (context: HealthSignalProviderContext) =>
    context.geography !== null && Boolean(eurostatExcessMortalityUrl(context.geography)),
  fetchSignals: async (context) => {
    if (context.geography === null) {
      return {
        providerId: 'eurostat-excess-mortality',
        fetchedAt: context.now,
        signals: [],
        unavailableSignals: ['excess-mortality'],
      };
    }

    const url = eurostatExcessMortalityUrl(context.geography);
    if (!url) {
      return {
        providerId: 'eurostat-excess-mortality',
        fetchedAt: context.now,
        signals: [],
        unavailableSignals: ['excess-mortality'],
      };
    }

    let signal: HealthSignal | null;
    try {
      signal = normalizeEurostatExcessMortality(await fetchHealthJson(url), {
        geography: context.geography,
        now: context.now,
      });
    } catch (error) {
      signal = providerErrorSignal({
        id: `excess-mortality:${context.geography.countryCode ?? context.geography.code}:eurostat:provider-error`,
        domain: 'population-health',
        type: 'excess-mortality',
        geography: context.geography,
        now: context.now,
        source: {
          provider: 'Eurostat',
          dataset: 'demo_mexrt',
          measure:
            'Excess mortality by month; percentage relative to the 2016-2019 monthly baseline',
        },
        reason: 'eurostat-provider-error',
        error,
      });
    }

    return {
      providerId: 'eurostat-excess-mortality',
      fetchedAt: context.now,
      signals: signal ? [signal] : [],
      unavailableSignals:
        !signal || signal.metadata?.unavailable === true ? ['excess-mortality'] : [],
      signalStatuses: signal
        ? [signalProviderStatus(signal)]
        : [{ type: 'excess-mortality', status: 'no-data', reason: 'no-eurostat-observation' }],
    };
  },
};

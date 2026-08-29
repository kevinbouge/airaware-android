import type {
  HealthGeography,
  HealthSignal,
  HealthSignalObservation,
  HealthSignalProvider,
  HealthSignalProviderContext,
  ReportingPeriod,
} from '../../models/healthSignals';
import { iso3FromIso2 } from '../../services/isoCountries';
import {
  EXCESS_MORTALITY_FRESHNESS,
  calculateComparableTrend,
  calculateHealthSignalFreshness,
} from '../../services/healthSignalFreshness';

const OWID_EXCESS_MORTALITY_URL =
  'https://ourworldindata.org/grapher/excess-mortality-p-scores-average-baseline.csv?csvType=full&useColumnShortNames=true';

interface OwidExcessMortalityRow {
  entity: string;
  code: string;
  week: string;
  value: number;
}

export function owidExcessMortalityUrl(): string {
  return OWID_EXCESS_MORTALITY_URL;
}

function csvRows(csv: string): string[][] {
  return csv
    .trim()
    .split(/\r?\n/)
    .map((line) => {
      const fields: string[] = [];
      let current = '';
      let quoted = false;

      for (let index = 0; index < line.length; index += 1) {
        const char = line[index];
        const next = line[index + 1];
        if (char === '"' && quoted && next === '"') {
          current += '"';
          index += 1;
        } else if (char === '"') {
          quoted = !quoted;
        } else if (char === ',' && !quoted) {
          fields.push(current);
          current = '';
        } else {
          current += char;
        }
      }

      fields.push(current);
      return fields;
    });
}

function periodFromWeek(value: string): ReportingPeriod | null {
  const match = /^(\d{4})-W(\d{2})$/.exec(value);
  if (!match) return null;

  const year = Number(match[1]);
  const week = Number(match[2]);
  if (!Number.isInteger(year) || !Number.isInteger(week) || week < 1 || week > 53) return null;
  return { type: 'week', year, week };
}

function addDays(date: string, days: number): string {
  const parsed = Date.parse(`${date}T00:00:00Z`);
  if (!Number.isFinite(parsed)) return date;
  return new Date(parsed + days * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

function weekStartDate(period: ReportingPeriod): string {
  if (period.type === 'month') return `${period.year}-${String(period.month).padStart(2, '0')}-01`;
  if (period.type === 'year') return `${period.year}-01-01`;

  const januaryFourth = new Date(Date.UTC(period.year, 0, 4));
  const day = januaryFourth.getUTCDay() || 7;
  const weekOneMonday = Date.UTC(period.year, 0, 4 - day + 1);
  return new Date(weekOneMonday + (period.week - 1) * 7 * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);
}

function periodKey(period: ReportingPeriod): string {
  if (period.type === 'week') return `${period.year}-W${String(period.week).padStart(2, '0')}`;
  if (period.type === 'year') return `${period.year}`;
  return `${period.year}-${String(period.month).padStart(2, '0')}`;
}

function rowsForCountry(csv: string, iso3: string): OwidExcessMortalityRow[] {
  const rows = csvRows(csv);
  const header = rows[0];
  if (!header) return [];
  const entityIndex = header.indexOf('entity');
  const codeIndex = header.indexOf('code');
  const weekIndex = header.indexOf('week');
  const valueIndex = header.indexOf('p_avg_all_ages');
  if ([entityIndex, codeIndex, weekIndex, valueIndex].some((index) => index < 0)) return [];

  return rows
    .slice(1)
    .flatMap((row) => {
      const code = row[codeIndex]?.trim();
      const week = row[weekIndex]?.trim();
      const rawValue = row[valueIndex]?.trim();
      const value = Number(rawValue);
      if (code !== iso3 || !week || !Number.isFinite(value)) return [];
      return [
        {
          entity: row[entityIndex]?.trim() || code,
          code,
          week,
          value,
        },
      ];
    })
    .sort((left, right) => left.week.localeCompare(right.week));
}

function observationFromRow(row: OwidExcessMortalityRow): HealthSignalObservation | null {
  const period = periodFromWeek(row.week);
  if (!period) return null;
  const periodStart = weekStartDate(period);
  const periodEnd = addDays(periodStart, 6);

  return {
    period,
    periodStart,
    periodEnd,
    observedAt: periodEnd,
    updatedAt: periodEnd,
    measure: 'Excess mortality P-score using a 5-year average baseline',
    value: row.value,
    unit: '%',
    source: {
      provider: 'Our World in Data',
      dataset: 'excess-mortality-p-scores-average-baseline',
      measure: 'p_avg_all_ages',
    },
  };
}

function unavailableSignal(input: { geography: HealthGeography; now: string }): HealthSignal {
  return {
    id: `excess-mortality:${input.geography.countryCode ?? input.geography.code}:owid:unavailable`,
    domain: 'population-health',
    type: 'excess-mortality',
    geography: input.geography,
    updatedAt: input.now,
    category: 'unknown',
    trend: 'unknown',
    source: {
      provider: 'Our World in Data',
      dataset: 'excess-mortality-p-scores-average-baseline',
      measure: 'Excess mortality P-score using a 5-year average baseline',
    },
    freshness: { status: 'stale' },
    metadata: {
      unavailable: true,
      semantics: 'Missing mortality data is not interpreted as normal mortality.',
    },
  };
}

export function normalizeOwidExcessMortality(
  csv: string,
  input: { geography: HealthGeography; now: string },
): HealthSignal {
  const iso2 = input.geography.countryCode ?? input.geography.code;
  const iso3 = iso2 ? iso3FromIso2(iso2) : null;
  if (!iso3) return unavailableSignal(input);

  const countryRows = rowsForCountry(csv, iso3);
  const observations = countryRows.flatMap((row) => {
    const observation = observationFromRow(row);
    return observation ? [observation] : [];
  });
  const latest = observations.at(-1);
  if (!latest?.periodEnd) return unavailableSignal(input);

  const previous = observations.at(-2);
  const geography = {
    ...input.geography,
    name: countryRows.at(-1)?.entity ?? input.geography.name,
  };

  return {
    id: `excess-mortality:${geography.countryCode ?? geography.code}:owid:${periodKey(latest.period!)}`,
    domain: 'population-health',
    type: 'excess-mortality',
    geography,
    observedAt: latest.periodEnd,
    periodStart: latest.periodStart,
    periodEnd: latest.periodEnd,
    reportingPeriod: latest.period,
    updatedAt: latest.updatedAt ?? latest.periodEnd,
    value: latest.value,
    unit: '%',
    category: 'unknown',
    trend: calculateComparableTrend({
      current: latest.value,
      previous: previous?.value,
      minimumAbsoluteChange: 2,
    }),
    source: {
      provider: 'Our World in Data',
      dataset: 'excess-mortality-p-scores-average-baseline',
      measure:
        'Excess mortality P-score; percentage difference from a 5-year average baseline for all ages',
    },
    freshness: calculateHealthSignalFreshness({
      updatedAt: latest.periodEnd,
      now: input.now,
      policy: EXCESS_MORTALITY_FRESHNESS,
    }),
    history: observations.slice(-24),
    metadata: {
      originalCountryCode: iso3,
      sourceColumn: 'p_avg_all_ages',
      datasetLabel:
        'Excess mortality: deaths from all causes compared to average over previous years',
    },
  };
}

export const owidExcessMortalityProvider: HealthSignalProvider = {
  id: 'owid-excess-mortality',
  supports: (context: HealthSignalProviderContext) =>
    context.geography !== null &&
    (context.signalTypes === undefined ||
      context.signalTypes.some((type) => type === 'excess-mortality')),
  fetchSignals: async (context) => {
    if (context.geography === null) {
      return {
        providerId: 'owid-excess-mortality',
        fetchedAt: context.now,
        signals: [],
        unavailableSignals: ['excess-mortality'],
      };
    }

    const response = await fetch(owidExcessMortalityUrl(), {
      headers: { Accept: 'text/csv' },
    });
    if (!response.ok) {
      throw new Error(`OWID excess mortality request failed: ${response.status}`);
    }

    return {
      providerId: 'owid-excess-mortality',
      fetchedAt: context.now,
      signals: [
        normalizeOwidExcessMortality(await response.text(), {
          geography: context.geography,
          now: context.now,
        }),
      ],
      unavailableSignals: [],
    };
  },
};

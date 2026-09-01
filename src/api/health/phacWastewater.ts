import { z } from 'zod';
import type {
  HealthGeography,
  HealthSignal,
  HealthSignalProvider,
  HealthSignalProviderContext,
  HealthSignalTrend,
  WastewaterSignalType,
} from '../../models/healthSignals';
import {
  WASTEWATER_SURVEILLANCE_FRESHNESS,
  calculateHealthSignalFreshness,
} from '../../services/healthSignalFreshness';
import { delimitedRecords } from './csv';
import {
  HealthProviderSchemaError,
  fetchHealthText,
  providerErrorSignal,
  signalProviderStatus,
} from './providerFetch';

const PHAC_WASTEWATER_TREND_URL =
  'https://health-infobase.canada.ca/src/data/wastewater/wastewater_trend.csv';

interface PhacWastewaterMeasure {
  signalType: WastewaterSignalType;
  measureId: string;
  label: string;
}

const PHAC_WASTEWATER_MEASURES: PhacWastewaterMeasure[] = [
  {
    signalType: 'wastewater-covid-19',
    measureId: 'covN2',
    label: 'SARS-CoV-2 wastewater viral activity',
  },
  {
    signalType: 'wastewater-influenza',
    measureId: 'fluA',
    label: 'Influenza A wastewater viral activity',
  },
  {
    signalType: 'wastewater-rsv',
    measureId: 'rsv',
    label: 'RSV wastewater viral activity',
  },
];

const PHAC_WASTEWATER_SIGNAL_TYPES = PHAC_WASTEWATER_MEASURES.map((measure) => measure.signalType);

const phacTrendRowSchema = z
  .object({
    Location: z.string(),
    measureid: z.string(),
    latestTrend: z.string().optional().nullable(),
    latestLevel: z.string().optional().nullable(),
    grouping: z.string(),
    city: z.string().optional().nullable(),
    province: z.string().optional().nullable(),
    country: z.string().optional().nullable(),
    Viral_Activity_Level: z.string().optional().nullable(),
    weekStart: z.string(),
  })
  .passthrough();

type PhacTrendRow = z.infer<typeof phacTrendRowSchema>;

function normalizedText(value: string | null | undefined): string {
  return (value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function rowMatchesLocation(row: PhacTrendRow, locationName: string | undefined): boolean {
  const normalizedLocation = normalizedText(locationName);
  if (!normalizedLocation) return false;

  const values = [row.city, row.Location, row.province].map(normalizedText).filter(Boolean);
  return values.some((value) => value === normalizedLocation);
}

function orderedRows(csv: string): PhacTrendRow[] {
  const records = delimitedRecords(csv);
  if (!records.some((record) => 'Location' in record && 'measureid' in record)) {
    throw new HealthProviderSchemaError('Invalid PHAC wastewater response');
  }

  return records.flatMap((record) => {
    const parsed = phacTrendRowSchema.safeParse(record);
    return parsed.success ? [parsed.data] : [];
  });
}

function trendFromProvider(value: string | null | undefined): HealthSignalTrend {
  const normalized = normalizedText(value);
  if (normalized.includes('increasing')) return 'rising';
  if (normalized.includes('decreasing')) return 'falling';
  if (normalized.includes('no change') || normalized.includes('stable')) return 'stable';
  return 'unknown';
}

function categoryFromProvider(value: string | null | undefined): HealthSignal['category'] {
  const normalized = normalizedText(value);
  if (normalized === 'low') return 'low';
  if (normalized === 'moderate') return 'moderate';
  if (normalized === 'high') return 'high';
  if (normalized === 'very high') return 'very-high';
  return 'unknown';
}

function phacGeography(row: PhacTrendRow, fallback: HealthGeography): HealthGeography {
  const grouping = normalizedText(row.grouping);
  const place = row.city?.trim() || row.Location.trim() || row.province?.trim() || 'Canada';
  const countryName = fallback.countryName ?? 'Canada';

  if (grouping === 'city' || grouping === 'site') {
    return {
      level: 'subregion',
      code: `CA:${place}`,
      name: place,
      countryCode: 'CA',
      countryName,
    };
  }

  if (grouping === 'province') {
    return {
      level: 'region',
      code: `CA:${place}`,
      name: row.province?.trim() || place,
      countryCode: 'CA',
      countryName,
    };
  }

  return {
    level: 'country',
    code: 'CA',
    name: countryName,
    countryCode: 'CA',
    countryName,
  };
}

function unavailableSignal(input: {
  geography: HealthGeography;
  measure: PhacWastewaterMeasure;
  now: string;
}): HealthSignal {
  return {
    id: `phac-wastewater:${input.measure.signalType}:CA:unavailable`,
    domain: 'biological',
    type: input.measure.signalType,
    geography: {
      level: 'country',
      code: 'CA',
      name: input.geography.countryName ?? 'Canada',
      countryCode: 'CA',
      countryName: input.geography.countryName ?? 'Canada',
    },
    updatedAt: input.now,
    category: 'unknown',
    trend: 'unknown',
    source: {
      provider: 'PHAC',
      dataset: 'National wastewater monitoring trend',
      measure: input.measure.label,
    },
    freshness: { status: 'stale', ageMs: Number.POSITIVE_INFINITY },
    temporalClass: 'current',
    metadata: {
      unavailable: true,
      reason: 'no-phac-wastewater-observation',
      surveillanceBasis: 'wastewater viral activity',
      matchingLimitation:
        'PHAC wastewater rows are matched to the active location name when explicit catchment geometry is unavailable.',
      noClinicalPrevalenceInference: true,
    },
  };
}

export function normalizePhacWastewaterSignals(input: {
  csv: string;
  geography: HealthGeography;
  locationName?: string | undefined;
  now: string;
  signalTypes?: WastewaterSignalType[] | undefined;
}): HealthSignal[] {
  const rows = orderedRows(input.csv);
  const measures = PHAC_WASTEWATER_MEASURES.filter(
    (measure) => input.signalTypes === undefined || input.signalTypes.includes(measure.signalType),
  );

  return measures.map((measure) => {
    const candidates = rows
      .filter((row) => row.measureid === measure.measureId)
      .filter((row) => rowMatchesLocation(row, input.locationName));
    const current = candidates
      .filter((row) => Number.isFinite(Date.parse(`${row.weekStart}T00:00:00Z`)))
      .sort((left, right) => Date.parse(left.weekStart) - Date.parse(right.weekStart))
      .at(-1);

    if (!current) {
      return unavailableSignal({ geography: input.geography, measure, now: input.now });
    }

    const observedAt = `${current.weekStart}T00:00:00.000Z`;
    const category = categoryFromProvider(current.Viral_Activity_Level ?? current.latestLevel);
    return {
      id: `phac-wastewater:${measure.signalType}:${phacGeography(current, input.geography).code ?? 'CA'}`,
      domain: 'biological',
      type: measure.signalType,
      geography: phacGeography(current, input.geography),
      observedAt,
      updatedAt: observedAt,
      category,
      trend: trendFromProvider(current.latestTrend),
      source: {
        provider: 'PHAC',
        dataset: 'National wastewater monitoring trend',
        measure: measure.label,
      },
      freshness: calculateHealthSignalFreshness({
        updatedAt: observedAt,
        now: input.now,
        policy: WASTEWATER_SURVEILLANCE_FRESHNESS,
      }),
      temporalClass: 'current',
      metadata: {
        providerCategory: current.Viral_Activity_Level ?? current.latestLevel,
        surveillanceBasis: 'wastewater viral activity',
        reportingGeography: current.Location,
        matchingLimitation:
          'PHAC wastewater rows are matched to the active location name when explicit catchment geometry is unavailable.',
        noClinicalPrevalenceInference: true,
      },
    };
  });
}

export const phacWastewaterProvider: HealthSignalProvider = {
  id: 'phac-wastewater',
  access: 'anonymous',
  coverage: 'regional',
  authority: 'national-authority',
  regions: ['americas'],
  signals: PHAC_WASTEWATER_SIGNAL_TYPES,
  temporalClasses: ['current'],
  documentationUrl: 'https://health-infobase.canada.ca/wastewater/',
  supports: (context: HealthSignalProviderContext) => context.geography?.countryCode === 'CA',
  fetchSignals: async (context) => {
    if (!context.geography) {
      return { providerId: 'phac-wastewater', fetchedAt: context.now, signals: [] };
    }

    const selectedSignalTypes = context.signalTypes?.filter(
      (type): type is WastewaterSignalType =>
        type === 'wastewater-covid-19' ||
        type === 'wastewater-influenza' ||
        type === 'wastewater-rsv',
    );

    let signals: HealthSignal[];
    try {
      signals = normalizePhacWastewaterSignals({
        csv: await fetchHealthText(PHAC_WASTEWATER_TREND_URL),
        geography: context.geography,
        locationName: context.locationName,
        now: context.now,
        signalTypes: selectedSignalTypes,
      });
    } catch (error) {
      const measures = PHAC_WASTEWATER_MEASURES.filter(
        (measure) =>
          selectedSignalTypes === undefined || selectedSignalTypes.includes(measure.signalType),
      );
      signals = measures.map((measure) =>
        providerErrorSignal({
          id: `phac-wastewater:${measure.signalType}:CA:provider-error`,
          domain: 'biological',
          type: measure.signalType,
          geography: {
            level: 'country',
            code: 'CA',
            name: context.geography?.countryName ?? 'Canada',
            countryCode: 'CA',
            countryName: context.geography?.countryName ?? 'Canada',
          },
          now: context.now,
          source: {
            provider: 'PHAC',
            dataset: 'National wastewater monitoring trend',
            measure: measure.label,
          },
          reason: 'phac-wastewater-provider-error',
          error,
        }),
      );
    }

    return {
      providerId: 'phac-wastewater',
      fetchedAt: context.now,
      signals,
      unavailableSignals: signals
        .filter((signal) => signal.metadata?.unavailable === true)
        .map((signal) => signal.type),
      signalStatuses: signals.map(signalProviderStatus),
    };
  },
};

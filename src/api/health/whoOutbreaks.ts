import { z } from 'zod';
import type {
  HealthGeography,
  HealthSignal,
  HealthSignalProvider,
  HealthSignalProviderContext,
} from '../../models/healthSignals';
import {
  OUTBREAK_EVENT_FRESHNESS,
  calculateHealthSignalFreshness,
} from '../../services/healthSignalFreshness';
import {
  HealthProviderSchemaError,
  fetchHealthJson,
  providerErrorSignal,
  signalProviderStatus,
} from './providerFetch';

const WHO_DISEASE_OUTBREAK_NEWS_ENDPOINT =
  'https://www.who.int/api/emergencies/diseaseoutbreaknews';
const WHO_DISEASE_OUTBREAK_NEWS_ROWS = 50;

const WHO_OUTBREAK_SIGNAL_TYPES = ['outbreak-event'] as const;

const whoOutbreakResponseSchema = z
  .object({
    value: z.array(z.record(z.string(), z.unknown())),
  })
  .passthrough();

const whoOutbreakRowSchema = z
  .object({
    Id: z.string().optional().nullable(),
    DonId: z.string().optional().nullable(),
    LastModified: z.string().optional().nullable(),
    PublicationDate: z.string().optional().nullable(),
    PublicationDateAndTime: z.string().optional().nullable(),
    Title: z.string().optional().nullable(),
    OverrideTitle: z.string().optional().nullable(),
    TitleSuffix: z.string().optional().nullable(),
    Summary: z.string().optional().nullable(),
    ItemDefaultUrl: z.string().optional().nullable(),
  })
  .passthrough();

type WhoOutbreakRow = z.infer<typeof whoOutbreakRowSchema>;

const COUNTRY_ALIASES: Partial<Record<string, readonly string[]>> = {
  CD: ['Democratic Republic of the Congo', 'DRC', 'Congo'],
  CZ: ['Czechia', 'Czech Republic'],
  GB: ['United Kingdom', 'UK', 'Great Britain'],
  US: ['United States', 'United States of America', 'USA', 'U.S.'],
};

function stripHtmlTags(value: string): string {
  let output = '';
  let insideTag = false;
  for (const char of value) {
    if (char === '<') {
      insideTag = true;
      output += ' ';
      continue;
    }
    if (char === '>') {
      insideTag = false;
      output += ' ';
      continue;
    }
    if (!insideTag) output += char;
  }
  return output;
}

function normalizedText(value: string | null | undefined): string {
  return stripHtmlTags(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/&[a-z]+;/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function countryDisplayName(countryCode: string | undefined): string | null {
  if (!countryCode) return null;
  try {
    return new Intl.DisplayNames(['en'], { type: 'region' }).of(countryCode) ?? null;
  } catch {
    return null;
  }
}

function geographyMatchTerms(geography: HealthGeography): string[] {
  const terms = [
    geography.name,
    geography.countryName,
    countryDisplayName(geography.countryCode ?? geography.code),
    ...(geography.countryCode ? (COUNTRY_ALIASES[geography.countryCode] ?? []) : []),
  ];
  return [...new Set(terms.flatMap((term) => (term ? [normalizedText(term)] : [])))].filter(
    Boolean,
  );
}

function textContainsTerm(text: string, term: string): boolean {
  return new RegExp(`(^|\\s)${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(\\s|$)`).test(text);
}

function titleText(row: WhoOutbreakRow): string {
  return row.OverrideTitle?.trim() || row.Title?.trim() || row.DonId?.trim() || '';
}

function diseaseLabel(title: string): string | undefined {
  const separator = title.indexOf(' - ');
  if (separator <= 0) return undefined;
  return title.slice(0, separator).trim() || undefined;
}

function isGlobalEvent(row: WhoOutbreakRow): boolean {
  const text = normalizedText([titleText(row), row.TitleSuffix].join(' '));
  return (
    textContainsTerm(text, 'global') ||
    textContainsTerm(text, 'worldwide') ||
    textContainsTerm(text, 'multi country')
  );
}

function matchesGeography(row: WhoOutbreakRow, geography: HealthGeography): boolean {
  if (isGlobalEvent(row)) return true;

  const text = normalizedText([titleText(row), row.TitleSuffix, row.Summary].join(' '));
  return geographyMatchTerms(geography).some((term) => textContainsTerm(text, term));
}

function outbreakGeography(row: WhoOutbreakRow, geography: HealthGeography): HealthGeography {
  if (isGlobalEvent(row)) {
    return { level: 'supranational', code: 'global', name: 'Global' };
  }

  return geography;
}

function rowTimestamp(row: WhoOutbreakRow): string | null {
  const timestamp = row.PublicationDateAndTime ?? row.PublicationDate ?? row.LastModified;
  if (!timestamp || !Number.isFinite(Date.parse(timestamp))) return null;
  return timestamp;
}

function sourceUrl(row: WhoOutbreakRow): string | undefined {
  if (!row.ItemDefaultUrl) return undefined;
  return row.ItemDefaultUrl.startsWith('http')
    ? row.ItemDefaultUrl
    : `https://www.who.int/emergencies/disease-outbreak-news/item${row.ItemDefaultUrl}`;
}

function unavailableSignal(input: { geography: HealthGeography; now: string }): HealthSignal {
  return {
    id: `who-don:${input.geography.countryCode ?? input.geography.code}:unavailable`,
    domain: 'biological',
    type: 'outbreak-event',
    geography: input.geography,
    updatedAt: input.now,
    category: 'unknown',
    trend: 'unknown',
    source: {
      provider: 'WHO Disease Outbreak News',
      dataset: 'diseaseoutbreaknews',
      measure: 'Geographically relevant disease outbreak news',
    },
    freshness: { status: 'stale', ageMs: Number.POSITIVE_INFINITY },
    temporalClass: 'current',
    metadata: {
      unavailable: true,
      reason: 'no-relevant-who-outbreak-events',
      semantics: 'Missing outbreak events are not interpreted as no disease activity.',
      noPersonalRiskInference: true,
    },
  };
}

function signalFromRow(input: {
  row: WhoOutbreakRow;
  geography: HealthGeography;
  now: string;
}): HealthSignal | null {
  const publishedAt = rowTimestamp(input.row);
  const title = titleText(input.row);
  if (!publishedAt || !title || !matchesGeography(input.row, input.geography)) return null;

  const geography = outbreakGeography(input.row, input.geography);
  const eventId = input.row.DonId?.trim() || input.row.Id?.trim() || title;

  return {
    id: `who-don:${geography.countryCode ?? geography.code ?? 'global'}:${eventId}`,
    domain: 'biological',
    type: 'outbreak-event',
    geography,
    observedAt: publishedAt,
    updatedAt: publishedAt,
    category: 'unknown',
    trend: 'unknown',
    source: {
      provider: 'WHO Disease Outbreak News',
      dataset: 'diseaseoutbreaknews',
      measure: 'Disease Outbreak News event publication',
    },
    freshness: calculateHealthSignalFreshness({
      updatedAt: publishedAt,
      now: input.now,
      policy: OUTBREAK_EVENT_FRESHNESS,
    }),
    temporalClass: 'current',
    metadata: {
      eventId,
      title,
      disease: diseaseLabel(title),
      sourceUrl: sourceUrl(input.row),
      surveillanceBasis: 'WHO disease outbreak event publication',
      noPersonalRiskInference: true,
    },
  };
}

export function whoOutbreaksUrl(): string {
  const url = new URL(WHO_DISEASE_OUTBREAK_NEWS_ENDPOINT);
  url.searchParams.set('$top', String(WHO_DISEASE_OUTBREAK_NEWS_ROWS));
  url.searchParams.set('$orderby', 'PublicationDateAndTime desc');
  return url.toString();
}

export function normalizeWhoOutbreakSignals(input: {
  payload: unknown;
  geography: HealthGeography;
  now: string;
}): HealthSignal[] {
  const parsed = whoOutbreakResponseSchema.safeParse(input.payload);
  if (!parsed.success) throw new HealthProviderSchemaError('Invalid WHO outbreak response');

  const signals = parsed.data.value
    .flatMap((row) => {
      const parsedRow = whoOutbreakRowSchema.safeParse(row);
      return parsedRow.success ? [parsedRow.data] : [];
    })
    .flatMap((row) => signalFromRow({ row, geography: input.geography, now: input.now }) ?? []);
  const deduped = new Map(signals.map((signal) => [signal.id, signal]));

  return deduped.size > 0 ? [...deduped.values()] : [unavailableSignal(input)];
}

export const whoOutbreakProvider: HealthSignalProvider = {
  id: 'who-outbreaks',
  access: 'anonymous',
  coverage: 'global',
  authority: 'global-authority',
  regions: ['global'],
  signals: WHO_OUTBREAK_SIGNAL_TYPES,
  temporalClasses: ['current'],
  documentationUrl: 'https://www.who.int/api/emergencies/diseaseoutbreaknews/sfhelp',
  supports: (context: HealthSignalProviderContext) =>
    context.geography !== null &&
    (context.signalTypes === undefined || context.signalTypes.includes('outbreak-event')),
  fetchSignals: async (context) => {
    if (!context.geography) {
      return {
        providerId: 'who-outbreaks',
        fetchedAt: context.now,
        signals: [],
        unavailableSignals: ['outbreak-event'],
      };
    }

    let signals: HealthSignal[];
    try {
      signals = normalizeWhoOutbreakSignals({
        payload: await fetchHealthJson(whoOutbreaksUrl()),
        geography: context.geography,
        now: context.now,
      });
    } catch (error) {
      signals = [
        providerErrorSignal({
          id: `who-don:${context.geography.countryCode ?? context.geography.code}:provider-error`,
          domain: 'biological',
          type: 'outbreak-event',
          geography: context.geography,
          now: context.now,
          source: {
            provider: 'WHO Disease Outbreak News',
            dataset: 'diseaseoutbreaknews',
            measure: 'Geographically relevant disease outbreak news',
          },
          reason: 'who-outbreak-provider-error',
          error,
        }),
      ];
    }

    return {
      providerId: 'who-outbreaks',
      fetchedAt: context.now,
      signals,
      unavailableSignals: signals.every((signal) => signal.metadata?.unavailable === true)
        ? ['outbreak-event']
        : undefined,
      signalStatuses: signals.map(signalProviderStatus),
    };
  },
};

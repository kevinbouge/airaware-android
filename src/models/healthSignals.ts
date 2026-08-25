export type HealthSignalDomain = 'environmental' | 'biological' | 'population-health';

export type HealthSignalCategory = 'low' | 'moderate' | 'high' | 'very-high' | 'unknown';

export type HealthSignalTrend = 'falling' | 'stable' | 'rising' | 'unknown';

export type GeographyLevel = 'local' | 'subregion' | 'region' | 'country' | 'supranational';

export type BiologicalSignalType = 'influenza' | 'covid-19' | 'rsv';

export type HealthSignalType = BiologicalSignalType | 'excess-mortality';

export type HealthSignalFreshnessStatus = 'fresh' | 'aging' | 'stale';

export type ReportingPeriod =
  | {
      type: 'week';
      year: number;
      week: number;
    }
  | {
      type: 'month';
      year: number;
      month: number;
    };

export interface HealthGeography {
  level: GeographyLevel;
  code?: string | undefined;
  name: string;
  countryCode?: string | undefined;
  countryName?: string | undefined;
  providerCodes?: {
    eurostat?: string | undefined;
    who?: string | undefined;
    whoEurope?: string | undefined;
  };
}

export interface HealthSignalObservation {
  pathogen?: BiologicalSignalType | undefined;
  period: ReportingPeriod;
  periodStart?: string | undefined;
  periodEnd?: string | undefined;
  observedAt?: string | undefined;
  updatedAt?: string | undefined;
  measure?: string | undefined;
  value: number;
  unit: string;
  source?: {
    provider: string;
    dataset?: string | undefined;
    measure?: string | undefined;
  };
  status?: string | undefined;
}

export interface BiologicalEvidence {
  pathogen: BiologicalSignalType;
  provider: 'who' | 'cdc' | 'ecdc';
  geography: HealthGeography;
  reportingPeriod: ReportingPeriod;
  periodStart?: string | undefined;
  periodEnd?: string | undefined;
  measure: string;
  value?: number | undefined;
  unit?: string | undefined;
  category?: HealthSignalCategory | undefined;
  trend?: HealthSignalTrend | undefined;
  updatedAt?: string | undefined;
  sourceDataset?: string | undefined;
  sourceMeasureCode?: string | undefined;
}

export interface HealthSignal {
  id: string;
  domain: HealthSignalDomain;
  type: HealthSignalType;
  geography: HealthGeography;
  observedAt?: string | undefined;
  periodStart?: string | undefined;
  periodEnd?: string | undefined;
  reportingPeriod?: ReportingPeriod | undefined;
  updatedAt: string;
  value?: number | undefined;
  unit?: string | undefined;
  category: HealthSignalCategory;
  trend: HealthSignalTrend;
  source: {
    provider: string;
    dataset?: string | undefined;
    measure?: string | undefined;
  };
  freshness: {
    status: HealthSignalFreshnessStatus;
    ageMs?: number | undefined;
  };
  history?: HealthSignalObservation[] | undefined;
  evidence?: BiologicalEvidence[] | undefined;
  metadata?: Record<string, unknown> | undefined;
}

export interface HealthSignalProviderContext {
  geography: HealthGeography;
  now: string;
  signalTypes?: HealthSignalType[] | undefined;
}

export interface HealthSignalProviderResult {
  providerId: string;
  fetchedAt: string;
  signals: HealthSignal[];
  unavailableSignals?: HealthSignalType[] | undefined;
}

export interface HealthSignalProvider {
  id: string;
  supports: (context: HealthSignalProviderContext) => boolean;
  fetchSignals: (context: HealthSignalProviderContext) => Promise<HealthSignalProviderResult>;
}

export interface CachedHealthSignals {
  version: 1;
  savedAt: string;
  cacheKey: string;
  geography: HealthGeography;
  signals: HealthSignal[];
}

export interface HealthSignalsState {
  geography: HealthGeography | null;
  signals: HealthSignal[];
  loading: boolean;
  error: string | null;
  updatedAt: string | null;
}

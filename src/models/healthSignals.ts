export type HealthSignalDomain =
  'environmental' | 'biological' | 'population-health' | 'radiological';

export type RadiologicalStatus = 'normal-background' | 'elevated' | 'strongly-elevated' | 'unknown';

export type ThermalStressCategory =
  | 'extreme-cold-stress'
  | 'very-strong-cold-stress'
  | 'strong-cold-stress'
  | 'moderate-cold-stress'
  | 'slight-cold-stress'
  | 'no-thermal-stress'
  | 'moderate-heat-stress'
  | 'strong-heat-stress'
  | 'very-strong-heat-stress'
  | 'extreme-heat-stress'
  | 'no-thermal-strain'
  | 'cold-strain'
  | 'moderate-heat-strain'
  | 'high-heat-strain'
  | 'very-high-heat-strain';

export type HealthSignalCategory =
  'low' | 'moderate' | 'high' | 'very-high' | RadiologicalStatus | ThermalStressCategory;

export type HealthSignalTrend = 'falling' | 'stable' | 'rising' | 'unknown';

type GeographyLevel = 'local' | 'subregion' | 'region' | 'country' | 'supranational';

type RespiratorySignalType = 'influenza' | 'covid-19' | 'rsv';

export type WastewaterSignalType =
  'wastewater-covid-19' | 'wastewater-influenza' | 'wastewater-rsv';

type VectorDiseaseSignalType = 'dengue' | 'west-nile' | 'malaria' | 'tick-borne-disease';

export type BiologicalSignalType =
  RespiratorySignalType | WastewaterSignalType | VectorDiseaseSignalType;

type RadiologicalSignalType = 'ambient-dose-rate';

type EnvironmentalHealthSignalType = 'thermal-stress' | 'measured-mold-spores';

export type HealthSignalType =
  | BiologicalSignalType
  | EnvironmentalHealthSignalType
  | 'excess-mortality'
  | RadiologicalSignalType;

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
    }
  | {
      type: 'year';
      year: number;
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

interface HealthSignalCoordinates {
  latitude: number;
  longitude: number;
}

export interface HealthSignalObservation {
  pathogen?: BiologicalSignalType | undefined;
  period?: ReportingPeriod | undefined;
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

export interface RadiologicalEvidence {
  type: RadiologicalSignalType;
  provider: 'safecast' | 'radnet' | 'eurdep';
  value: number;
  unit: string;
  measuredAt: string;
  latitude?: number | undefined;
  longitude?: number | undefined;
  distanceKm?: number | undefined;
  sensorId?: string | undefined;
  measurementId?: string | undefined;
  role?: 'current' | 'baseline-sample' | 'provider-evidence' | undefined;
  rawMeasurementType?: string | undefined;
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
  evidence?: (BiologicalEvidence | RadiologicalEvidence)[] | undefined;
  metadata?: Record<string, unknown> | undefined;
}

export interface HealthSignalProviderContext {
  geography: HealthGeography | null;
  coordinates?: HealthSignalCoordinates | undefined;
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

type GlobalContinent =
  | 'africa'
  | 'asia'
  | 'europe'
  | 'middle-east'
  | 'north-america'
  | 'oceania'
  | 'south-america';

export interface GlobalTestLocation {
  id: string;
  name: string;
  country: string;
  continent: GlobalContinent;
  latitude: number;
  longitude: number;
  coverageTags: readonly string[];
}

export type CoverageExpectation = 'required' | 'expected' | 'optional' | 'unsupported';

export type CoverageStatus =
  | 'available'
  | 'partial'
  | 'no-data'
  | 'unsupported'
  | 'aging'
  | 'stale'
  | 'provider-error';

export type CoverageDomain = 'environmental' | 'biological' | 'population-health' | 'radiological';

export interface SignalCoverageDefinition {
  domain: CoverageDomain;
  signal: string;
  defaultExpectation: CoverageExpectation;
  expectations?: Partial<Record<string, CoverageExpectation>> | undefined;
  noDataBehavior: 'unavailable' | 'omit';
}

export interface CoverageResult {
  locationId: string;
  domain: CoverageDomain;
  signal: string;
  expectation: CoverageExpectation;
  status: CoverageStatus;
  provider?: string | undefined;
  observedAt?: string | undefined;
  updatedAt?: string | undefined;
  calculationMethod?: string | undefined;
  reportingGeography?: string | undefined;
  notes?: string | undefined;
}

export interface GlobalCoverageReport {
  generatedAt: string;
  locations: GlobalTestLocation[];
  results: CoverageResult[];
}

export function isCoverageFailure(result: CoverageResult): boolean {
  if (result.status === 'provider-error') return result.expectation !== 'optional';
  if (result.expectation === 'required') {
    return result.status !== 'available' && result.status !== 'partial';
  }
  if (result.expectation === 'unsupported') {
    return result.status === 'available';
  }

  return false;
}

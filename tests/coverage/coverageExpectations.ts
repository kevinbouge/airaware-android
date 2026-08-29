import type {
  CoverageDomain,
  CoverageExpectation,
  GlobalTestLocation,
  SignalCoverageDefinition,
} from './coverageTypes';

export const GLOBAL_CORE_ENVIRONMENTAL_SIGNALS = [
  'temperature',
  'humidity',
  'wind',
  'precipitation',
  'pm2_5',
  'pm10',
  'uv',
] as const;

const ENVIRONMENTAL_COVERAGE_DEFINITIONS: readonly SignalCoverageDefinition[] = [
  ...GLOBAL_CORE_ENVIRONMENTAL_SIGNALS.map((signal) => ({
    domain: 'environmental' as const,
    signal,
    defaultExpectation: 'required' as const,
    noDataBehavior: 'unavailable' as const,
  })),
  {
    domain: 'environmental',
    signal: 'thermal-stress',
    defaultExpectation: 'expected',
    noDataBehavior: 'unavailable',
  },
  {
    domain: 'environmental',
    signal: 'utci',
    defaultExpectation: 'expected',
    noDataBehavior: 'unavailable',
  },
  {
    domain: 'environmental',
    signal: 'thermal-fallback',
    defaultExpectation: 'optional',
    noDataBehavior: 'unavailable',
  },
  {
    domain: 'environmental',
    signal: 'pollen',
    defaultExpectation: 'optional',
    expectations: {
      prague: 'expected',
      paris: 'expected',
      helsinki: 'expected',
    },
    noDataBehavior: 'omit',
  },
  {
    domain: 'environmental',
    signal: 'saharan-dust',
    defaultExpectation: 'optional',
    expectations: {
      prague: 'expected',
      paris: 'expected',
      cairo: 'expected',
      dubai: 'expected',
      delhi: 'expected',
    },
    noDataBehavior: 'omit',
  },
  {
    domain: 'environmental',
    signal: 'wildfire-attributed-pm10',
    defaultExpectation: 'optional',
    noDataBehavior: 'omit',
  },
];

const BIOLOGICAL_COVERAGE_DEFINITIONS: readonly SignalCoverageDefinition[] = [
  {
    domain: 'biological',
    signal: 'wastewater-covid-19',
    defaultExpectation: 'optional',
    expectations: {
      'new-york': 'expected',
      austin: 'expected',
      honolulu: 'expected',
    },
    noDataBehavior: 'unavailable',
  },
  {
    domain: 'biological',
    signal: 'wastewater-influenza',
    defaultExpectation: 'optional',
    expectations: {
      'new-york': 'expected',
      austin: 'expected',
      honolulu: 'expected',
    },
    noDataBehavior: 'unavailable',
  },
  {
    domain: 'biological',
    signal: 'wastewater-rsv',
    defaultExpectation: 'optional',
    expectations: {
      'new-york': 'expected',
      austin: 'expected',
      honolulu: 'expected',
    },
    noDataBehavior: 'unavailable',
  },
  {
    domain: 'biological',
    signal: 'dengue',
    defaultExpectation: 'optional',
    noDataBehavior: 'unavailable',
  },
  {
    domain: 'biological',
    signal: 'west-nile',
    defaultExpectation: 'optional',
    expectations: {
      'new-york': 'expected',
      austin: 'expected',
    },
    noDataBehavior: 'unavailable',
  },
  {
    domain: 'biological',
    signal: 'malaria',
    defaultExpectation: 'optional',
    expectations: {
      nairobi: 'expected',
      delhi: 'expected',
      mumbai: 'expected',
    },
    noDataBehavior: 'omit',
  },
  {
    domain: 'biological',
    signal: 'tick-borne-disease',
    defaultExpectation: 'optional',
    noDataBehavior: 'unavailable',
  },
  {
    domain: 'environmental',
    signal: 'measured-mold-spores',
    defaultExpectation: 'optional',
    noDataBehavior: 'unavailable',
  },
  {
    domain: 'biological',
    signal: 'influenza',
    defaultExpectation: 'expected',
    noDataBehavior: 'unavailable',
  },
  {
    domain: 'biological',
    signal: 'covid-19',
    defaultExpectation: 'optional',
    noDataBehavior: 'unavailable',
  },
  {
    domain: 'biological',
    signal: 'rsv',
    defaultExpectation: 'expected',
    noDataBehavior: 'unavailable',
  },
];

const POPULATION_HEALTH_COVERAGE_DEFINITIONS: readonly SignalCoverageDefinition[] = [
  {
    domain: 'population-health',
    signal: 'excess-mortality',
    defaultExpectation: 'expected',
    expectations: {
      prague: 'expected',
      paris: 'expected',
      helsinki: 'expected',
      reykjavik: 'expected',
    },
    noDataBehavior: 'unavailable',
  },
];

const RADIOLOGICAL_COVERAGE_DEFINITIONS: readonly SignalCoverageDefinition[] = [
  {
    domain: 'radiological',
    signal: 'ambient-dose-rate',
    defaultExpectation: 'optional',
    noDataBehavior: 'unavailable',
  },
];

const COVERAGE_DEFINITIONS = [
  ...ENVIRONMENTAL_COVERAGE_DEFINITIONS,
  ...BIOLOGICAL_COVERAGE_DEFINITIONS,
  ...POPULATION_HEALTH_COVERAGE_DEFINITIONS,
  ...RADIOLOGICAL_COVERAGE_DEFINITIONS,
] as const;

export function expectationForSignal(input: {
  domain: CoverageDomain;
  signal: string;
  location: GlobalTestLocation;
}): CoverageExpectation {
  const definition = COVERAGE_DEFINITIONS.find(
    (entry) => entry.domain === input.domain && entry.signal === input.signal,
  );

  return definition?.expectations?.[input.location.id] ?? definition?.defaultExpectation ?? 'optional';
}

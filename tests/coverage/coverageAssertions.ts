import type { NormalizedEnvironment } from '../../src/models/environment';
import type { HealthSignal } from '../../src/models/healthSignals';
import { thermalStressSignalFromEnvironment } from '../../src/core/thermalStress';
import { healthSignalTemporalClass } from '../../src/services/healthSignalFreshness';
import type { CoverageResult, CoverageStatus, GlobalTestLocation } from './coverageTypes';
import { expectationForSignal, GLOBAL_CORE_ENVIRONMENTAL_SIGNALS } from './coverageExpectations';

function finiteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

export function expectNoInvalidNumbers(value: unknown): void {
  if (typeof value === 'number') {
    expect(Number.isFinite(value)).toBe(true);
    return;
  }
  if (!value || typeof value !== 'object') return;
  if (Array.isArray(value)) {
    value.forEach(expectNoInvalidNumbers);
    return;
  }

  Object.values(value).forEach(expectNoInvalidNumbers);
}

export function environmentalCoverageResults(input: {
  location: GlobalTestLocation;
  environment: NormalizedEnvironment;
}): CoverageResult[] {
  const current = input.environment.current;
  const thermalSignal = thermalStressSignalFromEnvironment({
    environment: input.environment,
    now: input.environment.fetchedAt,
  });
  const thermalMetric = thermalSignal?.metadata?.metric;
  const valueBySignal: Record<string, number | null> = {
    temperature: current.weather.temperature,
    humidity: current.weather.relativeHumidity,
    wind: current.weather.windSpeed,
    precipitation: current.weather.precipitation,
    pm2_5: current.regulatedPollutants.pm25,
    pm10: current.regulatedPollutants.pm10,
    uv: current.uvIndex,
    'thermal-stress': thermalSignal?.value ?? null,
    utci: thermalMetric === 'utci' ? (thermalSignal?.value ?? null) : null,
    'thermal-fallback':
      thermalMetric === 'apparent-temperature' ? (thermalSignal?.value ?? null) : null,
    pollen: Math.max(
      ...Object.values(current.pollen).filter(finiteNumber),
      Number.NEGATIVE_INFINITY,
    ),
    'measured-mold-spores': null,
    'saharan-dust': current.atmosphericIrritants.dust,
    'wildfire-attributed-pm10': current.atmosphericIrritants.wildfirePm10,
  };

  return Object.entries(valueBySignal).map(([signal, value]) => {
    const isThermalSignal =
      signal === 'thermal-stress' || signal === 'utci' || signal === 'thermal-fallback';
    const calculationMethod =
      isThermalSignal && typeof thermalMetric === 'string' ? thermalMetric : undefined;
    return {
      locationId: input.location.id,
      region: input.location.continent,
      domain: 'environmental',
      signal,
      expectation: expectationForSignal({
        domain: 'environmental',
        signal,
        location: input.location,
      }),
      status: finiteNumber(value) ? 'available' : 'no-data',
      provider: 'Open-Meteo',
      observedAt: current.timestamp ?? undefined,
      updatedAt: input.environment.fetchedAt,
      calculationMethod,
      notes:
        signal === 'utci' && thermalMetric === 'apparent-temperature'
          ? 'UTCI not emitted because validated mean radiant temperature is unavailable.'
          : undefined,
    };
  });
}

export function expectCoreEnvironmentalCoverage(environment: NormalizedEnvironment): void {
  GLOBAL_CORE_ENVIRONMENTAL_SIGNALS.forEach((signal) => {
    const result = environmentalCoverageResults({
      location: {
        id: 'fixture',
        name: 'Fixture',
        country: 'CZ',
        continent: 'europe',
        latitude: 50,
        longitude: 14,
        coverageTags: [],
      },
      environment,
    }).find((entry) => entry.signal === signal);

    expect(result?.status).toBe('available');
  });
}

function signalCoverageStatus(signal: HealthSignal | null | undefined): CoverageStatus {
  if (!signal) return 'unsupported';
  if (signal.metadata?.providerStatus === 'provider-error') return 'provider-error';
  if (signal.metadata?.unavailable === true) return 'no-data';
  if (signal.freshness.status === 'aging') return 'aging';
  if (signal.freshness.status === 'stale') return 'stale';
  if (signal.value === undefined || signal.value === null) return 'partial';
  return 'available';
}

function signalCoverageNotes(signal: HealthSignal | null | undefined): string | undefined {
  if (signal?.metadata?.providerStatus === 'provider-error') {
    const kind =
      typeof signal.metadata.providerErrorKind === 'string'
        ? ` kind=${signal.metadata.providerErrorKind}`
        : '';
    const statusCode =
      typeof signal.metadata.providerStatusCode === 'number'
        ? ` status=${signal.metadata.providerStatusCode}`
        : '';
    return `Provider returned an explicit provider-error signal.${kind}${statusCode}`;
  }
  if (signal?.metadata?.unavailable === true) {
    return 'Provider returned an explicit unavailable/no-data signal.';
  }
  return undefined;
}

export function healthSignalCoverageResult(input: {
  location: GlobalTestLocation;
  signal: HealthSignal | null | undefined;
  domain: CoverageResult['domain'];
  signalName: string;
}): CoverageResult {
  return {
    locationId: input.location.id,
    region: input.location.continent,
    domain: input.domain,
    signal: input.signalName,
    expectation: expectationForSignal({
      domain: input.domain,
      signal: input.signalName,
      location: input.location,
    }),
    status: signalCoverageStatus(input.signal),
    freshness: input.signal?.freshness.status,
    temporalClass: input.signal ? healthSignalTemporalClass(input.signal) : undefined,
    provider: input.signal?.source.provider,
    observedAt: input.signal?.observedAt,
    updatedAt: input.signal?.updatedAt,
    calculationMethod:
      typeof input.signal?.metadata?.calculationMethod === 'string'
        ? input.signal.metadata.calculationMethod
        : undefined,
    reportingGeography: input.signal?.geography.name,
    notes: signalCoverageNotes(input.signal),
  };
}

export function expectUnavailableIsNotLowOrNormal(signal: HealthSignal): void {
  if (signal.metadata?.unavailable !== true) return;

  expect(signal.category).toBe('unknown');
  expect(signal.category).not.toBe('low');
  expect(signal.category).not.toBe('normal-background');
}

import type {
  HealthSignal,
  HealthSignalFreshnessStatus,
  HealthSignalTemporalClass,
  HealthSignalTrend,
} from '../models/healthSignals';
import { millisecondsBetween } from '../utils/time';

export interface HealthSignalFreshnessPolicy {
  expectedUpdateIntervalMs: number;
  agingAfterMs: number;
  staleAfterMs: number;
}

export const RESPIRATORY_SURVEILLANCE_FRESHNESS: HealthSignalFreshnessPolicy = {
  expectedUpdateIntervalMs: 7 * 24 * 60 * 60 * 1000,
  agingAfterMs: 10 * 24 * 60 * 60 * 1000,
  staleAfterMs: 21 * 24 * 60 * 60 * 1000,
};

export const EXCESS_MORTALITY_FRESHNESS: HealthSignalFreshnessPolicy = {
  expectedUpdateIntervalMs: 30 * 24 * 60 * 60 * 1000,
  agingAfterMs: 75 * 24 * 60 * 60 * 1000,
  staleAfterMs: 120 * 24 * 60 * 60 * 1000,
};

export const OWID_EXCESS_MORTALITY_FRESHNESS: HealthSignalFreshnessPolicy = {
  expectedUpdateIntervalMs: 7 * 24 * 60 * 60 * 1000,
  agingAfterMs: 21 * 24 * 60 * 60 * 1000,
  staleAfterMs: 60 * 24 * 60 * 60 * 1000,
};

export const RADIATION_MONITORING_FRESHNESS: HealthSignalFreshnessPolicy = {
  expectedUpdateIntervalMs: 6 * 60 * 60 * 1000,
  agingAfterMs: 30 * 24 * 60 * 60 * 1000,
  staleAfterMs: 180 * 24 * 60 * 60 * 1000,
};

export const THERMAL_STRESS_FRESHNESS: HealthSignalFreshnessPolicy = {
  expectedUpdateIntervalMs: 3 * 60 * 60 * 1000,
  agingAfterMs: 12 * 60 * 60 * 1000,
  staleAfterMs: 36 * 60 * 60 * 1000,
};

export const WASTEWATER_SURVEILLANCE_FRESHNESS: HealthSignalFreshnessPolicy = {
  expectedUpdateIntervalMs: 7 * 24 * 60 * 60 * 1000,
  agingAfterMs: 14 * 24 * 60 * 60 * 1000,
  staleAfterMs: 35 * 24 * 60 * 60 * 1000,
};

export const VECTOR_SURVEILLANCE_FRESHNESS: HealthSignalFreshnessPolicy = {
  expectedUpdateIntervalMs: 365 * 24 * 60 * 60 * 1000,
  agingAfterMs: 540 * 24 * 60 * 60 * 1000,
  staleAfterMs: 730 * 24 * 60 * 60 * 1000,
};

export const DENGUE_CLUSTER_SURVEILLANCE_FRESHNESS: HealthSignalFreshnessPolicy = {
  expectedUpdateIntervalMs: 7 * 24 * 60 * 60 * 1000,
  agingAfterMs: 14 * 24 * 60 * 60 * 1000,
  staleAfterMs: 45 * 24 * 60 * 60 * 1000,
};

const MEASURED_SPORE_SURVEILLANCE_FRESHNESS: HealthSignalFreshnessPolicy = {
  expectedUpdateIntervalMs: 24 * 60 * 60 * 1000,
  agingAfterMs: 3 * 24 * 60 * 60 * 1000,
  staleAfterMs: 7 * 24 * 60 * 60 * 1000,
};

export const OUTBREAK_EVENT_FRESHNESS: HealthSignalFreshnessPolicy = {
  expectedUpdateIntervalMs: 7 * 24 * 60 * 60 * 1000,
  agingAfterMs: 21 * 24 * 60 * 60 * 1000,
  staleAfterMs: 45 * 24 * 60 * 60 * 1000,
};

export function healthSignalTemporalClass(
  signal: Pick<HealthSignal, 'temporalClass' | 'type'>,
): HealthSignalTemporalClass {
  if (signal.temporalClass) return signal.temporalClass;
  if (signal.type === 'excess-mortality' || signal.type === 'malaria') return 'background';
  return 'current';
}

export function freshnessPolicyForHealthSignal(signal: Pick<HealthSignal, 'source' | 'type'>) {
  if (signal.type === 'thermal-stress') return THERMAL_STRESS_FRESHNESS;
  if (signal.type === 'ambient-dose-rate') return RADIATION_MONITORING_FRESHNESS;
  if (
    signal.type === 'wastewater-covid-19' ||
    signal.type === 'wastewater-influenza' ||
    signal.type === 'wastewater-rsv'
  ) {
    return WASTEWATER_SURVEILLANCE_FRESHNESS;
  }
  if (signal.type === 'outbreak-event') return OUTBREAK_EVENT_FRESHNESS;
  if (
    signal.type === 'dengue' ||
    signal.type === 'chikungunya' ||
    signal.type === 'west-nile' ||
    signal.type === 'tick-borne-disease'
  ) {
    return DENGUE_CLUSTER_SURVEILLANCE_FRESHNESS;
  }
  if (signal.type === 'malaria') return VECTOR_SURVEILLANCE_FRESHNESS;
  if (signal.type === 'measured-mold-spores') return MEASURED_SPORE_SURVEILLANCE_FRESHNESS;
  if (signal.type === 'excess-mortality') {
    return signal.source.provider === 'Our World in Data'
      ? OWID_EXCESS_MORTALITY_FRESHNESS
      : EXCESS_MORTALITY_FRESHNESS;
  }
  return RESPIRATORY_SURVEILLANCE_FRESHNESS;
}

function healthSignalObservationTimestamp(signal: HealthSignal): string {
  return signal.periodEnd ?? signal.observedAt ?? signal.updatedAt;
}

export function evaluateHealthSignalFreshness(signal: HealthSignal, now: string) {
  return calculateHealthSignalFreshness({
    updatedAt: healthSignalObservationTimestamp(signal),
    now,
    policy: freshnessPolicyForHealthSignal(signal),
  });
}

export function isCurrentContextEligible(signal: HealthSignal): boolean {
  return (
    healthSignalTemporalClass(signal) === 'current' &&
    signal.metadata?.unavailable !== true &&
    signal.metadata?.providerStatus !== 'provider-error' &&
    signal.freshness.status !== 'stale'
  );
}

function sourceScopeRank(signal: HealthSignal): number {
  if (signal.geography.level === 'local') return 4;
  if (signal.geography.level === 'subregion' || signal.geography.level === 'region') return 3;
  if (signal.source.provider === 'WHO GISRS / FluNet') return 2;
  if (signal.source.provider === 'WHO Disease Outbreak News') return 2;
  if (signal.geography.level === 'country') return 1;
  return 0;
}

function freshnessRank(signal: HealthSignal): number {
  if (signal.metadata?.unavailable === true) return 0;
  if (signal.freshness.status === 'fresh') return 3;
  if (signal.freshness.status === 'aging') return 2;
  return 1;
}

function reportingTime(signal: HealthSignal): number {
  const parsed = Date.parse(healthSignalObservationTimestamp(signal));
  return Number.isFinite(parsed) ? parsed : 0;
}

export function resolveBestHealthObservation(
  left: HealthSignal,
  right: HealthSignal,
): HealthSignal {
  const ranks: [number, number][] = [
    [isCurrentContextEligible(left) ? 1 : 0, isCurrentContextEligible(right) ? 1 : 0],
    [freshnessRank(left), freshnessRank(right)],
    [sourceScopeRank(left), sourceScopeRank(right)],
    [reportingTime(left), reportingTime(right)],
  ];

  for (const [leftRank, rightRank] of ranks) {
    if (leftRank !== rightRank) return leftRank > rightRank ? left : right;
  }

  return left;
}

export function resolveBestHealthSignalCandidate(
  signals: readonly HealthSignal[],
): HealthSignal | null {
  return signals.reduce<HealthSignal | null>(
    (best, signal) => (best ? resolveBestHealthObservation(best, signal) : signal),
    null,
  );
}

export function calculateHealthSignalFreshness(input: {
  updatedAt: string;
  now: string;
  policy: HealthSignalFreshnessPolicy;
}): { status: HealthSignalFreshnessStatus; ageMs: number } {
  const updatedAt = Date.parse(input.updatedAt);
  const now = Date.parse(input.now);
  if (!Number.isFinite(updatedAt) || !Number.isFinite(now)) {
    return { status: 'stale', ageMs: Number.POSITIVE_INFINITY };
  }

  const ageMs = Math.max(0, millisecondsBetween(now, updatedAt));
  if (ageMs > input.policy.staleAfterMs) return { status: 'stale', ageMs };
  if (ageMs > input.policy.agingAfterMs) return { status: 'aging', ageMs };
  return { status: 'fresh', ageMs };
}

export function calculateComparableTrend(input: {
  current: number | null | undefined;
  previous: number | null | undefined;
  minimumAbsoluteChange: number;
}): HealthSignalTrend {
  if (
    input.current === null ||
    input.current === undefined ||
    input.previous === null ||
    input.previous === undefined ||
    !Number.isFinite(input.current) ||
    !Number.isFinite(input.previous)
  ) {
    return 'unknown';
  }

  const delta = input.current - input.previous;
  if (Math.abs(delta) < input.minimumAbsoluteChange) return 'stable';
  return delta > 0 ? 'rising' : 'falling';
}

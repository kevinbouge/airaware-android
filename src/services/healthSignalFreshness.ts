import { differenceInMilliseconds } from 'date-fns';
import type { HealthSignalFreshnessStatus, HealthSignalTrend } from '../models/healthSignals';

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
  expectedUpdateIntervalMs: 90 * 24 * 60 * 60 * 1000,
  agingAfterMs: 120 * 24 * 60 * 60 * 1000,
  staleAfterMs: 240 * 24 * 60 * 60 * 1000,
};

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

  const ageMs = Math.max(0, differenceInMilliseconds(new Date(now), new Date(updatedAt)));
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

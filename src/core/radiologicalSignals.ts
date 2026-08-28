import type {
  HealthSignalObservation,
  RadiologicalEvidence,
  RadiologicalStatus,
} from '../models/healthSignals';

export const RADIATION_SEARCH_RADII_METERS = [25_000, 100_000, 250_000] as const;
export const RADIATION_QUERY_LIMIT = 200;
export const RADIATION_BASELINE_PERIOD_DAYS = 30;
export const RADIATION_BASELINE_MIN_SAMPLES = 8;
const RADIATION_TREND_MIN_CHANGE_USV_H = 0.02;
const RADIATION_MAX_MEANINGFUL_DISTANCE_METERS = 250_000;

const USV_PER_NSV = 0.001;
const USV_PER_MSV = 1000;
const MAX_REASONABLE_DOSE_RATE_USV_H = 1_000_000;

export interface NormalizedRadiationDoseRate {
  value: number;
  unit: 'µSv/h';
  originalValue: number;
  originalUnit: string;
}

export interface RadiologicalObservation {
  type: 'ambient-dose-rate';
  value: number;
  unit: 'µSv/h';
  measuredAt: string;
  sensor: {
    providerId: string;
    latitude: number;
    longitude: number;
    distanceKm: number;
  };
  source: {
    provider: 'safecast';
    dataset?: string | undefined;
  };
  rawMeasurementType?: string | undefined;
  measurementId?: string | undefined;
}

export interface RadiationBaseline {
  median: number;
  mad?: number | undefined;
  sampleCount: number;
  periodDays: number;
}

export interface RadiationInterpretation {
  status: RadiologicalStatus;
  baseline?: RadiationBaseline | undefined;
  ratioToBaseline?: number | undefined;
}

function canonicalUnit(unit: string): string {
  return unit.trim().toLowerCase().replace('μ', 'µ');
}

export function normalizeDoseRate(value: number, unit: string): NormalizedRadiationDoseRate | null {
  if (!Number.isFinite(value) || value < 0) {
    return null;
  }

  const normalizedUnit = canonicalUnit(unit);
  let normalizedValue: number | null = null;
  if (normalizedUnit === 'µsv/h' || normalizedUnit === 'usv/h') {
    normalizedValue = value;
  }
  if (normalizedUnit === 'nsv/h') {
    normalizedValue = value * USV_PER_NSV;
  }
  if (normalizedUnit === 'msv/h') {
    normalizedValue = value * USV_PER_MSV;
  }
  if (normalizedValue === null || normalizedValue > MAX_REASONABLE_DOSE_RATE_USV_H) {
    return null;
  }

  return { value: normalizedValue, unit: 'µSv/h', originalValue: value, originalUnit: unit };
}

function ageMs(measuredAt: string, now: string): number {
  const measuredTime = Date.parse(measuredAt);
  const nowTime = Date.parse(now);
  if (!Number.isFinite(measuredTime) || !Number.isFinite(nowTime)) {
    return Number.POSITIVE_INFINITY;
  }

  return Math.max(0, nowTime - measuredTime);
}

function uniqByMeasurement(observations: RadiologicalObservation[]): RadiologicalObservation[] {
  const seen = new Set<string>();
  const unique: RadiologicalObservation[] = [];

  observations.forEach((observation) => {
    const key =
      observation.measurementId ??
      [
        observation.sensor.providerId,
        observation.measuredAt,
        observation.value.toFixed(6),
        observation.sensor.latitude.toFixed(6),
        observation.sensor.longitude.toFixed(6),
      ].join(':');
    if (seen.has(key)) return;
    seen.add(key);
    unique.push(observation);
  });

  return unique;
}

export function selectBestRadiologicalObservation(input: {
  observations: RadiologicalObservation[];
  now: string;
  staleAfterMs: number;
}): RadiologicalObservation | null {
  const valid = uniqByMeasurement(input.observations).filter(
    (observation) =>
      ageMs(observation.measuredAt, input.now) <= input.staleAfterMs &&
      observation.sensor.distanceKm * 1000 <= RADIATION_MAX_MEANINGFUL_DISTANCE_METERS,
  );
  if (valid.length === 0) return null;

  const selected = [...valid].sort((left, right) => {
    const leftAge = ageMs(left.measuredAt, input.now);
    const rightAge = ageMs(right.measuredAt, input.now);
    const ageDelta = leftAge - rightAge;
    if (Math.abs(ageDelta) > 24 * 60 * 60 * 1000) return ageDelta;

    return left.sensor.distanceKm - right.sensor.distanceKm;
  })[0];

  return selected ?? null;
}

function median(values: number[]): number {
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[middle] as number;

  return ((sorted[middle - 1] as number) + (sorted[middle] as number)) / 2;
}

export function calculateRadiationBaseline(input: {
  observations: RadiologicalObservation[];
  now: string;
  periodDays?: number | undefined;
  minimumSamples?: number | undefined;
  sensorId?: string | undefined;
  before?: string | undefined;
}): RadiationBaseline | null {
  const periodDays = input.periodDays ?? RADIATION_BASELINE_PERIOD_DAYS;
  const minimumSamples = input.minimumSamples ?? RADIATION_BASELINE_MIN_SAMPLES;
  const maxAgeMs = periodDays * 24 * 60 * 60 * 1000;
  const beforeTime = input.before ? Date.parse(input.before) : null;
  const candidates = uniqByMeasurement(input.observations)
    .filter((observation) =>
      input.sensorId ? observation.sensor.providerId === input.sensorId : true,
    )
    .filter((observation) => {
      const observedTime = Date.parse(observation.measuredAt);
      if (
        beforeTime !== null &&
        (!Number.isFinite(beforeTime) ||
          !Number.isFinite(observedTime) ||
          observedTime >= beforeTime)
      ) {
        return false;
      }
      const age = ageMs(observation.measuredAt, input.now);
      return age <= maxAgeMs && age >= 0;
    });

  if (candidates.length < minimumSamples) return null;

  const values = candidates.map((observation) => observation.value);
  const baselineMedian = median(values);
  const deviations = values.map((value) => Math.abs(value - baselineMedian));
  const mad = median(deviations);

  return {
    median: baselineMedian,
    mad,
    sampleCount: candidates.length,
    periodDays,
  };
}

export function interpretRadiation(input: {
  current: number;
  baseline: RadiationBaseline | null;
}): RadiationInterpretation {
  const baseline = input.baseline ?? undefined;
  if (!baseline || baseline.median <= 0) {
    if (input.current >= 5) return { status: 'strongly-elevated' };
    if (input.current >= 1) return { status: 'elevated' };
    return { status: 'unknown' };
  }

  const ratioToBaseline = input.current / baseline.median;
  const robustSigma = (baseline.mad ?? 0) * 1.4826;
  const moderateDeviation = Math.max(3 * robustSigma, 0.05);
  const strongDeviation = Math.max(6 * robustSigma, 0.1);
  const delta = input.current - baseline.median;

  if (input.current >= 0.5 && ratioToBaseline >= 3 && delta >= strongDeviation) {
    return { status: 'strongly-elevated', baseline, ratioToBaseline };
  }
  if (input.current >= 0.15 && ratioToBaseline >= 1.75 && delta >= moderateDeviation) {
    return { status: 'elevated', baseline, ratioToBaseline };
  }

  return { status: 'normal-background', baseline, ratioToBaseline };
}

export function calculateRadiationTrend(input: {
  current: RadiologicalObservation;
  observations: RadiologicalObservation[];
}): 'falling' | 'stable' | 'rising' | 'unknown' {
  const currentTime = Date.parse(input.current.measuredAt);
  const comparable = uniqByMeasurement(input.observations)
    .filter((observation) => observation.sensor.providerId === input.current.sensor.providerId)
    .filter((observation) => observation.measuredAt !== input.current.measuredAt)
    .filter((observation) => {
      const observedTime = Date.parse(observation.measuredAt);
      return (
        Number.isFinite(currentTime) && Number.isFinite(observedTime) && observedTime < currentTime
      );
    })
    .sort((left, right) => Date.parse(right.measuredAt) - Date.parse(left.measuredAt));
  const previous = comparable[0];
  if (!previous) return 'unknown';

  const delta = input.current.value - previous.value;
  if (Math.abs(delta) < RADIATION_TREND_MIN_CHANGE_USV_H) return 'stable';
  return delta > 0 ? 'rising' : 'falling';
}

export function radiologicalObservationToEvidence(
  observation: RadiologicalObservation,
): RadiologicalEvidence {
  return {
    type: 'ambient-dose-rate',
    provider: 'safecast',
    value: observation.value,
    unit: observation.unit,
    measuredAt: observation.measuredAt,
    latitude: observation.sensor.latitude,
    longitude: observation.sensor.longitude,
    distanceKm: observation.sensor.distanceKm,
    sensorId: observation.sensor.providerId,
    measurementId: observation.measurementId,
    role: 'current',
    rawMeasurementType: observation.rawMeasurementType,
  };
}

export function radiologicalObservationToHistory(
  observation: RadiologicalObservation,
): HealthSignalObservation {
  return {
    observedAt: observation.measuredAt,
    updatedAt: observation.measuredAt,
    measure: 'Ambient dose rate',
    value: observation.value,
    unit: observation.unit,
    source: {
      provider: 'Safecast',
      dataset: 'Safecast radiation measurements',
      measure: observation.rawMeasurementType,
    },
  };
}

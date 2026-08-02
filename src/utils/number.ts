export function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

export function nullableNumber(value: unknown): number | null {
  return isFiniteNumber(value) && value >= 0 ? value : null;
}

export function coordinateNumber(value: unknown): number | null {
  return isFiniteNumber(value) ? value : null;
}

export function clamp(value: number, min = 0, max = 100): number {
  return Math.min(max, Math.max(min, value));
}

export function displayScore(value: number | null): number | null {
  return isFiniteNumber(value) ? Math.round(clamp(value)) : null;
}

export function weightedAverage(
  components: { score: number | null; weight: number; id: string }[],
): {
  score: number | null;
  effectiveWeights: Record<string, number>;
  missing: string[];
  completeness: number;
} {
  const available = components.filter((component) => isFiniteNumber(component.score));
  const missing = components
    .filter((component) => !isFiniteNumber(component.score))
    .map((component) => component.id);
  const availableWeight = available.reduce((sum, component) => sum + component.weight, 0);
  const totalWeight = components.reduce((sum, component) => sum + component.weight, 0);

  if (available.length === 0 || availableWeight <= 0) {
    return {
      score: null,
      effectiveWeights: {},
      missing,
      completeness: 0,
    };
  }

  const score = available.reduce(
    (sum, component) => sum + (component.score ?? 0) * (component.weight / availableWeight),
    0,
  );

  return {
    score: clamp(score),
    effectiveWeights: Object.fromEntries(
      available.map((component) => [component.id, component.weight / availableWeight]),
    ),
    missing,
    completeness: totalWeight > 0 ? availableWeight / totalWeight : 0,
  };
}

export function normalizeByThresholds(
  value: number | null,
  thresholds: readonly { value: number; score: number }[],
): number | null {
  if (!isFiniteNumber(value)) {
    return null;
  }

  if (value <= 0) {
    return 0;
  }

  let previousValue = 0;
  let previousScore = 0;

  for (const threshold of thresholds) {
    if (value <= threshold.value) {
      const span = threshold.value - previousValue;
      const ratio = span <= 0 ? 1 : (value - previousValue) / span;
      return clamp(previousScore + ratio * (threshold.score - previousScore));
    }

    previousValue = threshold.value;
    previousScore = threshold.score;
  }

  return 100;
}

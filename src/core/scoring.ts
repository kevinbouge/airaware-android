import {
  ATMOSPHERIC_IRRITANT_WEIGHTS,
  ENVIRONMENTAL_WEIGHTS,
  POLLEN_THRESHOLDS,
  RAW_POLLUTANT_THRESHOLDS,
} from './constants';
import { categoryFromScore } from './categories';
import type {
  AtmosphericIrritants,
  CurrentEnvironmentalReadings,
  EnvironmentalScoreResult,
  MoldPotential,
  PollenReadings,
  PollutantAqi,
  RegulatedPollutants,
  RiskCategoryId,
  ScoreComponent,
} from '../models/environment';
import {
  clamp,
  displayScore,
  isFiniteNumber,
  normalizeByThresholds,
  weightedAverage,
} from '../utils/number';

type PollenKey = keyof PollenReadings;
type PollutantKey = keyof RegulatedPollutants;
type IrritantKey = keyof AtmosphericIrritants;

function component(score: number | null, missing: string[], dominantId?: string): ScoreComponent {
  const available = isFiniteNumber(score);

  return {
    available,
    score: available ? clamp(score) : null,
    displayScore: available ? displayScore(score) : null,
    category: available ? categoryFromScore(score) : 'unavailable',
    dominantId,
    missing,
    completeness: missing.length === 0 ? 1 : 0,
  };
}

function maxScore(values: { id: string; score: number | null }[]): {
  score: number | null;
  dominantId?: string;
  missing: string[];
  completeness: number;
} {
  const available = values.filter((value) => isFiniteNumber(value.score));
  const missing = values.filter((value) => !isFiniteNumber(value.score)).map((value) => value.id);

  if (available.length === 0) {
    return { score: null, missing, completeness: 0 };
  }

  const dominant = available.reduce((best, item) =>
    (item.score ?? 0) > (best.score ?? 0) ? item : best,
  );

  return {
    score: dominant.score,
    dominantId: dominant.id,
    missing,
    completeness: available.length / values.length,
  };
}

function calculatePollenBurden(value: number | null, type: PollenKey): number | null {
  return normalizeByThresholds(value, POLLEN_THRESHOLDS[type]);
}

export function calculatePollenComponent(
  pollen: PollenReadings,
  selectedTypes: PollenKey[] = ['alder', 'birch', 'grass', 'mugwort', 'olive', 'ragweed'],
): ScoreComponent {
  const result = maxScore(
    selectedTypes.map((type) => ({
      id: `pollen_${type}`,
      score: calculatePollenBurden(pollen[type], type),
    })),
  );
  const scoreComponent = component(result.score, result.missing, result.dominantId);
  scoreComponent.completeness = result.completeness;
  return scoreComponent;
}

function calculatePollutantBurden(
  aqiValue: number | null,
  rawValue: number | null,
  pollutant: PollutantKey,
): number | null {
  if (isFiniteNumber(aqiValue)) {
    return clamp(aqiValue);
  }

  return normalizeByThresholds(rawValue, RAW_POLLUTANT_THRESHOLDS[pollutant]);
}

export function calculateRegulatedPollutionComponent(
  pollutantAqi: PollutantAqi,
  rawPollutants: RegulatedPollutants,
  selectedTypes: PollutantKey[] = ['pm25', 'pm10', 'nitrogenDioxide', 'ozone', 'sulphurDioxide'],
): ScoreComponent {
  const result = maxScore(
    selectedTypes.map((type) => ({
      id: type,
      score: calculatePollutantBurden(pollutantAqi[type], rawPollutants[type], type),
    })),
  );
  const scoreComponent = component(result.score, result.missing, result.dominantId);
  scoreComponent.completeness = result.completeness;
  return scoreComponent;
}

export function calculateAtmosphericIrritantsComponent(
  irritants: AtmosphericIrritants,
  selectedTypes: IrritantKey[] = ['carbonMonoxide', 'aerosolOpticalDepth', 'dust', 'wildfirePm10'],
): ScoreComponent {
  const weights = selectedTypes.map((type) => ({
    id: type,
    score: normalizeByThresholds(irritants[type], RAW_POLLUTANT_THRESHOLDS[type]),
    weight: ATMOSPHERIC_IRRITANT_WEIGHTS[type],
  }));
  const result = weightedAverage(weights);
  const scoreComponent = component(result.score, result.missing);
  scoreComponent.completeness = result.completeness;
  return scoreComponent;
}

export function componentFromMold(mold: MoldPotential): ScoreComponent {
  return {
    available: mold.available,
    score: mold.available ? mold.score : null,
    displayScore: mold.available ? mold.displayScore : null,
    category: mold.available ? mold.category : 'unavailable',
    missing: mold.available ? [] : ['mold'],
    completeness: mold.completeness,
  };
}

function dominantComponent(components: Record<string, ScoreComponent>): string | null {
  let dominant: { id: string; score: number } | null = null;

  for (const id of Object.keys(components)) {
    const score = components[id]?.score;

    if (!isFiniteNumber(score)) continue;

    if (!dominant || score > dominant.score) {
      dominant = { id, score };
    }
  }

  return dominant?.id ?? null;
}

export function calculateEnvironmentalScore(
  readings: CurrentEnvironmentalReadings,
): EnvironmentalScoreResult {
  const components = {
    pollen: calculatePollenComponent(readings.pollen),
    regulatedPollution: calculateRegulatedPollutionComponent(
      readings.pollutantAqi,
      readings.regulatedPollutants,
    ),
    atmosphericIrritants: calculateAtmosphericIrritantsComponent(readings.atmosphericIrritants),
    mold: componentFromMold(readings.moldPotential),
  };
  const weighted = weightedAverage([
    { id: 'pollen', score: components.pollen.score, weight: ENVIRONMENTAL_WEIGHTS.pollen },
    {
      id: 'regulatedPollution',
      score: components.regulatedPollution.score,
      weight: ENVIRONMENTAL_WEIGHTS.regulatedPollution,
    },
    {
      id: 'atmosphericIrritants',
      score: components.atmosphericIrritants.score,
      weight: ENVIRONMENTAL_WEIGHTS.atmosphericIrritants,
    },
    { id: 'mold', score: components.mold.score, weight: ENVIRONMENTAL_WEIGHTS.mold },
  ]);
  const available = isFiniteNumber(weighted.score);
  const score = available ? weighted.score : null;

  return {
    available,
    score,
    displayScore: displayScore(score),
    category: available ? categoryFromScore(score) : ('unavailable' as RiskCategoryId),
    components,
    effectiveWeights: weighted.effectiveWeights,
    missingComponents: weighted.missing,
    completeness: weighted.completeness,
    dominantComponent: dominantComponent(components),
  };
}

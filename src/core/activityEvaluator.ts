import {
  ACTIVITY_DEFINITIONS,
  activityCategoryLabel,
  activityVariableValue,
  categoryForActivityScore,
  enabledActivityIds,
  type ActivityDefinition,
  type ActivityRuleDefinition,
} from './activityDefinitions';
import type {
  ActivityEvaluationInput,
  ActivityEvaluationResult,
  ActivityFactorResult,
  ActivityHourResult,
  ActivityId,
  ActivityWindowResult,
} from '../models/activities';
import type { EnvironmentalVariableId } from '../capabilities/types';
import type { HourlyEnvironmentalReading } from '../models/environment';
import { isFiniteNumber } from '../utils/number';
import { providerLocalTime } from '../utils/time';

export { activityCategoryLabel, activityVariableValue } from './activityDefinitions';

const HOUR_MS = 60 * 60 * 1000;
const NEAR_BEST_SCORE_TOLERANCE = 5;

function categoryRank(category: ActivityHourResult['category']): number {
  switch (category) {
    case 'excellent':
      return 5;
    case 'good':
      return 4;
    case 'fair':
      return 3;
    case 'poor':
      return 2;
    case 'unsuitable':
      return 1;
    case 'insufficientData':
      return 0;
  }
}

function bounded(value: number): number {
  return Math.max(0, Math.min(100, value));
}

function localHour(timestamp: string): number | null {
  const match = /T(\d{2}):/.exec(timestamp);
  if (!match) return null;
  const hour = Number(match[1]);
  return Number.isInteger(hour) && hour >= 0 && hour <= 23 ? hour : null;
}

function scoreHighAtLeast(value: number, goodAt: number, poorAt: number): number {
  if (value >= goodAt) return 100;
  if (value <= poorAt) return 0;
  return bounded(((value - poorAt) / (goodAt - poorAt)) * 100);
}

function scoreLowAtMost(value: number, goodAt: number, poorAt: number): number {
  if (value <= goodAt) return 100;
  if (value >= poorAt) return 0;
  return bounded(100 - ((value - goodAt) / (poorAt - goodAt)) * 100);
}

function scoreRange(value: number, min: number, max: number): number {
  if (value >= min && value <= max) return 100;

  const span = Math.max(1, max - min);
  if (value < min) return bounded(100 - ((min - value) / span) * 100);
  return bounded(100 - ((value - max) / span) * 100);
}

function scoreTimeRule(rule: ActivityRuleDefinition, timestamp: string): number {
  const hour = localHour(timestamp);
  if (hour === null) return 50;

  if (rule.kind === 'outsideDaylight') {
    if (hour < 6 || hour >= 21) return 100;
    if (hour < 8 || hour >= 19) return 55;
    return 0;
  }

  if (rule.kind === 'goldenHour') {
    return (hour >= 6 && hour <= 8) || (hour >= 18 && hour <= 21) ? 100 : 45;
  }

  return 50;
}

function scoreRuleValue(rule: ActivityRuleDefinition, value: number): number {
  if (rule.hardMaximum !== undefined && value > rule.hardMaximum) return 0;
  if (rule.hardMinimum !== undefined && value < rule.hardMinimum) return 0;

  switch (rule.kind) {
    case 'highAtLeast':
      return scoreHighAtLeast(value, rule.goodAt ?? 100, rule.poorAt ?? 0);
    case 'lowAtMost':
      return scoreLowAtMost(value, rule.goodAt ?? 0, rule.poorAt ?? 100);
    case 'range':
      return scoreRange(value, rule.min ?? 0, rule.max ?? 100);
    case 'outsideDaylight':
    case 'goldenHour':
      return 50;
  }
}

function factorExplanation(rule: ActivityRuleDefinition, score: number): string {
  return score >= 70 ? rule.positiveText : rule.negativeText;
}

function evaluateRule(
  rule: ActivityRuleDefinition,
  hour: HourlyEnvironmentalReading,
): ActivityFactorResult {
  if (!rule.variableId) {
    const score = scoreTimeRule(rule, hour.timestamp);
    return {
      id: rule.id,
      label: rule.label,
      score,
      available: true,
      required: rule.required === true,
      explanation: factorExplanation(rule, score),
    };
  }

  const value = activityVariableValue(hour, rule.variableId);
  if (!isFiniteNumber(value)) {
    return {
      id: rule.id,
      label: rule.label,
      score: null,
      available: false,
      required: rule.required === true,
      explanation: null,
    };
  }

  const score = scoreRuleValue(rule, value);
  return {
    id: rule.id,
    label: rule.label,
    score,
    available: true,
    required: rule.required === true,
    explanation: factorExplanation(rule, score),
  };
}

function missingRequiredVariables(
  definition: ActivityDefinition,
  hour: HourlyEnvironmentalReading,
): EnvironmentalVariableId[] {
  return definition.requiredVariables.filter((variableId) => {
    const value = activityVariableValue(hour, variableId);
    return !isFiniteNumber(value);
  });
}

function evaluateActivityHour(
  definition: ActivityDefinition,
  hour: HourlyEnvironmentalReading,
): ActivityHourResult {
  const missing = missingRequiredVariables(definition, hour);
  const factors = definition.rules.map((rule) => evaluateRule(rule, hour));

  if (missing.length > 0) {
    return {
      timestamp: hour.timestamp,
      available: false,
      score: null,
      displayScore: null,
      category: 'insufficientData',
      factors,
      missingRequiredVariables: missing,
    };
  }

  const weighted = factors.flatMap((factor) => {
    if (!factor.available || !isFiniteNumber(factor.score)) return [];
    const rule = definition.rules.find((candidate) => candidate.id === factor.id);
    return rule ? [{ score: factor.score, weight: rule.weight }] : [];
  });
  const totalWeight = weighted.reduce((sum, item) => sum + item.weight, 0);
  const score =
    totalWeight > 0
      ? weighted.reduce((sum, item) => sum + item.score * item.weight, 0) / totalWeight
      : null;

  return {
    timestamp: hour.timestamp,
    available: isFiniteNumber(score),
    score,
    displayScore: isFiniteNumber(score) ? Math.round(score) : null,
    category: categoryForActivityScore(score),
    factors,
    missingRequiredVariables: [],
  };
}

function endTimeFor(startTime: string, durationHours: number): string | null {
  const parsed = Date.parse(startTime);
  if (!Number.isFinite(parsed)) return null;

  const match = startTime.match(/^(\d{4}-\d{2}-\d{2})T\d{2}:\d{2}(:\d{2})?([+-]\d{2}:\d{2})?$/);
  if (!match) return new Date(parsed + durationHours * HOUR_MS).toISOString();

  const offset = match[3] ?? '';
  const shifted = new Date(parsed + durationHours * HOUR_MS);
  const offsetMinutes =
    offset.length > 0
      ? Number(offset.slice(1, 3)) * 60 + Number(offset.slice(4, 6))
      : -shifted.getTimezoneOffset();
  const signedOffsetMinutes = offset.startsWith('-') ? -offsetMinutes : offsetMinutes;
  const local = new Date(shifted.getTime() + signedOffsetMinutes * 60 * 1000);

  return `${local.toISOString().slice(0, 16)}${offset}`;
}

function bestActivityCategory(hours: ActivityHourResult[]): ActivityHourResult['category'] | null {
  return hours
    .filter((hour) => hour.available && isFiniteNumber(hour.score))
    .map((hour) => hour.category)
    .reduce<ActivityHourResult['category'] | null>(
      (best, category) =>
        best === null || categoryRank(category) > categoryRank(best) ? category : best,
      null,
    );
}

function bestActivityScore(
  hours: ActivityHourResult[],
  category: ActivityHourResult['category'],
): number | null {
  const scores = hours
    .filter((hour) => hour.available && hour.category === category && isFiniteNumber(hour.score))
    .map((hour) => hour.score!)
    .sort((left, right) => right - left);

  return scores[0] ?? null;
}

function isNearBestActivityHour(
  hour: ActivityHourResult | undefined,
  category: ActivityHourResult['category'],
  bestScore: number,
): hour is ActivityHourResult {
  return (
    hour !== undefined &&
    hour.available &&
    hour.category === category &&
    isFiniteNumber(hour.score) &&
    hour.score >= bestScore - NEAR_BEST_SCORE_TOLERANCE
  );
}

function sameCategoryRun(
  hours: ActivityHourResult[],
  startIndex: number,
  category: ActivityHourResult['category'],
  bestScore: number,
) {
  const first = hours[startIndex];
  if (!isNearBestActivityHour(first, category, bestScore)) return null;

  const run = [first];
  let previousTime = Date.parse(first.timestamp);
  if (!Number.isFinite(previousTime)) return null;

  for (let index = startIndex + 1; index < hours.length; index += 1) {
    const hour = hours[index]!;
    const time = Date.parse(hour.timestamp);
    if (
      !hour.available ||
      !Number.isFinite(time) ||
      Math.abs(time - previousTime - HOUR_MS) > 10 * 60 * 1000 ||
      !isNearBestActivityHour(hour, category, bestScore)
    ) {
      break;
    }

    run.push(hour);
    previousTime = time;
  }

  const scores = run.map((hour) => hour.score).filter(isFiniteNumber);
  if (scores.length !== run.length) return null;

  return {
    startTime: run[0]!.timestamp,
    endTime: endTimeFor(run[0]!.timestamp, run.length),
    averageScore: scores.reduce((sum, score) => sum + score, 0) / scores.length,
    minimumScore: Math.min(...scores),
    category,
    durationHours: run.length,
  };
}

function unavailableWindow(): ActivityWindowResult {
  return {
    available: false,
    startTime: null,
    endTime: null,
    averageScore: null,
    minimumScore: null,
    category: 'insufficientData',
  };
}

function selectBestWindow(
  candidates: {
    startTime: string;
    endTime: string | null;
    averageScore: number;
    minimumScore: number;
    category: ActivityHourResult['category'];
    durationHours: number;
  }[],
): ActivityWindowResult {
  const complete = candidates.filter((candidate) => candidate.endTime !== null);
  const best = complete.sort((left, right) => {
    const categoryDifference = categoryRank(right.category) - categoryRank(left.category);
    if (categoryDifference !== 0) return categoryDifference;
    if (right.durationHours !== left.durationHours) return right.durationHours - left.durationHours;
    if (right.averageScore !== left.averageScore) return right.averageScore - left.averageScore;
    if (right.minimumScore !== left.minimumScore) return right.minimumScore - left.minimumScore;
    return Date.parse(left.startTime) - Date.parse(right.startTime);
  })[0];

  if (!best?.endTime) return unavailableWindow();

  return {
    available: true,
    startTime: best.startTime,
    endTime: best.endTime,
    averageScore: best.averageScore,
    minimumScore: best.minimumScore,
    category: best.category,
  };
}

function bestActivityWindow(hours: ActivityHourResult[]): ActivityWindowResult {
  const category = bestActivityCategory(hours);
  if (!category) return unavailableWindow();

  const bestScore = bestActivityScore(hours, category);
  if (!isFiniteNumber(bestScore)) return unavailableWindow();

  const candidates = hours.flatMap((_, index) => {
    const candidate = sameCategoryRun(hours, index, category, bestScore);
    return candidate ? [candidate] : [];
  });

  return selectBestWindow(candidates);
}

export function bestActivityWindowForDate(
  hours: ActivityHourResult[],
  date: string,
): ActivityWindowResult {
  const dayHours = hours.filter((hour) => hour.timestamp.slice(0, 10) === date);
  const category = bestActivityCategory(dayHours);
  if (!category) return unavailableWindow();

  const bestScore = bestActivityScore(dayHours, category);
  if (!isFiniteNumber(bestScore)) return unavailableWindow();

  const candidates = hours.flatMap((hour, index) => {
    if (hour.timestamp.slice(0, 10) !== date) return [];
    const candidate = sameCategoryRun(hours, index, category, bestScore);
    return candidate ? [candidate] : [];
  });

  return selectBestWindow(candidates);
}

export function bestActivityWindowForRange(
  hours: ActivityHourResult[],
  startTime: string,
  rangeHours: number,
): ActivityWindowResult {
  const start = Date.parse(startTime);
  if (!Number.isFinite(start)) return unavailableWindow();

  const end = start + rangeHours * HOUR_MS;
  const rangeHoursOnly = hours.filter((hour) => {
    const time = Date.parse(hour.timestamp);
    return Number.isFinite(time) && time >= start && time <= end;
  });

  return bestActivityWindow(rangeHoursOnly);
}

function reasonsFor(current: ActivityHourResult | null, limit = 4): string[] {
  if (!current?.available) return ['Insufficient data'];

  return current.factors
    .filter((factor) => factor.available && factor.explanation)
    .sort((left, right) => (left.score ?? 0) - (right.score ?? 0))
    .slice(0, limit)
    .map((factor) => factor.explanation!)
    .filter((reason, index, reasons) => reasons.indexOf(reason) === index);
}

function explanationHour(
  hours: ActivityHourResult[],
  current: ActivityHourResult | null,
  bestWindow: ActivityWindowResult,
): ActivityHourResult | null {
  if (bestWindow.available && bestWindow.startTime) {
    return hours.find((hour) => hour.timestamp === bestWindow.startTime) ?? current;
  }

  return current;
}

function futureHours(input: ActivityEvaluationInput): HourlyEnvironmentalReading[] {
  const now = Date.parse(input.now);
  const safeNow = Number.isFinite(now) ? now : Date.now();
  const forecastDates = input.forecastDates?.filter((date) => /^\d{4}-\d{2}-\d{2}$/.test(date));

  if (forecastDates && forecastDates.length > 0) {
    const dateSet = new Set(forecastDates);
    return input.hourly.filter((hour) => {
      const time = Date.parse(hour.timestamp);
      return Number.isFinite(time) && time >= safeNow && dateSet.has(hour.timestamp.slice(0, 10));
    });
  }

  const end = safeNow + 48 * HOUR_MS;

  return input.hourly.filter((hour) => {
    const time = Date.parse(hour.timestamp);
    return Number.isFinite(time) && time >= safeNow && time <= end;
  });
}

export function evaluateActivity(
  definition: ActivityDefinition,
  input: ActivityEvaluationInput,
): ActivityEvaluationResult {
  const hours = futureHours(input).map((hour) => evaluateActivityHour(definition, hour));
  const current = hours.find((hour) => hour.available) ?? hours[0] ?? null;
  const bestWindow = bestActivityWindow(hours);
  const reasonHour = explanationHour(hours, current, bestWindow);

  return {
    id: definition.id,
    label: definition.label,
    description: definition.description,
    enabled: input.enabledActivities[definition.id],
    available: current?.available === true || bestWindow.available,
    current,
    hours,
    bestWindow,
    reasons: reasonsFor(reasonHour),
    detailVariables: [...definition.detailVariables],
  };
}

export function evaluateActivities(input: ActivityEvaluationInput): ActivityEvaluationResult[] {
  const enabled = new Set<ActivityId>(enabledActivityIds(input.enabledActivities));

  return ACTIVITY_DEFINITIONS.filter((definition) => enabled.has(definition.id)).map((definition) =>
    evaluateActivity(definition, input),
  );
}

export function formatActivityWindow(window: ActivityWindowResult): string {
  if (!window.available || !window.startTime || !window.endTime) return 'Unavailable';
  const start = providerLocalTime(window.startTime);
  const end = providerLocalTime(window.endTime);
  return start && end ? `${start}–${end}` : 'Unavailable';
}

export function formatActivityScore(result: ActivityEvaluationResult): string {
  if (!result.current?.available || !isFiniteNumber(result.current.displayScore)) {
    return activityCategoryLabel('insufficientData');
  }

  return `${activityCategoryLabel(result.current.category)} · ${result.current.displayScore}%`;
}

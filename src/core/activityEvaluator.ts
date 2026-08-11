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

function endTimeFor(startTime: string, windowHours: number): string | null {
  const parsed = Date.parse(startTime);
  if (!Number.isFinite(parsed)) return null;

  const match = startTime.match(/^(\d{4}-\d{2}-\d{2})T\d{2}:\d{2}(:\d{2})?([+-]\d{2}:\d{2})?$/);
  if (!match) return new Date(parsed + windowHours * HOUR_MS).toISOString();

  const offset = match[3] ?? '';
  const shifted = new Date(parsed + windowHours * HOUR_MS);
  const offsetMinutes =
    offset.length > 0
      ? Number(offset.slice(1, 3)) * 60 + Number(offset.slice(4, 6))
      : -shifted.getTimezoneOffset();
  const signedOffsetMinutes = offset.startsWith('-') ? -offsetMinutes : offsetMinutes;
  const local = new Date(shifted.getTime() + signedOffsetMinutes * 60 * 1000);

  return `${local.toISOString().slice(0, 16)}${offset}`;
}

function contiguousWindow(hours: ActivityHourResult[], startIndex: number, windowHours: number) {
  const window = hours.slice(startIndex, startIndex + windowHours);
  if (window.length !== windowHours || window.some((hour) => !hour.available)) return null;

  const parsed = window.map((hour) => Date.parse(hour.timestamp));
  if (parsed.some((time) => !Number.isFinite(time))) return null;

  for (let index = 1; index < parsed.length; index += 1) {
    if (Math.abs(parsed[index]! - parsed[index - 1]! - HOUR_MS) > 10 * 60 * 1000) return null;
  }

  const scores = window.map((hour) => hour.score).filter(isFiniteNumber);
  if (scores.length !== windowHours) return null;

  return {
    startTime: window[0]!.timestamp,
    endTime: endTimeFor(window[0]!.timestamp, windowHours),
    averageScore: scores.reduce((sum, score) => sum + score, 0) / scores.length,
    minimumScore: Math.min(...scores),
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
  }[],
): ActivityWindowResult {
  const complete = candidates.filter((candidate) => candidate.endTime !== null);
  const best = complete.sort((left, right) => {
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
    category: categoryForActivityScore(best.averageScore),
  };
}

function bestActivityWindow(
  hours: ActivityHourResult[],
  windowHours: number,
): ActivityWindowResult {
  const candidates = hours.flatMap((_, index) => {
    const candidate = contiguousWindow(hours, index, windowHours);
    return candidate ? [candidate] : [];
  });

  return selectBestWindow(candidates);
}

export function bestActivityWindowForDate(
  hours: ActivityHourResult[],
  date: string,
  windowHours: number,
): ActivityWindowResult {
  const candidates = hours.flatMap((hour, index) => {
    if (hour.timestamp.slice(0, 10) !== date) return [];
    const candidate = contiguousWindow(hours, index, windowHours);
    return candidate ? [candidate] : [];
  });

  return selectBestWindow(candidates);
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
  const bestWindow = bestActivityWindow(hours, definition.windowHours);
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

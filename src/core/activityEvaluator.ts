import {
  activityCategoryLabel,
  activityVariableValue,
  categoryForActivityScore,
  enabledActivityProfiles,
  activityProfilesForDomain,
  type ActivityProfileDefinition,
  type ActivityRuleDefinition,
} from './activityDefinitions';
import type {
  ActivityDataCompleteness,
  ActivityDomainId,
  ActivityEvaluationInput,
  ActivityEvaluationResult,
  ActivityFactorResult,
  ActivityHourResult,
  ActivityWindowResult,
} from '../models/activities';
import type { EnvironmentalVariableId } from '../capabilities/types';
import type { HourlyEnvironmentalReading } from '../models/environment';
import { isFiniteNumber } from '../utils/number';
import { formatTimeRangeWithTomorrow } from '../utils/format';

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

function violatesHardConstraint(rule: ActivityRuleDefinition, value: number): boolean {
  if (rule.hardMaximum !== undefined && value > rule.hardMaximum) return true;
  if (rule.hardMinimum !== undefined && value < rule.hardMinimum) return true;
  return false;
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
      hardConstraintViolated: false,
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
      hardConstraintViolated: false,
    };
  }

  const score = scoreRuleValue(rule, value);
  const hardConstraintViolated = violatesHardConstraint(rule, value);
  return {
    id: rule.id,
    label: rule.label,
    score,
    available: true,
    required: rule.required === true,
    explanation: factorExplanation(rule, score),
    hardConstraintViolated,
  };
}

function missingRequiredVariables(
  definition: ActivityProfileDefinition,
  hour: HourlyEnvironmentalReading,
): EnvironmentalVariableId[] {
  return definition.requiredVariables.filter((variableId) => {
    const value = activityVariableValue(hour, variableId);
    return !isFiniteNumber(value);
  });
}

function completenessFor(
  factors: readonly ActivityFactorResult[],
  missingRequiredCount: number,
): ActivityDataCompleteness {
  const expectedFactors = factors.length;
  const availableFactors = factors.filter((factor) => factor.available).length;
  const requiredFactorsExpected = factors.filter((factor) => factor.required).length;
  const requiredFactorsAvailable = Math.max(0, requiredFactorsExpected - missingRequiredCount);
  const coverageRatio = expectedFactors > 0 ? availableFactors / expectedFactors : 1;
  let status: ActivityDataCompleteness['status'] = 'complete';
  if (missingRequiredCount > 0) {
    status = 'insufficient';
  } else if (availableFactors < expectedFactors) {
    status = 'reduced';
  }

  return {
    availableFactors,
    expectedFactors,
    requiredFactorsAvailable,
    requiredFactorsExpected,
    coverageRatio,
    status,
  };
}

function evaluateActivityHour(
  definition: ActivityProfileDefinition,
  hour: HourlyEnvironmentalReading,
): ActivityHourResult {
  const missing = missingRequiredVariables(definition, hour);
  const factors = definition.rules.map((rule) => evaluateRule(rule, hour));
  const dataCompleteness = completenessFor(factors, missing.length);
  const hardConstraintViolations = factors
    .filter((factor) => factor.hardConstraintViolated)
    .map((factor) => factor.explanation ?? factor.label);

  if (missing.length > 0) {
    return {
      timestamp: hour.timestamp,
      available: false,
      score: null,
      displayScore: null,
      category: 'insufficientData',
      factors,
      missingRequiredVariables: missing,
      hardConstraintViolations,
      dataCompleteness,
    };
  }

  const hardConstraintViolated = hardConstraintViolations.length > 0;
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
  const finalScore =
    hardConstraintViolated && definition.semanticType === 'suitability' && isFiniteNumber(score)
      ? 0
      : score;
  const category = hardConstraintViolated ? 'unsuitable' : categoryForActivityScore(score);

  return {
    timestamp: hour.timestamp,
    available: isFiniteNumber(finalScore),
    score: finalScore,
    displayScore: isFiniteNumber(finalScore) ? Math.round(finalScore) : null,
    category,
    factors,
    missingRequiredVariables: [],
    hardConstraintViolations,
    dataCompleteness,
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
  scoreThreshold: number,
  minimumDurationHours: number,
) {
  const first = hours[startIndex];
  if (!isNearBestActivityHour(first, category, scoreThreshold)) return null;

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
      !isNearBestActivityHour(hour, category, scoreThreshold)
    ) {
      break;
    }

    run.push(hour);
    previousTime = time;
  }

  const scores = run.map((hour) => hour.score).filter(isFiniteNumber);
  if (scores.length !== run.length) return null;
  if (run.length < minimumDurationHours) return null;

  return {
    startTime: run[0]!.timestamp,
    endTime: endTimeFor(run[0]!.timestamp, run.length),
    averageScore: scores.reduce((sum, score) => sum + score, 0) / scores.length,
    minimumScore: Math.min(...scores),
    category,
    durationHours: run.length,
  };
}

function availableCategoriesByRank(hours: ActivityHourResult[]): ActivityHourResult['category'][] {
  return Array.from(
    new Set(
      hours
        .filter((hour) => hour.available && isFiniteNumber(hour.score))
        .map((hour) => hour.category)
        .sort((left, right) => categoryRank(right) - categoryRank(left)),
    ),
  );
}

function candidateWindowsForCategory(
  hours: ActivityHourResult[],
  category: ActivityHourResult['category'],
  minimumDurationHours: number,
) {
  const bestScore = hours
    .filter((hour) => hour.available && hour.category === category && isFiniteNumber(hour.score))
    .map((hour) => hour.score!)
    .sort((left, right) => right - left)[0];
  if (!isFiniteNumber(bestScore)) return [];

  const seen = new Set<string>();

  return hours.flatMap((_, index) => {
    const candidate = sameCategoryRun(hours, index, category, bestScore, minimumDurationHours);
    if (!candidate) return [];

    const key = `${candidate.startTime}:${candidate.endTime}:${candidate.category}`;
    if (seen.has(key)) return [];
    seen.add(key);

    return [candidate];
  });
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

function bestActivityWindow(
  hours: ActivityHourResult[],
  minimumDurationHours = 1,
): ActivityWindowResult {
  for (const category of availableCategoriesByRank(hours)) {
    const candidates = candidateWindowsForCategory(hours, category, minimumDurationHours);
    if (candidates.length > 0) {
      return selectBestWindow(candidates);
    }
  }

  return unavailableWindow();
}

export function bestActivityWindowForDate(
  hours: ActivityHourResult[],
  date: string,
  minimumDurationHours = 1,
): ActivityWindowResult {
  const dayHours = hours.filter((hour) => hour.timestamp.slice(0, 10) === date);

  for (const category of availableCategoriesByRank(dayHours)) {
    const candidates = candidateWindowsForCategory(hours, category, minimumDurationHours).filter(
      (candidate) => candidate.startTime.slice(0, 10) === date,
    );
    if (candidates.length > 0) {
      return selectBestWindow(candidates);
    }
  }

  return unavailableWindow();
}

export function bestActivityWindowForRange(
  hours: ActivityHourResult[],
  startTime: string,
  rangeHours: number,
  minimumDurationHours = 1,
): ActivityWindowResult {
  const start = Date.parse(startTime);
  if (!Number.isFinite(start)) return unavailableWindow();

  const end = start + rangeHours * HOUR_MS;
  const rangeHoursOnly = hours.filter((hour) => {
    const time = Date.parse(hour.timestamp);
    return Number.isFinite(time) && time >= start && time <= end;
  });

  return bestActivityWindow(rangeHoursOnly, minimumDurationHours);
}

function reasonsFor(
  current: ActivityHourResult | null,
  semanticType: ActivityProfileDefinition['semanticType'],
  limit = 4,
): string[] {
  if (!current?.available) return ['Insufficient data'];

  return current.factors
    .filter((factor) => factor.available && factor.explanation)
    .sort((left, right) =>
      semanticType === 'risk'
        ? (right.score ?? 0) - (left.score ?? 0)
        : (left.score ?? 0) - (right.score ?? 0),
    )
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
  definition: ActivityProfileDefinition,
  input: ActivityEvaluationInput,
): ActivityEvaluationResult {
  const hours = futureHours(input).map((hour) => evaluateActivityHour(definition, hour));
  const current = hours.find((hour) => hour.available) ?? hours[0] ?? null;
  const bestWindow = bestActivityWindow(hours, definition.minimumUsefulWindowDuration);
  const reasonHour = explanationHour(hours, current, bestWindow);

  return {
    id: definition.id,
    domainId: definition.domainId,
    label: definition.label,
    description: definition.description,
    semanticType: definition.semanticType,
    minimumUsefulWindowDuration: definition.minimumUsefulWindowDuration,
    enabled: input.enabledActivities[definition.domainId],
    available: current?.available === true || bestWindow.available,
    current,
    hours,
    bestWindow,
    reasons: reasonsFor(reasonHour, definition.semanticType),
    dataCompleteness: current?.dataCompleteness ?? {
      availableFactors: 0,
      expectedFactors: definition.rules.length,
      requiredFactorsAvailable: 0,
      requiredFactorsExpected: definition.rules.filter((rule) => rule.required === true).length,
      coverageRatio: 0,
      status: 'insufficient',
    },
    detailVariables: [...definition.detailVariables],
  };
}

export function evaluateActivities(input: ActivityEvaluationInput): ActivityEvaluationResult[] {
  return enabledActivityProfiles(input.enabledActivities).map((definition) =>
    evaluateActivity(definition, input),
  );
}

export interface ActivityDomainEvaluationResult {
  id: ActivityDomainId;
  label: string;
  description: string;
  profiles: ActivityEvaluationResult[];
  bestOpportunity: ActivityEvaluationResult | null;
}

export function evaluateActivityDomains(
  input: ActivityEvaluationInput,
): ActivityDomainEvaluationResult[] {
  const enabledDomains = new Set(
    Object.entries(input.enabledActivities)
      .filter(([, enabled]) => enabled)
      .map(([domainId]) => domainId as ActivityDomainId),
  );

  return Array.from(enabledDomains).flatMap((domainId) => {
    const profiles = activityProfilesForDomain(domainId).map((definition) =>
      evaluateActivity(definition, input),
    );
    if (profiles.length === 0) return [];

    const bestOpportunity =
      profiles
        .filter((profile) => profile.semanticType === 'suitability' && profile.bestWindow.available)
        .sort((left, right) => {
          const categoryDifference =
            categoryRank(right.bestWindow.category) - categoryRank(left.bestWindow.category);
          if (categoryDifference !== 0) return categoryDifference;
          return (right.bestWindow.averageScore ?? 0) - (left.bestWindow.averageScore ?? 0);
        })[0] ?? null;

    const first = activityProfilesForDomain(domainId)[0];
    return [
      {
        id: domainId,
        label: first ? domainLabel(domainId) : domainId,
        description: domainDescription(domainId),
        profiles,
        bestOpportunity,
      },
    ];
  });
}

export function formatActivityWindow(
  window: ActivityWindowResult,
  referenceTime: string | null = null,
): string {
  if (!window.available || !window.startTime || !window.endTime) return 'Unavailable';
  return formatTimeRangeWithTomorrow(window.startTime, window.endTime, referenceTime);
}

export function formatActivityScore(result: ActivityEvaluationResult): string {
  if (!result.current?.available || !isFiniteNumber(result.current.displayScore)) {
    return activityCategoryLabel('insufficientData', result.semanticType);
  }

  return `${activityCategoryLabel(result.current.category, result.semanticType)} · ${result.current.displayScore}%`;
}

function domainLabel(domainId: ActivityDomainId): string {
  switch (domainId) {
    case 'agriculture':
      return 'Agriculture';
    case 'drone_operations':
      return 'Drone Operations';
    case 'photography':
      return 'Photography';
    case 'astronomy':
      return 'Astronomy';
    case 'outdoor_work':
      return 'Outdoor Work';
  }
}

function domainDescription(domainId: ActivityDomainId): string {
  switch (domainId) {
    case 'agriculture':
      return 'Environmental tools for field operations and frost-risk context.';
    case 'drone_operations':
      return 'Environmental decision support for drone operation profiles.';
    case 'photography':
      return 'Outdoor photography weather and light profiles.';
    case 'astronomy':
      return 'Night-sky viewing and imaging condition profiles.';
    case 'outdoor_work':
      return 'Outdoor work environmental profiles.';
  }
}

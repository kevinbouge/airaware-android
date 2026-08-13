import { OUTDOOR_WINDOW_MIN_COMPLETENESS } from './constants';
import { calculateEnvironmentalScore } from './scoring';
import type {
  EnvironmentalScoreResult,
  CurrentEnvironmentalReadings,
  HourlyEnvironmentalReading,
  OutdoorWindow,
  PersonalizedScoreResult,
} from '../models/environment';
import type { PersonalAllergyProfile } from '../models/profile';
import { calculatePersonalizedScore } from './profileScoring';
import { isFiniteNumber } from '../utils/number';

interface HourlyPersonalizedRisk {
  timestamp: string;
  result: PersonalizedScoreResult;
  partial: boolean;
}

export interface PersonalizedForecast {
  hours: HourlyPersonalizedRisk[];
  peak: HourlyPersonalizedRisk | null;
  bestWindow: OutdoorWindow;
}

interface HourlyEnvironmentalRisk {
  timestamp: string;
  result: EnvironmentalScoreResult;
}

interface OutdoorWindowCandidate {
  startIndex: number;
  durationHours: number;
  average: number;
  maximum: number;
  completeness: number;
}

export interface EnvironmentalForecast {
  hours: HourlyEnvironmentalRisk[];
  peak: HourlyEnvironmentalRisk | null;
  bestWindow: OutdoorWindow;
}

const NEAR_BEST_SCORE_TOLERANCE = 5;

function toCurrentReading(hour: HourlyEnvironmentalReading): CurrentEnvironmentalReadings {
  return {
    timestamp: hour.timestamp,
    pollen: hour.pollen,
    regulatedPollutants: hour.regulatedPollutants,
    pollutantAqi: hour.pollutantAqi,
    aqiLabel: hour.aqiLabel,
    atmosphericIrritants: hour.atmosphericIrritants,
    weather: hour.weather,
    moldPotential: hour.moldPotential,
    uvIndex: hour.uvIndex,
  };
}

function isContiguous(left: string, right: string): boolean {
  const leftTime = Date.parse(left);
  const rightTime = Date.parse(right);

  if (!Number.isFinite(leftTime) || !Number.isFinite(rightTime)) {
    return false;
  }

  return Math.abs(rightTime - leftTime - 60 * 60 * 1000) <= 10 * 60 * 1000;
}

function hasEnoughCompleteness(result: PersonalizedScoreResult): boolean {
  if (!result.available) return false;
  if (result.selectedGroupCount < 2) return result.availableGroupCount >= 1;
  return result.availableGroupCount / result.selectedGroupCount >= OUTDOOR_WINDOW_MIN_COMPLETENESS;
}

function unavailableWindow(reason: OutdoorWindow['reason']): OutdoorWindow {
  return {
    available: false,
    startTime: null,
    endTime: null,
    durationHours: 0,
    averageScore: null,
    maximumScore: null,
    category: 'unavailable',
    completeness: 0,
    reason,
  };
}

function riskCategoryRank(category: OutdoorWindow['category']): number {
  switch (category) {
    case 'low':
      return 0;
    case 'moderate':
      return 1;
    case 'high':
      return 2;
    case 'veryHigh':
      return 3;
    case 'unavailable':
      return 4;
  }
}

function next24Hours<T extends { timestamp: string }>(hourly: T[], now: Date): T[] {
  const start = now.getTime();
  const end = start + 24 * 60 * 60 * 1000;

  return hourly
    .slice()
    .filter((hour) => {
      const time = Date.parse(hour.timestamp);
      return Number.isFinite(time) && time >= start && time < end;
    })
    .sort((left, right) => Date.parse(left.timestamp) - Date.parse(right.timestamp));
}

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

function addOneHourPreservingTimestampStyle(timestamp: string | undefined): string | null {
  if (!timestamp) return null;

  const match = timestamp.match(
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?(Z|[+-]\d{2}:\d{2})?$/,
  );

  if (!match) {
    const time = Date.parse(timestamp);
    if (!Number.isFinite(time)) return null;
    return new Date(time + 60 * 60 * 1000).toISOString();
  }

  const [, year, month, day, hour, minute, second, offset] = match;
  const offsetMinutes =
    offset && offset !== 'Z'
      ? Number(offset.slice(0, 3)) * 60 + Number(offset[0] + offset.slice(4, 6))
      : 0;
  const utcTime =
    Date.UTC(
      Number(year),
      Number(month) - 1,
      Number(day),
      Number(hour),
      Number(minute),
      Number(second ?? '0'),
    ) -
    offsetMinutes * 60 * 1000 +
    60 * 60 * 1000;
  const localTime = new Date(utcTime + offsetMinutes * 60 * 1000);
  const formatted = `${localTime.getUTCFullYear()}-${pad(localTime.getUTCMonth() + 1)}-${pad(
    localTime.getUTCDate(),
  )}T${pad(localTime.getUTCHours())}:${pad(localTime.getUTCMinutes())}`;

  if (offset === undefined) {
    return second === undefined ? formatted : `${formatted}:${pad(localTime.getUTCSeconds())}`;
  }

  const withSeconds =
    second === undefined ? formatted : `${formatted}:${pad(localTime.getUTCSeconds())}`;
  return `${withSeconds}${offset}`;
}

export function calculatePersonalizedForecast(
  hourly: HourlyEnvironmentalReading[],
  profile: PersonalAllergyProfile,
  now = new Date(),
): PersonalizedForecast {
  if (!profile.enabled) {
    return {
      hours: [],
      peak: null,
      bestWindow: unavailableWindow('personalization_disabled'),
    };
  }

  const sorted = next24Hours(hourly, now);
  const hours = sorted.map((hour) => {
    const result = calculatePersonalizedScore(toCurrentReading(hour), profile);
    return {
      timestamp: hour.timestamp,
      result,
      partial: result.available && result.availableGroupCount < result.selectedGroupCount,
    };
  });
  const availableHours = hours.filter(
    (hour) => hour.result.available && isFiniteNumber(hour.result.score),
  );
  const peak =
    availableHours.length === 0
      ? null
      : availableHours.reduce((best, hour) =>
          (hour.result.score ?? 0) > (best.result.score ?? 0) ? hour : best,
        );
  const bestWindow = selectBestOutdoorWindow(hours);

  return { hours, peak, bestWindow };
}

export function calculateEnvironmentalOutdoorWindow(
  hourly: HourlyEnvironmentalReading[],
  now = new Date(),
): OutdoorWindow {
  const hours = next24Hours(hourly, now).map((hour) => ({
    timestamp: hour.timestamp,
    result: calculateEnvironmentalScore(toCurrentReading(hour)),
  }));

  return selectBestEnvironmentalOutdoorWindow(hours);
}

export function calculateEnvironmentalForecast(
  hourly: HourlyEnvironmentalReading[],
  now = new Date(),
): EnvironmentalForecast {
  const hours = next24Hours(hourly, now).map((hour) => ({
    timestamp: hour.timestamp,
    result: calculateEnvironmentalScore(toCurrentReading(hour)),
  }));
  const availableHours = hours.filter(
    (hour) => hour.result.available && isFiniteNumber(hour.result.score),
  );
  const peak =
    availableHours.length === 0
      ? null
      : availableHours.reduce((best, hour) =>
          (hour.result.score ?? 0) > (best.result.score ?? 0) ? hour : best,
        );

  return {
    hours,
    peak,
    bestWindow: selectBestEnvironmentalOutdoorWindow(hours),
  };
}

function personalizedCompleteness(hour: HourlyPersonalizedRisk): number {
  if (hour.result.selectedGroupCount <= 0) return 0;
  return hour.result.availableGroupCount / hour.result.selectedGroupCount;
}

function bestOutdoorWindowCategory(
  hours: HourlyPersonalizedRisk[],
): OutdoorWindow['category'] | null {
  const available = hours
    .filter(
      (hour) =>
        hasEnoughCompleteness(hour.result) &&
        isFiniteNumber(hour.result.score) &&
        hour.result.category !== 'unavailable',
    )
    .map((hour) => hour.result.category);

  return available.reduce<OutdoorWindow['category'] | null>(
    (best, category) =>
      best === null || riskCategoryRank(category) < riskCategoryRank(best) ? category : best,
    null,
  );
}

function bestOutdoorWindowScore(
  hours: HourlyPersonalizedRisk[],
  category: OutdoorWindow['category'],
): number | null {
  const scores = hours
    .filter(
      (hour) =>
        hour.result.category === category &&
        hasEnoughCompleteness(hour.result) &&
        isFiniteNumber(hour.result.score),
    )
    .map((hour) => hour.result.score!)
    .sort((left, right) => left - right);

  return scores[0] ?? null;
}

function isNearBestOutdoorWindowHour(
  hour: HourlyPersonalizedRisk | undefined,
  category: OutdoorWindow['category'],
  bestScore: number,
): hour is HourlyPersonalizedRisk {
  return (
    hour !== undefined &&
    hour.result.category === category &&
    hasEnoughCompleteness(hour.result) &&
    isFiniteNumber(hour.result.score) &&
    hour.result.score <= bestScore + NEAR_BEST_SCORE_TOLERANCE
  );
}

function betterOutdoorWindowCandidate(
  candidate: OutdoorWindowCandidate,
  best: OutdoorWindowCandidate | null,
): boolean {
  if (!best) return true;
  if (candidate.durationHours !== best.durationHours) {
    return candidate.durationHours > best.durationHours;
  }
  if (candidate.average !== best.average) return candidate.average < best.average;
  if (candidate.maximum !== best.maximum) return candidate.maximum < best.maximum;
  return candidate.completeness > best.completeness;
}

function nearBestOutdoorWindowRun(
  hours: HourlyPersonalizedRisk[],
  startIndex: number,
  category: OutdoorWindow['category'],
  bestScore: number,
): HourlyPersonalizedRisk[] {
  const start = hours[startIndex];
  if (!isNearBestOutdoorWindowHour(start, category, bestScore)) return [];

  const window = [start];
  for (let nextIndex = startIndex + 1; nextIndex < hours.length; nextIndex += 1) {
    const previous = window[window.length - 1];
    const next = hours[nextIndex];
    if (
      !previous ||
      !next ||
      !isContiguous(previous.timestamp, next.timestamp) ||
      !isNearBestOutdoorWindowHour(next, category, bestScore)
    ) {
      break;
    }

    window.push(next);
  }

  return window;
}

function outdoorWindowCandidate(
  hours: HourlyPersonalizedRisk[],
  startIndex: number,
  category: OutdoorWindow['category'],
  bestScore: number,
): OutdoorWindowCandidate | null {
  const window = nearBestOutdoorWindowRun(hours, startIndex, category, bestScore);
  if (window.length === 0) return null;

  const scores = window.map((hour) => hour.result.score ?? 0);
  return {
    startIndex,
    durationHours: window.length,
    average: scores.reduce((sum, score) => sum + score, 0) / scores.length,
    maximum: Math.max(...scores),
    completeness:
      window.reduce((sum, hour) => sum + personalizedCompleteness(hour), 0) / window.length,
  };
}

function selectBestOutdoorWindow(hours: HourlyPersonalizedRisk[]): OutdoorWindow {
  const category = bestOutdoorWindowCategory(hours);
  if (!category) {
    return unavailableWindow('insufficient_forecast_data');
  }

  const bestScore = bestOutdoorWindowScore(hours, category);
  if (!isFiniteNumber(bestScore)) {
    return unavailableWindow('insufficient_forecast_data');
  }

  let best: OutdoorWindowCandidate | null = null;

  for (let index = 0; index < hours.length; index += 1) {
    const candidate = outdoorWindowCandidate(hours, index, category, bestScore);
    if (candidate && betterOutdoorWindowCandidate(candidate, best)) {
      best = candidate;
    }
  }

  if (!best) {
    return unavailableWindow('insufficient_forecast_data');
  }

  const start = hours[best.startIndex];
  const end = hours[best.startIndex + best.durationHours - 1];

  return {
    available: true,
    startTime: start?.timestamp ?? null,
    endTime: addOneHourPreservingTimestampStyle(end?.timestamp),
    durationHours: best.durationHours,
    averageScore: best.average,
    maximumScore: best.maximum,
    category,
    completeness: best.completeness,
  };
}

function selectBestEnvironmentalOutdoorWindow(hours: HourlyEnvironmentalRisk[]): OutdoorWindow {
  return selectBestOutdoorWindow(
    hours.map((hour) => ({
      timestamp: hour.timestamp,
      result: {
        ...hour.result,
        selectedGroupCount: 1,
        availableGroupCount: hour.result.available ? 1 : 0,
      },
      partial: false,
    })),
  );
}

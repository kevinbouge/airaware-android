import { OUTDOOR_WINDOW_MIN_COMPLETENESS } from './constants';
import { categoryFromScore } from './categories';
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

type OutdoorWindowDurationHours = 1 | 2 | 3;

export interface PersonalizedForecast {
  hours: HourlyPersonalizedRisk[];
  peak: HourlyPersonalizedRisk | null;
  bestWindow: OutdoorWindow;
}

interface HourlyEnvironmentalRisk {
  timestamp: string;
  result: EnvironmentalScoreResult;
}

export interface EnvironmentalForecast {
  hours: HourlyEnvironmentalRisk[];
  peak: HourlyEnvironmentalRisk | null;
  bestWindow: OutdoorWindow;
}

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

function unavailableWindow(durationHours: number, reason: OutdoorWindow['reason']): OutdoorWindow {
  return {
    available: false,
    startTime: null,
    endTime: null,
    durationHours,
    averageScore: null,
    maximumScore: null,
    category: 'unavailable',
    completeness: 0,
    reason,
  };
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
  durationHours: OutdoorWindowDurationHours,
  now = new Date(),
): PersonalizedForecast {
  if (!profile.enabled) {
    return {
      hours: [],
      peak: null,
      bestWindow: unavailableWindow(durationHours, 'personalization_disabled'),
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
  const bestWindow = selectBestOutdoorWindow(hours, durationHours);

  return { hours, peak, bestWindow };
}

export function calculateEnvironmentalOutdoorWindow(
  hourly: HourlyEnvironmentalReading[],
  durationHours: OutdoorWindowDurationHours,
  now = new Date(),
): OutdoorWindow {
  const hours = next24Hours(hourly, now).map((hour) => ({
    timestamp: hour.timestamp,
    result: calculateEnvironmentalScore(toCurrentReading(hour)),
  }));

  return selectBestEnvironmentalOutdoorWindow(hours, durationHours);
}

export function calculateEnvironmentalForecast(
  hourly: HourlyEnvironmentalReading[],
  durationHours: OutdoorWindowDurationHours,
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
    bestWindow: selectBestEnvironmentalOutdoorWindow(hours, durationHours),
  };
}

function selectBestOutdoorWindow(
  hours: HourlyPersonalizedRisk[],
  durationHours: OutdoorWindowDurationHours,
): OutdoorWindow {
  let best: {
    startIndex: number;
    average: number;
    maximum: number;
    completeness: number;
  } | null = null;

  for (let index = 0; index <= hours.length - durationHours; index += 1) {
    const window = hours.slice(index, index + durationHours);
    const contiguous = window.every((hour, offset) => {
      if (offset === 0) return true;
      return isContiguous(window[offset - 1]?.timestamp ?? '', hour.timestamp);
    });
    const eligible =
      contiguous &&
      window.every(
        (hour) => hasEnoughCompleteness(hour.result) && isFiniteNumber(hour.result.score),
      );

    if (!eligible) continue;

    const scores = window.map((hour) => hour.result.score ?? 0);
    const average = scores.reduce((sum, score) => sum + score, 0) / scores.length;
    const maximum = Math.max(...scores);
    const completeness =
      window.reduce(
        (sum, hour) => sum + hour.result.availableGroupCount / hour.result.selectedGroupCount,
        0,
      ) / window.length;
    const candidate = { startIndex: index, average, maximum, completeness };

    if (
      !best ||
      candidate.average < best.average ||
      (candidate.average === best.average && candidate.maximum < best.maximum) ||
      (candidate.average === best.average &&
        candidate.maximum === best.maximum &&
        candidate.completeness > best.completeness)
    ) {
      best = candidate;
    }
  }

  if (!best) {
    return unavailableWindow(durationHours, 'insufficient_forecast_data');
  }

  const start = hours[best.startIndex];
  const end = hours[best.startIndex + durationHours - 1];

  return {
    available: true,
    startTime: start?.timestamp ?? null,
    endTime: addOneHourPreservingTimestampStyle(end?.timestamp),
    durationHours,
    averageScore: best.average,
    maximumScore: best.maximum,
    category: categoryFromScore(best.average),
    completeness: best.completeness,
  };
}

function selectBestEnvironmentalOutdoorWindow(
  hours: HourlyEnvironmentalRisk[],
  durationHours: OutdoorWindowDurationHours,
): OutdoorWindow {
  let best: {
    startIndex: number;
    average: number;
    maximum: number;
    completeness: number;
  } | null = null;

  for (let index = 0; index <= hours.length - durationHours; index += 1) {
    const window = hours.slice(index, index + durationHours);
    const contiguous = window.every((hour, offset) => {
      if (offset === 0) return true;
      return isContiguous(window[offset - 1]?.timestamp ?? '', hour.timestamp);
    });
    const eligible =
      contiguous &&
      window.every((hour) => hour.result.available && isFiniteNumber(hour.result.score));

    if (!eligible) continue;

    const scores = window.map((hour) => hour.result.score ?? 0);
    const average = scores.reduce((sum, score) => sum + score, 0) / scores.length;
    const maximum = Math.max(...scores);
    const completeness =
      window.reduce((sum, hour) => sum + hour.result.completeness, 0) / window.length;
    const candidate = { startIndex: index, average, maximum, completeness };

    if (
      !best ||
      candidate.average < best.average ||
      (candidate.average === best.average && candidate.maximum < best.maximum) ||
      (candidate.average === best.average &&
        candidate.maximum === best.maximum &&
        candidate.completeness > best.completeness)
    ) {
      best = candidate;
    }
  }

  if (!best) {
    return unavailableWindow(durationHours, 'insufficient_forecast_data');
  }

  const start = hours[best.startIndex];
  const end = hours[best.startIndex + durationHours - 1];

  return {
    available: true,
    startTime: start?.timestamp ?? null,
    endTime: addOneHourPreservingTimestampStyle(end?.timestamp),
    durationHours,
    averageScore: best.average,
    maximumScore: best.maximum,
    category: categoryFromScore(best.average),
    completeness: best.completeness,
  };
}

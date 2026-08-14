import type {
  ActivityHourResult,
  ActivitySuitabilityCategory,
  ActivityWindowResult,
} from '../models/activities';
import { displayScore, isFiniteNumber } from '../utils/number';

const HOUR_MS = 60 * 60 * 1000;

export interface ActivityTimelineRow {
  timestamp: string;
  score: number;
  displayScore: number;
  category: ActivitySuitabilityCategory;
  now: boolean;
  inBestWindow: boolean;
  markerLabel: string;
}

function isInsideWindow(timestamp: string, window: ActivityWindowResult | null): boolean {
  if (!window?.available || !window.startTime || !window.endTime) return false;

  const time = Date.parse(timestamp);
  const start = Date.parse(window.startTime);
  const end = Date.parse(window.endTime);

  return (
    Number.isFinite(time) &&
    Number.isFinite(start) &&
    Number.isFinite(end) &&
    time >= start &&
    time < end
  );
}

function rowFromHour(
  hour: ActivityHourResult,
  bestWindow: ActivityWindowResult | null,
  now: boolean,
): ActivityTimelineRow | null {
  if (!hour.available || !isFiniteNumber(hour.score)) return null;

  const inBestWindow = isInsideWindow(hour.timestamp, bestWindow);

  return {
    timestamp: hour.timestamp,
    score: hour.score,
    displayScore: displayScore(hour.score) ?? 0,
    category: hour.category,
    now,
    inBestWindow,
    markerLabel: inBestWindow ? 'Best' : '',
  };
}

export function buildActivityTimelineRows(
  hours: readonly ActivityHourResult[],
  nowTimestamp: string,
  bestWindow: ActivityWindowResult | null,
  forecastHours = 24,
): ActivityTimelineRow[] {
  const nowTime = Date.parse(nowTimestamp);
  if (!Number.isFinite(nowTime)) return [];

  const endTime = nowTime + Math.max(0, forecastHours) * HOUR_MS;

  return hours
    .filter((hour) => {
      const time = Date.parse(hour.timestamp);
      return Number.isFinite(time) && time >= nowTime && time <= endTime;
    })
    .map((hour) => rowFromHour(hour, bestWindow, hour.timestamp === nowTimestamp))
    .filter((row): row is ActivityTimelineRow => row !== null);
}

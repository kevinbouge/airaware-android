import type { OutdoorWindow, RiskCategoryId } from '../models/environment';
import { displayScore, isFiniteNumber } from '../utils/number';

export interface TimelineScorePoint {
  timestamp: string;
  score: number | null;
  category: RiskCategoryId;
}

export interface RiskTimelineRow {
  timestamp: string;
  score: number;
  displayScore: number;
  category: RiskCategoryId;
  now: boolean;
  inBestWindow: boolean;
  markerLabel: string;
}

function isInsideWindow(timestamp: string, window: OutdoorWindow | null): boolean {
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

function rowFromPoint(
  point: TimelineScorePoint,
  bestWindow: OutdoorWindow | null,
  now: boolean,
): RiskTimelineRow | null {
  if (!isFiniteNumber(point.score)) return null;

  const inBestWindow = isInsideWindow(point.timestamp, bestWindow);

  return {
    timestamp: point.timestamp,
    score: point.score,
    displayScore: displayScore(point.score) ?? 0,
    category: point.category,
    now,
    inBestWindow,
    markerLabel: inBestWindow ? 'Best' : '',
  };
}

export function buildRiskTimelineRows(
  current: TimelineScorePoint | null,
  hourly: TimelineScorePoint[],
  bestWindow: OutdoorWindow | null,
): RiskTimelineRow[] {
  const currentRow = current ? rowFromPoint(current, bestWindow, true) : null;
  const currentTime = currentRow ? Date.parse(currentRow.timestamp) : null;
  const forecastRows = hourly
    .filter((point) => {
      if (currentTime === null || !Number.isFinite(currentTime)) return true;
      const time = Date.parse(point.timestamp);
      return Number.isFinite(time) && time > currentTime;
    })
    .map((point) => rowFromPoint(point, bestWindow, false))
    .filter((row): row is RiskTimelineRow => row !== null);

  return currentRow ? [currentRow, ...forecastRows] : forecastRows;
}

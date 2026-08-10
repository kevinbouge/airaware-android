import type {
  DataAggregationStrategy,
  DataDetailDomain,
  DataDetailRangeDefinition,
  DataDetailSummary,
  DataDetailTimeline,
  DataDetailVariableDefinition,
  DataTimelinePoint,
  RawTimelinePoint,
} from '../models/dataDetail';
import type { Coordinates } from '../models/environment';
import { isFiniteNumber } from '../utils/number';
import { providerLocalDate, providerLocalTime } from '../utils/time';

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;
const WEEK_MS = 7 * DAY_MS;

function validTime(value: string): number | null {
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function isoAt(time: number): string {
  return new Date(time).toISOString();
}

function dateKeyAt(time: number): string {
  return new Date(time).toISOString().slice(0, 10);
}

function dateKeyParts(dateKey: string): { year: number; month: number; day: number } | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateKey);
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return null;
  return { year, month, day };
}

function timestampOffset(timestamp: string): string {
  const match = timestamp.match(/(Z|[+-]\d{2}:\d{2})$/);
  return match?.[1] ?? 'Z';
}

function dateKeyToTime(dateKey: string, offset: string): number {
  const parts = dateKeyParts(dateKey);
  if (!parts) return Date.parse(`${dateKey}T00:00:00${offset}`);

  const localMidnight = Date.parse(`${dateKey}T00:00:00${offset}`);
  if (Number.isFinite(localMidnight)) return localMidnight;

  return Date.UTC(parts.year, parts.month - 1, parts.day);
}

function localDateKey(timestamp: string, parsedTime: number): string {
  return providerLocalDate(timestamp) ?? dateKeyAt(parsedTime);
}

function weekKeyForDate(dateKey: string): string {
  const parts = dateKeyParts(dateKey);
  if (!parts) return dateKey;

  const date = new Date(Date.UTC(parts.year, parts.month - 1, parts.day));
  const day = date.getUTCDay() || 7;
  const monday = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() - day + 1);
  return dateKeyAt(monday);
}

export function weekKeyAt(time: number): string {
  return weekKeyForDate(dateKeyAt(time));
}

function labelForPoint(startTime: string, granularity: DataDetailRangeDefinition['granularity']) {
  if (granularity === 'hourly') {
    const date = providerLocalDate(startTime);
    const time = providerLocalTime(startTime);
    return date && time ? `${date} ${time}` : startTime;
  }

  if (granularity === 'weekly') {
    return `Week of ${providerLocalDate(startTime) ?? startTime}`;
  }

  return providerLocalDate(startTime) ?? startTime;
}

function labelForBucket(
  key: string,
  granularity: DataDetailRangeDefinition['granularity'],
): string {
  if (granularity === 'weekly') return `Week of ${key}`;
  return key;
}

function aggregate(values: number[], strategy: DataAggregationStrategy): number | null {
  if (values.length === 0) return null;

  switch (strategy) {
    case 'maximum':
    case 'moldPeak':
      return Math.max(...values);
    case 'minimum':
      return Math.min(...values);
    case 'sum':
      return values.reduce((sum, value) => sum + value, 0);
    case 'average':
      return values.reduce((sum, value) => sum + value, 0) / values.length;
  }
}

function intervalMs(granularity: DataDetailRangeDefinition['granularity']): number {
  if (granularity === 'weekly') return WEEK_MS;
  if (granularity === 'daily') return DAY_MS;
  return HOUR_MS;
}

interface Bucket {
  key: string;
  label: string;
  start: number;
  source: RawTimelinePoint['source'];
  values: number[];
  sawMissing: boolean;
}

function bucketKey(
  point: RawTimelinePoint,
  time: number,
  granularity: DataDetailRangeDefinition['granularity'],
): string {
  const dateKey = localDateKey(point.timestamp, time);
  if (granularity === 'weekly') return weekKeyForDate(dateKey);
  if (granularity === 'daily') return dateKey;
  const date = new Date(time);
  return new Date(
    Date.UTC(
      date.getUTCFullYear(),
      date.getUTCMonth(),
      date.getUTCDate(),
      date.getUTCHours(),
      0,
      0,
      0,
    ),
  ).toISOString();
}

function bucketStartTime(
  point: RawTimelinePoint,
  time: number,
  granularity: DataDetailRangeDefinition['granularity'],
): number {
  const key = bucketKey(point, time, granularity);
  if (granularity === 'weekly' || granularity === 'daily') {
    return dateKeyToTime(key, timestampOffset(point.timestamp));
  }

  const date = new Date(time);
  return Date.UTC(
    date.getUTCFullYear(),
    date.getUTCMonth(),
    date.getUTCDate(),
    date.getUTCHours(),
    0,
    0,
    0,
  );
}

function aggregatePoints(
  rawPoints: RawTimelinePoint[],
  range: DataDetailRangeDefinition,
  definition: DataDetailVariableDefinition,
): DataTimelinePoint[] {
  if (range.granularity === 'hourly') {
    return rawPoints
      .map((point) => {
        const time = validTime(point.timestamp);
        if (time === null) return null;
        return {
          id: `${point.source}:${point.timestamp}`,
          startTime: point.timestamp,
          endTime: isoAt(time + HOUR_MS),
          label: labelForPoint(point.timestamp, 'hourly'),
          value: point.value,
          source: point.source,
        };
      })
      .filter((point): point is DataTimelinePoint => point !== null);
  }

  const buckets = new Map<string, Bucket>();

  for (const point of rawPoints) {
    const time = validTime(point.timestamp);
    if (time === null) continue;

    const key = `${point.source}:${bucketKey(point, time, range.granularity)}`;
    const bucket =
      buckets.get(key) ??
      ({
        key,
        label: labelForBucket(bucketKey(point, time, range.granularity), range.granularity),
        start: bucketStartTime(point, time, range.granularity),
        source: point.source,
        values: [],
        sawMissing: false,
      } satisfies Bucket);

    if (isFiniteNumber(point.value)) {
      bucket.values.push(point.value);
    } else {
      bucket.sawMissing = true;
    }

    buckets.set(key, bucket);
  }

  return Array.from(buckets.values())
    .sort((left, right) => left.start - right.start)
    .map((bucket) => {
      const startTime = isoAt(bucket.start);
      return {
        id: bucket.key,
        startTime,
        endTime: isoAt(bucket.start + intervalMs(range.granularity)),
        label: bucket.label,
        value: aggregate(bucket.values, definition.aggregation),
        source: bucket.source,
      };
    });
}

function valueDomain(
  points: DataTimelinePoint[],
  definition: DataDetailVariableDefinition,
): DataDetailDomain | null {
  const values = points.map((point) => point.value).filter(isFiniteNumber);
  if (values.length === 0) return null;

  const minimum = Math.min(...values);
  const maximum = Math.max(...values);
  const lower = definition.lowerBound === null ? minimum : Math.min(definition.lowerBound, minimum);
  const upper = maximum === lower ? maximum + 1 : maximum;

  return { min: lower, max: upper };
}

function summaryFor(points: DataTimelinePoint[], now: number): DataDetailSummary {
  const values = points.map((point) => point.value).filter(isFiniteNumber);
  const current =
    points
      .filter((point) => {
        const start = validTime(point.startTime);
        const end = validTime(point.endTime);
        return start !== null && end !== null && start <= now && now < end;
      })
      .map((point) => point.value)
      .find(isFiniteNumber) ?? null;

  if (values.length === 0) {
    return { current, minimum: null, maximum: null, average: null };
  }

  return {
    current,
    minimum: Math.min(...values),
    maximum: Math.max(...values),
    average: values.reduce((sum, value) => sum + value, 0) / values.length,
  };
}

function forecastTruncated(
  rawPoints: RawTimelinePoint[],
  forecastEnd: number,
  forecastAvailable: boolean,
): boolean {
  if (!forecastAvailable) return false;

  const latestForecastTime = rawPoints
    .filter((point) => point.source === 'forecast')
    .map((point) => validTime(point.timestamp))
    .filter((time): time is number => time !== null)
    .sort((left, right) => right - left)[0];

  if (latestForecastTime === undefined) return false;
  return latestForecastTime + HOUR_MS < forecastEnd - 10 * 60 * 1000;
}

export function buildDataDetailTimeline(input: {
  variable: DataDetailVariableDefinition;
  range: DataDetailRangeDefinition;
  coordinates: Coordinates;
  timezone: string | null;
  now: string;
  history: RawTimelinePoint[];
  forecast: RawTimelinePoint[];
  historyError?: string | null;
  forecastError?: string | null;
}): DataDetailTimeline {
  const nowTime = validTime(input.now) ?? Date.now();
  const historyStart = nowTime - input.range.historyHours * HOUR_MS;
  const forecastEnd = nowTime + input.range.forecastHours * HOUR_MS;
  const rawPoints = [...input.history, ...input.forecast]
    .filter((point) => {
      const time = validTime(point.timestamp);
      if (time === null) return false;
      if (point.source === 'history') return time >= historyStart && time < nowTime;
      return time >= nowTime && time <= forecastEnd;
    })
    .sort((left, right) => (validTime(left.timestamp) ?? 0) - (validTime(right.timestamp) ?? 0));
  const points = aggregatePoints(rawPoints, input.range, input.variable);
  const historyAvailable = points.some((point) => point.source === 'history');
  const forecastAvailable = points.some((point) => point.source === 'forecast');
  const isForecastTruncated = forecastTruncated(rawPoints, forecastEnd, forecastAvailable);
  const expectedSpan = input.range.historyHours + input.range.forecastHours;

  return {
    variableId: input.variable.id,
    rangeId: input.range.id,
    generatedAt: new Date().toISOString(),
    coordinates: input.coordinates,
    timezone: input.timezone,
    granularity: input.range.granularity,
    historyAvailable,
    forecastAvailable,
    forecastTruncated: isForecastTruncated,
    partial:
      input.historyError != null ||
      input.forecastError != null ||
      !historyAvailable ||
      !forecastAvailable ||
      isForecastTruncated,
    now: input.now,
    nowOffsetRatio: expectedSpan > 0 ? input.range.historyHours / expectedSpan : 0.5,
    points,
    domain: valueDomain(points, input.variable),
    summary: summaryFor(points, nowTime),
    error:
      points.length === 0
        ? (input.historyError ?? input.forecastError ?? 'No timeline data is available.')
        : null,
  };
}

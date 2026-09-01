import type { EnvironmentalVariableId } from '../capabilities/types';
import {
  DATA_DETAIL_CACHE_SCHEMA_VERSION,
  DATA_DETAIL_CACHE_STALE_AFTER_MS,
} from '../core/constants';
import { buildDataDetailTimeline } from '../core/dataTimeline';
import { dataDetailRange, dataDetailVariable } from '../core/dataVariableMetadata';
import type { DataDetailRangeId, DataDetailTimeline } from '../models/dataDetail';
import type { Coordinates } from '../models/environment';
import { fetchDataDetailSourceQuery } from './dataDetailQueries';
import { loadDataDetailCache, saveDataDetailCache } from '../storage/storage';
import { millisecondsBetween, providerLocalDate, subtractDays, subtractHours } from '../utils/time';
import { translate } from '../i18n';

const TIMESTAMP_OFFSET_PATTERN = /(Z|[+-]\d{2}:\d{2})$/;

function dateKey(time: number): string {
  return new Date(time).toISOString().slice(0, 10);
}

function timestampOffsetMinutes(timestamp: string): number {
  const match = timestamp.match(TIMESTAMP_OFFSET_PATTERN);
  const offset = match?.[1];
  if (!offset || offset === 'Z') return 0;

  const sign = offset.startsWith('-') ? -1 : 1;
  const parts = offset.slice(1).split(':').map(Number);
  const hours = parts[0];
  const minutes = parts[1];
  if (
    typeof hours !== 'number' ||
    typeof minutes !== 'number' ||
    !Number.isFinite(hours) ||
    !Number.isFinite(minutes)
  ) {
    return 0;
  }

  return sign * (hours * 60 + minutes);
}

function dateKeyInReferenceOffset(time: number, referenceTimestamp: string): string {
  const offsetMs = timestampOffsetMinutes(referenceTimestamp) * 60 * 1000;
  return dateKey(time + offsetMs);
}

export function dataDetailLocalDateKey(now: string): string {
  const nowTime = Date.parse(now);
  if (Number.isFinite(nowTime)) {
    return dateKeyInReferenceOffset(nowTime, now);
  }

  return providerLocalDate(now) ?? dateKey(Date.now());
}

function cacheCoordinates(coordinates: Coordinates): string {
  return `${coordinates.latitude.toFixed(5)},${coordinates.longitude.toFixed(5)}`;
}

export function dataDetailCacheKey(input: {
  coordinates: Coordinates;
  variableId: EnvironmentalVariableId;
  rangeId: DataDetailRangeId;
  now: string;
}): string {
  const day = dataDetailLocalDateKey(input.now);
  return `${cacheCoordinates(input.coordinates)}:${input.variableId}:${input.rangeId}:${day}`;
}

export function dataDetailHistoryDatesForNow(
  now: string,
  historyHours: number,
): { startDate: string; endDate: string } {
  const nowTime = Date.parse(now);
  const safeNow = Number.isFinite(nowTime) ? nowTime : Date.now();
  const historyStart = subtractDays(subtractHours(safeNow, historyHours), 1);
  return {
    startDate: dateKeyInReferenceOffset(historyStart, now),
    endDate: dataDetailLocalDateKey(now),
  };
}

function forecastHoursFor(
  provider: ReturnType<typeof dataDetailVariable> extends infer T
    ? T extends { provider: infer Provider }
      ? Provider
      : never
    : never,
  forecastHours: number,
): number {
  const requestedHours = Math.max(1, Math.ceil(forecastHours));
  return provider === 'airQuality'
    ? Math.min(7 * 24, requestedHours)
    : Math.min(14 * 24, requestedHours);
}

async function cachedTimeline(cacheKey: string): Promise<DataDetailTimeline | null> {
  const cache = await loadDataDetailCache(cacheKey);
  if (!cache) return null;
  const savedAt = Date.parse(cache.savedAt);
  const cacheExpired =
    !Number.isFinite(savedAt) ||
    millisecondsBetween(Date.now(), savedAt) > DATA_DETAIL_CACHE_STALE_AFTER_MS;

  return {
    ...cache.data,
    partial: cache.data.partial || cacheExpired,
  };
}

export async function loadDataDetailTimeline(input: {
  coordinates: Coordinates;
  variableId: EnvironmentalVariableId;
  rangeId: DataDetailRangeId;
  now: string;
}): Promise<DataDetailTimeline> {
  const variable = dataDetailVariable(input.variableId);
  const range = dataDetailRange(input.rangeId);
  const cacheKey = dataDetailCacheKey(input);
  const fallback = await cachedTimeline(cacheKey);

  if (!variable) {
    if (fallback) return fallback;
    return buildDataDetailTimeline({
      variable: {
        id: input.variableId,
        label: translate('detail.unsupportedVariable'),
        provider: 'weather',
        openMeteoVariable: null,
        historyVariables: [],
        forecastVariables: [],
        aggregation: 'average',
        unit: '',
        precision: 0,
        lowerBound: 0,
        summaryStats: [],
        supportsHistory: false,
      },
      range,
      coordinates: input.coordinates,
      timezone: null,
      now: input.now,
      history: [],
      forecast: [],
      historyError: translate('detail.unsupportedHistoricalVariable'),
      forecastError: translate('detail.unsupportedForecastVariable'),
    });
  }

  const dates = dataDetailHistoryDatesForNow(input.now, range.historyHours);
  const [historyResult, forecastResult] = await Promise.allSettled([
    fetchDataDetailSourceQuery({
      coordinates: input.coordinates,
      variable,
      source: 'history',
      startDate: dates.startDate,
      endDate: dates.endDate,
    }),
    fetchDataDetailSourceQuery({
      coordinates: input.coordinates,
      variable,
      source: 'forecast',
      forecastHours: forecastHoursFor(variable.provider, range.forecastHours),
    }),
  ]);

  const history = historyResult.status === 'fulfilled' ? historyResult.value.points : [];
  const forecast = forecastResult.status === 'fulfilled' ? forecastResult.value.points : [];
  const timeline = buildDataDetailTimeline({
    variable,
    range,
    coordinates: input.coordinates,
    timezone:
      (historyResult.status === 'fulfilled' ? historyResult.value.timezone : null) ??
      (forecastResult.status === 'fulfilled' ? forecastResult.value.timezone : null),
    now: input.now,
    history,
    forecast,
    historyError:
      historyResult.status === 'rejected' ? translate('detail.historicalDataUnavailable') : null,
    forecastError:
      forecastResult.status === 'rejected' ? translate('activities.forecastUnavailable') : null,
  });

  if (timeline.points.length > 0) {
    await saveDataDetailCache({
      version: DATA_DETAIL_CACHE_SCHEMA_VERSION,
      savedAt: new Date().toISOString(),
      cacheKey,
      data: timeline,
    });
    return timeline;
  }

  return fallback ?? timeline;
}

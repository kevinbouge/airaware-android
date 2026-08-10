import type { Coordinates } from './environment';
import type { EnvironmentalVariableId } from '../capabilities/types';

export type DataDetailRangeId = '24h' | 'week' | 'month' | 'year';
type DataDetailGranularity = 'hourly' | 'daily' | 'weekly';
export type DataDetailSource = 'history' | 'forecast';
export type DataAggregationStrategy = 'average' | 'maximum' | 'minimum' | 'sum' | 'moldPeak';
type DataDetailProviderKind = 'airQuality' | 'weather' | 'mold';

export interface DataDetailRangeDefinition {
  id: DataDetailRangeId;
  label: string;
  historyHours: number;
  forecastHours: number;
  granularity: DataDetailGranularity;
}

export interface DataDetailVariableDefinition {
  id: EnvironmentalVariableId;
  label: string;
  provider: DataDetailProviderKind;
  openMeteoVariable: string | null;
  historyVariables: readonly string[];
  forecastVariables: readonly string[];
  aggregation: DataAggregationStrategy;
  unit: string;
  precision: number;
  lowerBound: number | null;
  summaryStats: readonly ('minimum' | 'maximum' | 'average')[];
  supportsHistory: boolean;
}

export interface RawTimelinePoint {
  timestamp: string;
  value: number | null;
  source: DataDetailSource;
}

export interface DataTimelinePoint {
  id: string;
  startTime: string;
  endTime: string;
  label: string;
  value: number | null;
  source: DataDetailSource;
}

export interface DataDetailDomain {
  min: number;
  max: number;
}

export interface DataDetailSummary {
  current: number | null;
  minimum: number | null;
  maximum: number | null;
  average: number | null;
}

export interface DataDetailTimeline {
  variableId: EnvironmentalVariableId;
  rangeId: DataDetailRangeId;
  generatedAt: string;
  coordinates: Coordinates;
  timezone: string | null;
  granularity: DataDetailGranularity;
  historyAvailable: boolean;
  forecastAvailable: boolean;
  forecastTruncated: boolean;
  partial: boolean;
  now: string;
  nowOffsetRatio: number;
  points: DataTimelinePoint[];
  domain: DataDetailDomain | null;
  summary: DataDetailSummary;
  error: string | null;
}

export interface CachedDataDetailTimeline {
  version: number;
  savedAt: string;
  cacheKey: string;
  data: DataDetailTimeline;
}

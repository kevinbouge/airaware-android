import type { EnvironmentalVariableId } from '../capabilities/types';
import type { Coordinates, HourlyEnvironmentalReading } from './environment';

export type ActivityId =
  'photography' | 'astronomy' | 'farming' | 'drone' | 'outdoor_sports' | 'outdoor_work';

export type ActivitySuitabilityCategory =
  'excellent' | 'good' | 'fair' | 'poor' | 'unsuitable' | 'insufficientData';

export type ActivitySettings = Record<ActivityId, boolean>;

export interface ActivityFactorResult {
  id: string;
  label: string;
  score: number | null;
  available: boolean;
  required: boolean;
  explanation: string | null;
}

export interface ActivityHourResult {
  timestamp: string;
  available: boolean;
  score: number | null;
  displayScore: number | null;
  category: ActivitySuitabilityCategory;
  factors: ActivityFactorResult[];
  missingRequiredVariables: EnvironmentalVariableId[];
}

export interface ActivityWindowResult {
  available: boolean;
  startTime: string | null;
  endTime: string | null;
  averageScore: number | null;
  minimumScore: number | null;
  category: ActivitySuitabilityCategory;
}

export interface ActivityEvaluationResult {
  id: ActivityId;
  label: string;
  description: string;
  enabled: boolean;
  available: boolean;
  current: ActivityHourResult | null;
  hours: ActivityHourResult[];
  bestWindow: ActivityWindowResult;
  reasons: string[];
  detailVariables: EnvironmentalVariableId[];
}

export interface ActivityEvaluationInput {
  coordinates: Coordinates | null;
  now: string;
  hourly: HourlyEnvironmentalReading[];
  enabledActivities: ActivitySettings;
  forecastDates?: readonly string[];
}

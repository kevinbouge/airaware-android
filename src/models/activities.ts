import type { EnvironmentalVariableId } from '../capabilities/types';
import type { Coordinates, HourlyEnvironmentalReading } from './environment';

export type ActivityDomainId =
  'agriculture' | 'drone_operations' | 'photography' | 'astronomy' | 'outdoor_work';

export type ActivityProfileId =
  | 'agriculture_spraying'
  | 'agriculture_irrigation'
  | 'agriculture_field_work'
  | 'agriculture_harvesting'
  | 'agriculture_frost_risk'
  | 'drone_general_flight'
  | 'drone_aerial_photography'
  | 'drone_survey_mapping'
  | 'photography_landscape'
  | 'photography_golden_hour'
  | 'photography_macro'
  | 'astronomy_stargazing'
  | 'astronomy_astrophotography'
  | 'outdoor_work_construction'
  | 'outdoor_work_at_height'
  | 'outdoor_work_painting'
  | 'outdoor_work_heat_exposure';

export type ActivitySuitabilityCategory =
  'excellent' | 'good' | 'fair' | 'poor' | 'unsuitable' | 'insufficientData';

export type ActivitySemanticType = 'suitability' | 'risk';

type ActivityDataCompletenessStatus = 'complete' | 'reduced' | 'insufficient';

export type ActivitySettings = Record<ActivityDomainId, boolean>;

export interface ActivityDataCompleteness {
  availableFactors: number;
  expectedFactors: number;
  requiredFactorsAvailable: number;
  requiredFactorsExpected: number;
  coverageRatio: number;
  status: ActivityDataCompletenessStatus;
}

export interface ActivityFactorResult {
  id: string;
  label: string;
  score: number | null;
  available: boolean;
  required: boolean;
  explanation: string | null;
  hardConstraintViolated: boolean;
}

export interface ActivityHourResult {
  timestamp: string;
  available: boolean;
  score: number | null;
  displayScore: number | null;
  category: ActivitySuitabilityCategory;
  factors: ActivityFactorResult[];
  missingRequiredVariables: EnvironmentalVariableId[];
  hardConstraintViolations: string[];
  dataCompleteness: ActivityDataCompleteness;
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
  id: ActivityProfileId;
  domainId: ActivityDomainId;
  label: string;
  description: string;
  semanticType: ActivitySemanticType;
  minimumUsefulWindowDuration: number;
  enabled: boolean;
  available: boolean;
  current: ActivityHourResult | null;
  hours: ActivityHourResult[];
  bestWindow: ActivityWindowResult;
  reasons: string[];
  dataCompleteness: ActivityDataCompleteness;
  detailVariables: EnvironmentalVariableId[];
}

export interface ActivityEvaluationInput {
  coordinates: Coordinates | null;
  now: string;
  hourly: HourlyEnvironmentalReading[];
  enabledActivities: ActivitySettings;
  forecastDates?: readonly string[];
}

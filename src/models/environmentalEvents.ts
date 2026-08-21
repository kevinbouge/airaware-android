export type EnvironmentalEventType =
  | 'pollen'
  | 'pollution'
  | 'saharan-dust'
  | 'wildfire-pollution'
  | 'aerosol'
  | 'uv'
  | 'mold'
  | 'headline-risk';

export type EnvironmentalEventSeverity = 'moderate' | 'high' | 'very-high';
export type EnvironmentalEventConfidence = 'low' | 'medium' | 'high';

export interface EnvironmentalEventEvidence {
  variable: string;
  value?: number | null | undefined;
  previousValue?: number | null | undefined;
  unit?: string | undefined;
  time?: string | undefined;
  role: 'primary' | 'supporting' | 'contradicting';
}

export interface EnvironmentalEvent {
  id: string;
  type: EnvironmentalEventType;
  severity: EnvironmentalEventSeverity;
  locationId: string;
  startTime: string;
  endTime?: string | undefined;
  peakTime?: string | undefined;
  factor?: string | undefined;
  previousCategory?: string | undefined;
  category?: string | undefined;
  currentValue?: number | null | undefined;
  peakValue?: number | null | undefined;
  confidence?: EnvironmentalEventConfidence | undefined;
  evidence: EnvironmentalEventEvidence[];
  title: string;
  body: string;
}

export type EnvironmentalEventNotificationCategory =
  'pollen' | 'airPollution' | 'saharanDust' | 'wildfirePollution' | 'uv' | 'mold' | 'headlineRisk';

export type EnvironmentalEventNotificationSettings = Record<
  EnvironmentalEventNotificationCategory,
  boolean
>;

export interface EnvironmentalEventNotificationRecord {
  fingerprint: string;
  severity: EnvironmentalEventSeverity;
  deliveredAt: string;
}

export interface EnvironmentalEventNotificationState {
  version: 1;
  records: EnvironmentalEventNotificationRecord[];
}

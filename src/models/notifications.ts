import type { RiskCategoryId } from './environment';

export type HeadlineScoreType = 'environmental' | 'personalized';

export type NotificationPermissionStatus = 'unknown' | 'granted' | 'denied' | 'unavailable';

export interface RiskNotificationTransitionState {
  version: 1;
  previousCategory: Exclude<RiskCategoryId, 'unavailable'>;
  previousScoreType: HeadlineScoreType;
  locationKey: string;
  profileFingerprint: string | null;
  lastObservationKey: string;
  lastDeliveredObservationKey: string | null;
  evaluatedAt: string;
}

export interface RiskTransition {
  scoreType: HeadlineScoreType;
  previousCategory: Exclude<RiskCategoryId, 'unavailable'>;
  currentCategory: Exclude<RiskCategoryId, 'unavailable'>;
  currentScore: number;
  occurredAt: string;
  locationLabel?: string;
}

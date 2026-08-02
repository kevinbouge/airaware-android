import type { RiskCategoryId } from './environment';
import type { AppSettings } from './profile';

export type HeadlineScoreType = AppSettings['headlineScore'];

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

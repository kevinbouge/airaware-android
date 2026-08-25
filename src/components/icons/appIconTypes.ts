import type { ActivityDomainId } from '../../models/activities';

export type AppIconName =
  | 'today'
  | 'data'
  | 'activities'
  | 'forecast'
  | 'profile'
  | 'pro'
  | 'settings'
  | 'location'
  | 'current-location'
  | 'location-management'
  | 'notifications'
  | 'notifications-off'
  | 'share'
  | 'refresh'
  | 'restore'
  | 'edit'
  | 'delete'
  | 'add'
  | 'minus'
  | 'info'
  | 'chevron-right'
  | 'back'
  | 'close'
  | 'calendar'
  | 'clock'
  | 'privacy'
  | 'external-link'
  | 'generic';

export type AppIconSize = 'inline' | 'navigation' | 'action' | 'activity' | 'card' | 'hero';

export type ActivityIconName = ActivityDomainId;

export const APP_ICON_STROKE_WIDTH = 2.25;

export const APP_ICON_SIZES: Record<AppIconSize, number> = {
  inline: 18,
  navigation: 21,
  action: 20,
  activity: 28,
  card: 34,
  hero: 44,
};

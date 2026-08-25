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
  | 'respiratory'
  | 'population-health'
  | 'trend-rising'
  | 'trend-falling'
  | 'trend-stable'
  | 'external-link'
  | 'generic';

export type AppIconSize =
  'inline' | 'navigation' | 'tabBrand' | 'action' | 'activity' | 'card' | 'hero';

export type ActivityIconName = ActivityDomainId;

export const APP_ICON_STROKE_WIDTH = 2.1;

export const APP_ICON_SIZES: Record<AppIconSize, number> = {
  inline: 18,
  navigation: 20,
  tabBrand: 22,
  action: 20,
  activity: 24,
  card: 28,
  hero: 36,
};

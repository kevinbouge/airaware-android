import { ACTIVITY_ICON_MAP, APP_ICON_MAP, type AppIconDefinition } from './appIconMap';
import type { ActivityIconName, AppIconName } from './appIconTypes';

export function getAppIconDefinition(name: AppIconName | string): AppIconDefinition {
  return APP_ICON_MAP[name as AppIconName] ?? APP_ICON_MAP.generic;
}

export function getActivityIconDefinition(name: ActivityIconName): AppIconDefinition {
  return ACTIVITY_ICON_MAP[name];
}

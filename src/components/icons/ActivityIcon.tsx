import { StyleSheet } from 'react-native';
import type { ActivityDomainId } from '../../models/activities';
import { colors } from '../../theme/theme';
import { getActivityIconDefinition } from './appIconResolver';
import { APP_ICON_SIZES, APP_ICON_STROKE_WIDTH, type AppIconSize } from './appIconTypes';

interface ActivityIconProps {
  activity: ActivityDomainId;
  size?: AppIconSize | number;
  color?: string;
  accessibilityLabel?: string | undefined;
}

function iconSize(size: ActivityIconProps['size']): number {
  if (typeof size === 'number') return size;

  return APP_ICON_SIZES[size ?? 'activity'];
}

export function ActivityIcon({
  activity,
  size = 'activity',
  color = colors.primary,
  accessibilityLabel,
}: ActivityIconProps) {
  const definition = getActivityIconDefinition(activity);
  const Icon = definition.component;
  const resolvedSize = iconSize(size);

  return (
    <Icon
      {...(accessibilityLabel ? { accessibilityLabel, accessibilityRole: 'image' as const } : {})}
      color={color}
      height={resolvedSize}
      strokeWidth={APP_ICON_STROKE_WIDTH}
      style={styles.icon}
      testID={`activity-icon-${activity}`}
      width={resolvedSize}
    />
  );
}

const styles = StyleSheet.create({
  icon: {
    flexShrink: 0,
  },
});

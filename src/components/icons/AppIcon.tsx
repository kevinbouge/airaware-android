import { StyleSheet } from 'react-native';
import { colors } from '../../theme/theme';
import { getAppIconDefinition } from './appIconResolver';
import {
  APP_ICON_SIZES,
  APP_ICON_STROKE_WIDTH,
  type AppIconName,
  type AppIconSize,
} from './appIconTypes';

interface AppIconProps {
  name: AppIconName | string;
  size?: AppIconSize | number;
  color?: string;
  accessibilityLabel?: string | undefined;
  testID?: string | undefined;
}

function iconSize(size: AppIconProps['size']): number {
  if (typeof size === 'number') return size;

  return APP_ICON_SIZES[size ?? 'inline'];
}

export function AppIcon({
  name,
  size = 'inline',
  color = colors.text,
  accessibilityLabel,
  testID,
}: AppIconProps) {
  const definition = getAppIconDefinition(name);
  const Icon = definition.component;
  const resolvedSize = iconSize(size);

  return (
    <Icon
      {...(accessibilityLabel ? { accessibilityLabel, accessibilityRole: 'image' as const } : {})}
      color={color}
      height={resolvedSize}
      strokeWidth={APP_ICON_STROKE_WIDTH}
      style={styles.icon}
      testID={testID ?? `app-icon-${name}`}
      width={resolvedSize}
    />
  );
}

const styles = StyleSheet.create({
  icon: {
    flexShrink: 0,
  },
});

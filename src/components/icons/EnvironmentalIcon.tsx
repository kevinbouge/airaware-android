import { memo } from 'react';
import { StyleSheet, View } from 'react-native';
import { colors } from '../../theme/theme';
import { environmentalIconAsset } from './environmentalIconMap';
import {
  ENVIRONMENTAL_ICON_SIZES,
  type EnvironmentalIconName,
  type EnvironmentalIconSize,
} from './environmentalIconTypes';

interface EnvironmentalIconProps {
  name: EnvironmentalIconName;
  size?: EnvironmentalIconSize | number | undefined;
  color?: string | undefined;
  accessibilityLabel?: string | undefined;
}

function iconSize(size: EnvironmentalIconProps['size']): number {
  if (typeof size === 'number') return size;
  if (size) return ENVIRONMENTAL_ICON_SIZES[size];
  return ENVIRONMENTAL_ICON_SIZES.measurement;
}

export const EnvironmentalIcon = memo(function EnvironmentalIcon({
  name,
  size,
  color = colors.primary,
  accessibilityLabel,
}: EnvironmentalIconProps) {
  const asset = environmentalIconAsset(name);
  const Icon = asset.Component;
  const resolvedSize = iconSize(size);

  return (
    <View
      accessibilityElementsHidden={!accessibilityLabel}
      accessibilityLabel={accessibilityLabel}
      accessibilityRole={accessibilityLabel ? 'image' : undefined}
      accessible={Boolean(accessibilityLabel)}
      importantForAccessibility={accessibilityLabel ? 'auto' : 'no-hide-descendants'}
      style={[styles.icon, { height: resolvedSize, width: resolvedSize }]}
      testID={`environmental-icon-${name}`}
    >
      <Icon color={color} height={resolvedSize} width={resolvedSize} />
    </View>
  );
});

const styles = StyleSheet.create({
  icon: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});

import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, spacing } from '../theme/theme';
import { AppIcon } from './icons/AppIcon';
import type { AppIconName } from './icons/appIconTypes';

interface AppButtonProps {
  title: string;
  onPress: () => void;
  iconName?: AppIconName | undefined;
  disabled?: boolean;
  selected?: boolean;
  rightLabel?: string | undefined;
  fullWidth?: boolean;
}

export function AppButton({
  title,
  onPress,
  iconName,
  disabled = false,
  selected = false,
  rightLabel,
  fullWidth = false,
}: AppButtonProps) {
  const contentColor = selected ? colors.surface : colors.text;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled, selected }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        rightLabel ? styles.splitButton : null,
        fullWidth ? styles.fullWidth : null,
        selected ? styles.selected : null,
        disabled ? styles.disabled : null,
        pressed && !disabled ? styles.pressed : null,
      ]}
    >
      <View style={[styles.labelGroup, rightLabel ? styles.splitLabelGroup : null]}>
        {iconName ? <AppIcon name={iconName} size="inline" color={contentColor} /> : null}
        <Text
          numberOfLines={rightLabel ? 1 : undefined}
          style={[styles.label, selected ? styles.selectedLabel : null]}
        >
          {title}
        </Text>
      </View>
      {rightLabel ? (
        <Text numberOfLines={1} style={[styles.rightLabel, selected ? styles.selectedLabel : null]}>
          {rightLabel}
        </Text>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 10,
    borderWidth: 1,
    minHeight: 48,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  disabled: {
    opacity: 0.55,
  },
  label: {
    color: colors.text,
    flexShrink: 1,
    fontSize: 15,
    fontWeight: '700',
  },
  labelGroup: {
    alignItems: 'center',
    flex: 1,
    flexDirection: 'row',
    gap: spacing.xs,
    justifyContent: 'center',
    minWidth: 0,
  },
  pressed: {
    opacity: 0.7,
  },
  selected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  selectedLabel: {
    color: colors.surface,
  },
  fullWidth: {
    width: '100%',
  },
  rightLabel: {
    color: colors.muted,
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'right',
  },
  splitButton: {
    flexDirection: 'row',
    gap: spacing.md,
    justifyContent: 'space-between',
  },
  splitLabelGroup: {
    justifyContent: 'flex-start',
  },
});

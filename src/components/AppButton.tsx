import { Pressable, StyleSheet, Text } from 'react-native';
import { colors, spacing } from '../theme/theme';

interface AppButtonProps {
  title: string;
  onPress: () => void;
  disabled?: boolean;
  selected?: boolean;
  rightLabel?: string;
  fullWidth?: boolean;
}

export function AppButton({
  title,
  onPress,
  disabled = false,
  selected = false,
  rightLabel,
  fullWidth = false,
}: AppButtonProps) {
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
      <Text style={[styles.label, selected ? styles.selectedLabel : null]}>{title}</Text>
      {rightLabel ? (
        <Text style={[styles.rightLabel, selected ? styles.selectedLabel : null]}>
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
    fontSize: 15,
    fontWeight: '700',
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
});

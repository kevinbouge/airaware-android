import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { colors, spacing } from '../theme/theme';

interface DetailHeaderProps {
  title: string;
  subtitle?: string | null;
  onBack: () => void;
}

export function DetailHeader({ title, subtitle, onBack }: DetailHeaderProps) {
  return (
    <View style={styles.container}>
      <Pressable
        accessibilityLabel="Back"
        accessibilityRole="button"
        hitSlop={spacing.sm}
        onPress={onBack}
        style={({ pressed }) => [styles.backButton, pressed ? styles.pressed : null]}
      >
        <BackChevron />
        <Text style={styles.backLabel}>Back</Text>
      </Pressable>
      <View style={styles.titleBlock}>
        <Text numberOfLines={1} style={styles.title}>
          {title}
        </Text>
        {subtitle ? (
          <Text numberOfLines={2} style={styles.subtitle}>
            {subtitle}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

function BackChevron() {
  return (
    <Svg fill="none" height={20} viewBox="0 0 24 24" width={20}>
      <Path
        d="M15 18 9 12l6-6"
        stroke={colors.primary}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2.4}
      />
    </Svg>
  );
}

const styles = StyleSheet.create({
  backButton: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.xs,
    minHeight: 44,
    paddingRight: spacing.md,
  },
  backLabel: {
    color: colors.primary,
    fontSize: 16,
    fontWeight: '700',
    lineHeight: 24,
  },
  container: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderBottomColor: colors.border,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: spacing.sm,
    minHeight: 56,
    paddingHorizontal: spacing.lg,
  },
  pressed: {
    opacity: 0.65,
  },
  subtitle: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '600',
  },
  title: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '800',
  },
  titleBlock: {
    flex: 1,
    minWidth: 0,
  },
});

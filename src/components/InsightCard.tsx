import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { ReactNode } from 'react';
import { colors, spacing } from '../theme/theme';

interface InsightCardProps {
  title: string;
  accent: string;
  primary: string;
  secondary?: string | undefined;
  details?: string[];
  compact?: boolean;
  icon?: ReactNode | undefined;
  onPress?: (() => void) | undefined;
  accessibilityLabel?: string | undefined;
}

export function InsightCard({
  title,
  accent,
  primary,
  secondary,
  details = [],
  compact = false,
  icon,
  onPress,
  accessibilityLabel,
}: InsightCardProps) {
  const content = (
    <View style={[styles.card, { borderLeftColor: accent }]}>
      <View style={styles.titleRow}>
        <View style={styles.titleWithIcon}>
          {icon}
          <Text style={styles.title}>{title}</Text>
        </View>
        {onPress ? <Text style={styles.chevron}>›</Text> : null}
      </View>
      <View style={styles.primaryRow}>
        <Text style={[styles.primary, compact ? styles.compactPrimary : null, { color: accent }]}>
          {primary}
        </Text>
        {secondary ? <Text style={[styles.secondary, { color: accent }]}>{secondary}</Text> : null}
      </View>
      {details.map((detail) => (
        <Text key={detail} style={styles.detail}>
          {detail}
        </Text>
      ))}
    </View>
  );

  if (!onPress) return content;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? `${title}. Opens details.`}
      onPress={onPress}
      style={({ pressed }) => pressed && styles.pressed}
    >
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderLeftWidth: 5,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    marginBottom: spacing.md,
    padding: spacing.lg,
  },
  chevron: {
    color: colors.muted,
    fontSize: 22,
    fontWeight: '700',
    lineHeight: 24,
  },
  detail: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '600',
    marginTop: spacing.xs,
  },
  pressed: {
    opacity: 0.82,
  },
  primary: {
    fontSize: 34,
    fontWeight: '800',
  },
  compactPrimary: {
    fontSize: 22,
  },
  primaryRow: {
    alignItems: 'baseline',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
    marginTop: spacing.xs,
  },
  secondary: {
    fontSize: 18,
    fontWeight: '700',
  },
  title: {
    color: colors.muted,
    fontSize: 14,
    fontWeight: '600',
  },
  titleRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
    justifyContent: 'space-between',
  },
  titleWithIcon: {
    alignItems: 'center',
    flexDirection: 'row',
    flexShrink: 1,
    gap: spacing.sm,
  },
});

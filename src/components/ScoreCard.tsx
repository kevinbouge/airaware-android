import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { RiskCategoryId } from '../models/environment';
import { categoryLabel } from '../core/categories';
import { colors, riskColor, spacing } from '../theme/theme';
import { formatScore } from '../utils/format';

interface ScoreCardProps {
  title: string;
  score: number | null;
  category: RiskCategoryId;
  subtitle?: string;
  details?: string[];
  onPress?: (() => void) | undefined;
}

export function ScoreCard({
  title,
  score,
  category,
  subtitle,
  details = [],
  onPress,
}: ScoreCardProps) {
  const accent = riskColor(category);
  const content = (
    <View style={[styles.card, { borderLeftColor: accent }]}>
      <Text style={styles.title}>{title}</Text>
      <View style={styles.scoreRow}>
        <Text style={[styles.score, { color: accent }]}>{formatScore(score)}</Text>
        <Text style={[styles.category, { color: accent }]}>{categoryLabel(category)}</Text>
      </View>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
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
      accessibilityLabel={`${title}: ${formatScore(score)}, ${categoryLabel(category)}`}
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
  category: {
    fontSize: 18,
    fontWeight: '700',
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
  score: {
    fontSize: 34,
    fontWeight: '800',
  },
  scoreRow: {
    alignItems: 'baseline',
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.xs,
  },
  subtitle: {
    color: colors.muted,
    marginTop: spacing.sm,
  },
  title: {
    color: colors.muted,
    fontSize: 14,
    fontWeight: '600',
  },
});

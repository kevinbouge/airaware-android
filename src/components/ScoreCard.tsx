import { StyleSheet, Text, View } from 'react-native';
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
}

export function ScoreCard({ title, score, category, subtitle, details = [] }: ScoreCardProps) {
  const accent = riskColor(category);

  return (
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

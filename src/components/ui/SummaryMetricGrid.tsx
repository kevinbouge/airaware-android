import { StyleSheet, Text, View } from 'react-native';
import { colors, spacing } from '../../theme/theme';

interface SummaryMetric {
  label: string;
  value: string;
  accent?: string;
}

interface SummaryMetricGridProps {
  metrics: readonly SummaryMetric[];
}

export function SummaryMetricGrid({ metrics }: SummaryMetricGridProps) {
  return (
    <View style={styles.grid}>
      {metrics.map((metric) => (
        <View key={metric.label} style={styles.item}>
          <Text style={styles.label}>{metric.label}</Text>
          <Text style={[styles.value, metric.accent ? { color: metric.accent } : null]}>
            {metric.value}
          </Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.lg,
  },
  item: {
    flexBasis: 132,
    flexGrow: 1,
    flexShrink: 1,
    minWidth: 132,
  },
  label: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: '600',
    marginBottom: spacing.xs,
  },
  value: {
    color: colors.text,
    fontSize: 24,
    fontWeight: '800',
    flexShrink: 1,
    lineHeight: 29,
  },
});

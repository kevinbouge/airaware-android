import { StyleSheet, Text, View, type DimensionValue } from 'react-native';
import { colors, spacing } from '../../theme/theme';

interface ForecastBarRowProps {
  label: string;
  value: string;
  accent: string;
  fillPercent: number | null;
  accessibilityLabel: string;
  highlighted?: boolean;
  highlightTone?: 'best' | 'worst';
  markerLabel?: string;
  reserveMarkerSpace?: boolean;
  valueMinWidth?: number;
}

export function ForecastBarRow({
  label,
  value,
  accent,
  fillPercent,
  accessibilityLabel,
  highlighted = false,
  highlightTone = 'best',
  markerLabel = '',
  reserveMarkerSpace = false,
  valueMinWidth = 44,
}: ForecastBarRowProps) {
  const hasFill = typeof fillPercent === 'number' && Number.isFinite(fillPercent);
  const fillWidth = `${Math.max(2, Math.min(100, fillPercent ?? 0))}%` as DimensionValue;
  const highlightStyle =
    highlightTone === 'worst' ? styles.worstHighlightedRow : styles.bestHighlightedRow;
  const markerColor = highlightTone === 'worst' ? colors.veryHigh : colors.primary;

  return (
    <View
      accessible
      accessibilityLabel={accessibilityLabel}
      style={[styles.row, highlighted ? highlightStyle : null]}
    >
      <Text numberOfLines={2} style={styles.label}>
        {label}
      </Text>
      <View style={styles.track}>
        {hasFill ? (
          <View style={[styles.fill, { backgroundColor: accent, width: fillWidth }]} />
        ) : null}
      </View>
      <Text numberOfLines={2} style={[styles.value, { color: accent, minWidth: valueMinWidth }]}>
        {value}
      </Text>
      {markerLabel || reserveMarkerSpace ? (
        <Text style={[styles.marker, { color: markerColor }]}>{markerLabel}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  fill: {
    borderRadius: 999,
    height: '100%',
  },
  bestHighlightedRow: {
    backgroundColor: colors.bestHighlight,
  },
  label: {
    color: colors.muted,
    flex: 0.85,
    fontSize: 13,
    minWidth: 72,
  },
  marker: {
    fontSize: 12,
    fontWeight: '700',
    minWidth: 32,
  },
  row: {
    alignItems: 'center',
    borderRadius: 8,
    flexDirection: 'row',
    gap: spacing.sm,
    minHeight: 30,
    paddingHorizontal: spacing.xs,
    paddingVertical: spacing.xs,
  },
  track: {
    backgroundColor: colors.forecastTrack,
    borderRadius: 999,
    flex: 1,
    height: 12,
    minWidth: 64,
    overflow: 'hidden',
  },
  value: {
    flex: 1,
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'right',
  },
  worstHighlightedRow: {
    backgroundColor: colors.worstHighlight,
  },
});

import { useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, View, type DimensionValue } from 'react-native';
import type {
  DataDetailTimeline,
  DataDetailVariableDefinition,
  DataTimelinePoint,
} from '../models/dataDetail';
import { dataDetailRiskCategory, formatDataDetailValue } from '../core/dataVariableMetadata';
import { colors, riskColor, spacing } from '../theme/theme';

const ROW_HEIGHT = 46;
interface VerticalTimelineChartProps {
  timeline: DataDetailTimeline;
  variable: DataDetailVariableDefinition;
}

function fillWidthForValue(value: number, min: number, max: number): DimensionValue {
  if (max <= min) return '2%';
  const ratio = ((value - min) / (max - min)) * 100;
  return `${Math.max(2, Math.min(100, ratio))}%`;
}

function PointRow({
  point,
  variable,
  domain,
}: {
  point: DataTimelinePoint;
  variable: DataDetailVariableDefinition;
  domain: NonNullable<DataDetailTimeline['domain']>;
}) {
  const hasValue = typeof point.value === 'number' && Number.isFinite(point.value);
  const value = hasValue ? point.value : null;
  const fillWidth = value !== null ? fillWidthForValue(value, domain.min, domain.max) : '0%';
  const category = dataDetailRiskCategory(variable, value);
  const valueColor = category ? riskColor(category) : colors.primary;

  return (
    <View
      style={[styles.pointRow, point.source === 'history' ? styles.historyRow : styles.forecastRow]}
    >
      <Text numberOfLines={1} style={styles.timeLabel}>
        {point.label}
      </Text>
      <View style={styles.track}>
        {value !== null ? (
          <View style={[styles.fill, { backgroundColor: valueColor, width: fillWidth }]} />
        ) : null}
      </View>
      <Text numberOfLines={1} style={[styles.valueLabel, { color: valueColor }]}>
        {hasValue ? formatDataDetailValue(variable, point.value) : 'Missing'}
      </Text>
    </View>
  );
}

export function VerticalTimelineChart({ timeline, variable }: VerticalTimelineChartProps) {
  const scrollRef = useRef<ScrollView>(null);
  const [viewportHeight, setViewportHeight] = useState(0);
  const historyPoints = useMemo(
    () => timeline.points.filter((point) => point.source === 'history'),
    [timeline.points],
  );
  const forecastPoints = useMemo(
    () => timeline.points.filter((point) => point.source === 'forecast'),
    [timeline.points],
  );
  const nowIndex = historyPoints.length;
  const nowOffset = nowIndex * ROW_HEIGHT;

  useEffect(() => {
    if (viewportHeight <= 0) return;
    const offset = Math.max(0, nowOffset - viewportHeight / 2);
    const timeout = setTimeout(
      () => scrollRef.current?.scrollTo({ y: offset, animated: false }),
      0,
    );
    return () => clearTimeout(timeout);
  }, [timeline.rangeId, nowOffset, viewportHeight]);

  if (!timeline.domain || timeline.points.length === 0) {
    return (
      <View style={styles.emptyChart}>
        <Text style={styles.emptyText}>{timeline.error ?? 'No timeline data is available.'}</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView
        ref={scrollRef}
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        nestedScrollEnabled
        onLayout={(event) => setViewportHeight(event.nativeEvent.layout.height)}
      >
        {historyPoints.map((point) => (
          <PointRow key={point.id} point={point} variable={variable} domain={timeline.domain!} />
        ))}
        <View style={styles.nowSeparator}>
          <View style={styles.nowLine} />
          <Text style={styles.nowLabel}>Now</Text>
          <View style={styles.nowLine} />
        </View>
        {forecastPoints.map((point) => (
          <PointRow key={point.id} point={point} variable={variable} domain={timeline.domain!} />
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 12,
    borderWidth: 1,
    flex: 1,
    overflow: 'hidden',
  },
  emptyChart: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 12,
    borderWidth: 1,
    padding: spacing.lg,
  },
  emptyText: {
    color: colors.muted,
    fontSize: 14,
  },
  fill: {
    borderRadius: 999,
    height: '100%',
  },
  forecastRow: {
    backgroundColor: '#FFF7EC',
  },
  historyRow: {
    backgroundColor: '#EEF5F0',
  },
  nowLabel: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  nowLine: {
    backgroundColor: colors.primary,
    flex: 1,
    height: 2,
  },
  nowSeparator: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
    height: ROW_HEIGHT,
    paddingHorizontal: spacing.md,
  },
  pointRow: {
    alignItems: 'center',
    flexDirection: 'row',
    height: ROW_HEIGHT,
    paddingHorizontal: spacing.md,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingVertical: spacing.xs,
  },
  timeLabel: {
    color: colors.muted,
    flex: 1.1,
    fontSize: 12,
  },
  track: {
    backgroundColor: '#E6ECE7',
    borderRadius: 999,
    flex: 1.2,
    height: 12,
    overflow: 'hidden',
  },
  valueLabel: {
    color: colors.text,
    flex: 0.8,
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'right',
  },
});

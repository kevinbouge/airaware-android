import { StyleSheet, Text, View, type DimensionValue } from 'react-native';
import { buildRiskTimelineRows, type TimelineScorePoint } from '../core/riskTimeline';
import type { OutdoorWindow } from '../models/environment';
import { colors, riskColor, spacing } from '../theme/theme';
import { formatScore, formatShortTime } from '../utils/format';

interface RiskForecastTimelineProps {
  current: TimelineScorePoint | null;
  hourly: TimelineScorePoint[];
  bestWindow: OutdoorWindow | null;
  unavailableLabel: string;
}

export function RiskForecastTimeline({
  current,
  hourly,
  bestWindow,
  unavailableLabel,
}: RiskForecastTimelineProps) {
  const rows = buildRiskTimelineRows(current, hourly, bestWindow);

  if (rows.length === 0) {
    return <Text style={styles.empty}>{unavailableLabel}</Text>;
  }

  return (
    <View style={styles.timeline}>
      {rows.map((row, index) => {
        const fillWidth = `${Math.max(2, Math.min(100, row.displayScore))}%` as DimensionValue;

        return (
          <View
            key={row.timestamp}
            accessibilityLabel={`${row.now ? 'Now' : formatShortTime(row.timestamp)} ${formatScore(row.score)}`}
            style={[styles.row, row.inBestWindow ? styles.bestWindowRow : null]}
          >
            <Text style={styles.time}>{row.now ? 'Now' : formatShortTime(row.timestamp)}</Text>
            <View style={styles.track}>
              <View
                style={[
                  styles.fill,
                  {
                    backgroundColor: riskColor(row.category),
                    width: fillWidth,
                  },
                ]}
              />
            </View>
            <Text style={[styles.score, { color: riskColor(row.category) }]}>
              {formatScore(row.score)}
            </Text>
            <Text style={styles.marker}>{row.markerLabel}</Text>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bestWindowRow: {
    backgroundColor: '#F2E8CF',
  },
  empty: {
    color: colors.muted,
    fontSize: 14,
  },
  fill: {
    borderRadius: 999,
    height: '100%',
  },
  marker: {
    color: colors.high,
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
  score: {
    fontSize: 13,
    fontWeight: '700',
    minWidth: 40,
    textAlign: 'right',
  },
  time: {
    color: colors.muted,
    fontSize: 13,
    minWidth: 58,
  },
  timeline: {
    gap: 2,
  },
  track: {
    backgroundColor: '#E6ECE7',
    borderRadius: 999,
    flex: 1,
    height: 12,
    overflow: 'hidden',
  },
});

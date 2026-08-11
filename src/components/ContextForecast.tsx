import { StyleSheet, Text, View, type DimensionValue } from 'react-native';
import { forecastDaysForCapabilities } from '../capabilities/forecast';
import { categoryLabel } from '../core/categories';
import { RiskForecastTimeline } from './RiskForecastTimeline';
import { SectionCard } from './SectionCard';
import type { AppCapabilities } from '../capabilities/types';
import type { OutdoorWindow, RiskCategoryId } from '../models/environment';
import { colors, riskColor, spacing } from '../theme/theme';
import { formatScore } from '../utils/format';

export interface ContextForecastScore {
  available: boolean;
  category: RiskCategoryId;
  score: number | null;
}

interface ForecastDayInput {
  date: string;
  label: string;
}

interface TimelinePointInput {
  timestamp: string;
  score: number | null;
  category: RiskCategoryId;
}

function DailyForecastRow({
  label,
  score,
}: {
  label: string;
  score: ContextForecastScore | null | undefined;
}) {
  const available =
    score?.available === true &&
    score.category !== 'unavailable' &&
    typeof score.score === 'number' &&
    Number.isFinite(score.score);
  const accent = available ? riskColor(score.category) : colors.unavailable;
  const fillWidth = `${Math.max(2, Math.min(100, score?.score ?? 0))}%` as DimensionValue;
  const value = available ? formatScore(score.score) : 'Unavailable';
  const accessibilityLabel = available
    ? `${label} ${categoryLabel(score.category)} ${value}`
    : `${label} unavailable`;

  return (
    <View accessibilityLabel={accessibilityLabel} style={styles.dailyRow}>
      <Text style={styles.dailyLabel}>{label}</Text>
      <View style={styles.dailyTrack}>
        {available ? (
          <View style={[styles.dailyFill, { backgroundColor: accent, width: fillWidth }]} />
        ) : null}
      </View>
      <Text style={[styles.dailyValue, { color: accent }]}>{value}</Text>
    </View>
  );
}

export function DailyForecastSection({
  title,
  days,
  capabilities,
  scoreForDate,
}: {
  title: string;
  days: readonly ForecastDayInput[];
  capabilities: AppCapabilities;
  scoreForDate: (date: string) => ContextForecastScore | null | undefined;
}) {
  const visibleDays = forecastDaysForCapabilities(days, capabilities);

  return (
    <SectionCard title={title}>
      {visibleDays.map((day) => (
        <DailyForecastRow key={day.date} label={day.label} score={scoreForDate(day.date)} />
      ))}
    </SectionCard>
  );
}

export function RiskTimelineSection({
  title,
  subtitle,
  current,
  hourly,
  bestWindow,
  unavailableLabel,
}: {
  title: string;
  subtitle: string;
  current: TimelinePointInput | null;
  hourly: TimelinePointInput[];
  bestWindow: OutdoorWindow | null;
  unavailableLabel: string;
}) {
  return (
    <SectionCard title={title} subtitle={subtitle}>
      <RiskForecastTimeline
        current={current}
        hourly={hourly}
        bestWindow={bestWindow}
        unavailableLabel={unavailableLabel}
      />
    </SectionCard>
  );
}

const styles = StyleSheet.create({
  dailyFill: {
    borderRadius: 999,
    height: '100%',
  },
  dailyLabel: {
    color: colors.muted,
    fontSize: 13,
    minWidth: 86,
  },
  dailyRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
    minHeight: 30,
    paddingHorizontal: spacing.xs,
    paddingVertical: spacing.xs,
  },
  dailyTrack: {
    backgroundColor: '#E6ECE7',
    borderRadius: 999,
    flex: 1,
    height: 12,
    overflow: 'hidden',
  },
  dailyValue: {
    fontSize: 13,
    fontWeight: '700',
    minWidth: 44,
    textAlign: 'right',
  },
});

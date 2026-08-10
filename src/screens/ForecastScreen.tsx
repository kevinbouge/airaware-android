import { ScrollView, StyleSheet, Text, View, type DimensionValue } from 'react-native';
import { forecastDaysForCapabilities } from '../capabilities/forecast';
import { categoryLabel } from '../core/categories';
import { RiskForecastTimeline } from '../components/RiskForecastTimeline';
import { SectionCard } from '../components/SectionCard';
import { StateView } from '../components/StateView';
import { useCapabilities } from '../hooks/useCapabilities';
import { useDerivedEnvironment } from '../hooks/useDerivedEnvironment';
import type { RiskCategoryId } from '../models/environment';
import { useAppStore } from '../state/useAppStore';
import { colors, riskColor, spacing } from '../theme/theme';
import { formatScore } from '../utils/format';

interface DailyForecastScore {
  available: boolean;
  category: RiskCategoryId;
  score: number | null;
}

function DailyForecastRow({ label, score }: { label: string; score: DailyForecastScore | null }) {
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

export function ForecastScreen() {
  const environment = useAppStore((state) => state.environment);
  const settings = useAppStore((state) => state.settings);
  const capabilities = useCapabilities();
  const {
    environmentalScore,
    personalizedScore,
    environmentalForecast,
    personalizedForecast,
    personalizedForecastDays,
    environmentalBestOutdoorWindow,
    personalizedBestOutdoorWindow,
  } = useDerivedEnvironment();

  if (!environment) return <StateView message="Forecast data is unavailable." />;

  const usePersonalized = settings.forecastScore === 'personalized';
  const personalizedByDate = new Map(personalizedForecastDays.map((day) => [day.date, day.score]));
  const visibleForecastDays = forecastDaysForCapabilities(environment.forecastDays, capabilities);
  const currentScore = usePersonalized ? personalizedScore : environmentalScore;
  const hourlyScores = usePersonalized ? personalizedForecast?.hours : environmentalForecast?.hours;
  const bestWindow = usePersonalized
    ? personalizedBestOutdoorWindow
    : environmentalBestOutdoorWindow;
  const title = usePersonalized ? 'Personalized risk forecast' : 'Environmental burden forecast';
  const unavailableLabel = usePersonalized
    ? 'Personalized forecast is unavailable.'
    : 'Environmental forecast is unavailable.';
  const currentTimelinePoint =
    currentScore?.available && environment.current.timestamp
      ? {
          timestamp: environment.current.timestamp,
          score: currentScore.score,
          category: currentScore.category,
        }
      : null;
  const currentDate = environment.current.timestamp?.slice(0, 10) ?? null;
  const hourlyTimelinePoints =
    hourlyScores?.map((hour) => ({
      timestamp: hour.timestamp,
      score: hour.result.score,
      category: hour.result.category,
    })) ?? [];
  const dailyScore = (date: string): DailyForecastScore | null => {
    if (date === currentDate && currentScore?.available) {
      return currentScore;
    }

    if (usePersonalized) {
      return personalizedByDate.get(date) ?? null;
    }

    return environment.forecastDays.find((day) => day.date === date)?.score ?? null;
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <SectionCard title={title}>
        {visibleForecastDays.map((day) => (
          <DailyForecastRow key={day.date} label={day.label} score={dailyScore(day.date)} />
        ))}
      </SectionCard>

      <SectionCard
        title={`${title} timeline`}
        subtitle="Next 24 hours. The highlighted range marks the best outdoor window."
      >
        <RiskForecastTimeline
          current={currentTimelinePoint}
          hourly={hourlyTimelinePoints}
          bestWindow={bestWindow}
          unavailableLabel={unavailableLabel}
        />
      </SectionCard>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: spacing.lg,
  },
  dailyLabel: {
    color: colors.muted,
    fontSize: 13,
    minWidth: 76,
  },
  dailyRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
    minHeight: 30,
    paddingHorizontal: spacing.xs,
    paddingVertical: spacing.xs,
  },
  dailyFill: {
    borderRadius: 999,
    height: '100%',
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
    minWidth: 40,
    textAlign: 'right',
  },
  screen: {
    backgroundColor: colors.background,
  },
});

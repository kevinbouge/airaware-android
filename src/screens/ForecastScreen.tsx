import { ScrollView, StyleSheet, Text, View } from 'react-native';
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
  const available = score?.available === true && score.category !== 'unavailable';
  const accent = available ? riskColor(score.category) : colors.unavailable;
  const value = available
    ? `${categoryLabel(score.category)} (${formatScore(score.score)})`
    : 'Unavailable';

  return (
    <View style={styles.dailyRow}>
      <Text style={styles.dailyLabel}>{label}</Text>
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
    color: colors.text,
    flex: 1,
    fontSize: 15,
  },
  dailyRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
    justifyContent: 'space-between',
    minHeight: 30,
  },
  dailyValue: {
    fontSize: 15,
    fontWeight: '700',
    minWidth: 116,
    textAlign: 'right',
  },
  screen: {
    backgroundColor: colors.background,
  },
});

import { ScrollView, StyleSheet } from 'react-native';
import { RiskForecastTimeline } from '../components/RiskForecastTimeline';
import { ReadingRow } from '../components/ReadingRow';
import { SectionCard } from '../components/SectionCard';
import { StateView } from '../components/StateView';
import { useDerivedEnvironment } from '../hooks/useDerivedEnvironment';
import { useAppStore } from '../state/useAppStore';
import { colors, spacing } from '../theme/theme';
import { formatCategoryScore } from '../utils/format';

export function ForecastScreen() {
  const environment = useAppStore((state) => state.environment);
  const settings = useAppStore((state) => state.settings);
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
  const dailyScoreLabel = (date: string): string => {
    if (date === currentDate && currentScore?.available) {
      return formatCategoryScore(currentScore.category, currentScore.score);
    }

    const score = usePersonalized
      ? personalizedByDate.get(date)
      : environment.forecastDays.find((day) => day.date === date)?.score;

    return score ? formatCategoryScore(score.category, score.score) : 'Unavailable';
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <SectionCard title={title}>
        {environment.forecastDays.map((day) => (
          <ReadingRow key={day.date} label={day.label} value={dailyScoreLabel(day.date)} />
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
  screen: {
    backgroundColor: colors.background,
  },
});

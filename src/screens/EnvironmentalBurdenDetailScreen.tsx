import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import {
  ContextForecastScore,
  DailyForecastSection,
  RiskTimelineSection,
} from '../components/ContextForecast';
import { CurrentReadingsSections } from '../components/CurrentReadingsSections';
import { DetailStateView } from '../components/DetailStateView';
import {
  NearbyVegetationSection,
  NEARBY_VEGETATION_SECTION_ID,
} from '../components/NearbyVegetationSection';
import { AppButton } from '../components/AppButton';
import { ScoreCard } from '../components/ScoreCard';
import { SectionCard } from '../components/SectionCard';
import { useCapabilities } from '../hooks/useCapabilities';
import { useDerivedEnvironment } from '../hooks/useDerivedEnvironment';
import { useAppStore } from '../state/useAppStore';
import { colors, spacing } from '../theme/theme';
import { contributorFromScore } from '../utils/contributorLabels';
import { formatShortTime } from '../utils/format';
import type { EnvironmentalVariableId } from '../capabilities/types';
import type { RootStackParamList } from '../navigation/AppNavigator';

interface DetailNavigation {
  goBack: () => void;
  navigate: <RouteName extends keyof RootStackParamList>(
    routeName: RouteName,
    params: RootStackParamList[RouteName],
  ) => void;
}

export function EnvironmentalBurdenDetailScreen() {
  const navigation = useNavigation<DetailNavigation>();
  const environment = useAppStore((state) => state.environment);
  const settings = useAppStore((state) => state.settings);
  const vegetation = useAppStore((state) => state.vegetation);
  const vegetationStale = useAppStore((state) => state.vegetationStale);
  const vegetationLoading = useAppStore((state) => state.vegetationLoading);
  const vegetationError = useAppStore((state) => state.vegetationError);
  const toggleCollapsedSection = useAppStore((state) => state.toggleCollapsedSection);
  const capabilities = useCapabilities();
  const { environmentalScore, environmentalForecast, environmentalBestOutdoorWindow } =
    useDerivedEnvironment();

  const openVariable = (variableId: EnvironmentalVariableId) => {
    navigation.navigate('DataDetail', { variableId });
  };
  const toggleSection = (sectionId: string) => {
    void toggleCollapsedSection(sectionId);
  };

  if (!environment || !environmentalScore?.available) {
    return (
      <DetailStateView
        message="Environmental burden data is unavailable."
        onBack={() => navigation.goBack()}
      />
    );
  }

  const currentDate = environment.current.timestamp?.slice(0, 10) ?? null;
  const currentTimelinePoint = environment.current.timestamp
    ? {
        timestamp: environment.current.timestamp,
        score: environmentalScore.score,
        category: environmentalScore.category,
      }
    : null;
  const hourlyTimelinePoints =
    environmentalForecast?.hours.map((hour) => ({
      timestamp: hour.timestamp,
      score: hour.result.score,
      category: hour.result.category,
    })) ?? [];
  const dailyScore = (date: string): ContextForecastScore | null => {
    if (date === currentDate) return environmentalScore;
    return environment.forecastDays.find((day) => day.date === date)?.score ?? null;
  };
  const contributor = contributorFromScore(environmentalScore);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <ScoreCard
        title="Environmental burden"
        score={environmentalScore.score}
        category={environmentalScore.category}
        details={[`Main factor: ${contributor.label ?? 'Unavailable'}`]}
      />

      {environmentalBestOutdoorWindow?.available ? (
        <SectionCard title="Best outdoor window">
          <Text style={styles.body}>
            {formatShortTime(environmentalBestOutdoorWindow.startTime)}–
            {formatShortTime(environmentalBestOutdoorWindow.endTime)}
          </Text>
        </SectionCard>
      ) : null}

      <DailyForecastSection
        title="Environmental burden forecast"
        days={environment.forecastDays}
        capabilities={capabilities}
        scoreForDate={dailyScore}
      />
      <RiskTimelineSection
        title="Environmental burden timeline"
        subtitle="Next 24 hours. The highlighted range marks the best outdoor window."
        current={currentTimelinePoint}
        hourly={hourlyTimelinePoints}
        bestWindow={environmentalBestOutdoorWindow}
        unavailableLabel="Environmental forecast is unavailable."
      />

      <CurrentReadingsSections
        capabilities={capabilities}
        collapsedSections={settings.collapsedSections}
        current={environment.current}
        onToggleSection={toggleSection}
        onOpenVariable={openVariable}
        beforeAdvancedSections={
          <NearbyVegetationSection
            vegetation={vegetation}
            stale={vegetationStale}
            loading={vegetationLoading}
            error={vegetationError}
            collapsed={settings.collapsedSections[NEARBY_VEGETATION_SECTION_ID] === true}
            onToggle={() => toggleSection(NEARBY_VEGETATION_SECTION_ID)}
          />
        }
      />

      <View style={styles.footer}>
        <AppButton title="Back" fullWidth onPress={() => navigation.goBack()} />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  body: {
    color: colors.text,
    fontWeight: '700',
  },
  content: {
    padding: spacing.lg,
  },
  footer: {
    marginTop: spacing.sm,
  },
  screen: {
    backgroundColor: colors.background,
  },
});

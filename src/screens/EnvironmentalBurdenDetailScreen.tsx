import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
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
import { DetailHeader } from '../components/DetailHeader';
import { SectionCard } from '../components/SectionCard';
import { SummaryMetricGrid } from '../components/ui/SummaryMetricGrid';
import { categoryLabel } from '../core/categories';
import { useCapabilities } from '../hooks/useCapabilities';
import { useDerivedEnvironment } from '../hooks/useDerivedEnvironment';
import { useAppStore } from '../state/useAppStore';
import { colors, riskColor, spacing } from '../theme/theme';
import { contributorFromScore } from '../utils/contributorLabels';
import { formatScore, formatTimeRangeWithTomorrow } from '../utils/format';
import type { EnvironmentalVariableId } from '../capabilities/types';
import type { RootStackParamList } from '../navigation/AppNavigator';
import { goBackOrToday, type DetailBackNavigation } from '../navigation/detailNavigation';

interface DetailNavigation extends DetailBackNavigation {
  navigate: <RouteName extends keyof RootStackParamList>(
    routeName: RouteName,
    params: RootStackParamList[RouteName],
  ) => void;
}

export function EnvironmentalBurdenDetailScreen() {
  const navigation = useNavigation<DetailNavigation>();
  const { t } = useTranslation();
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
  const handleBack = () => goBackOrToday(navigation);
  const toggleSection = (sectionId: string) => {
    void toggleCollapsedSection(sectionId);
  };

  if (!environment || !environmentalScore?.available) {
    return (
      <DetailStateView
        title={t('risk.environmentalBurden')}
        message={t('detail.environmentalBurdenUnavailable')}
        onBack={handleBack}
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
  const bestWindowValue =
    environmentalBestOutdoorWindow?.available &&
    environmentalBestOutdoorWindow.startTime &&
    environmentalBestOutdoorWindow.endTime
      ? formatTimeRangeWithTomorrow(
          environmentalBestOutdoorWindow.startTime,
          environmentalBestOutdoorWindow.endTime,
          environment.current.timestamp ?? environment.fetchedAt,
        )
      : t('common.unavailable');

  return (
    <View style={styles.screen}>
      <DetailHeader title={t('risk.environmentalBurden')} onBack={handleBack} />
      <ScrollView style={styles.scroller} contentContainerStyle={styles.content}>
        <SectionCard>
          <SummaryMetricGrid
            metrics={[
              {
                label: t('detail.score'),
                value: `${categoryLabel(environmentalScore.category)} · ${formatScore(
                  environmentalScore.score,
                )}`,
                accent: riskColor(environmentalScore.category),
              },
              {
                label: t('today.bestWindow'),
                value: bestWindowValue,
                compact: true,
              },
            ]}
          />
          <Text style={styles.body}>
            {t('today.mainFactor')}: {contributor.label ?? t('common.unavailable')}
          </Text>
        </SectionCard>

        <DailyForecastSection
          title={t('detail.dailyForecast')}
          days={environment.forecastDays}
          capabilities={capabilities}
          scoreForDate={dailyScore}
        />
        <RiskTimelineSection
          title={t('detail.hourlyForecast')}
          current={currentTimelinePoint}
          hourly={hourlyTimelinePoints}
          bestWindow={environmentalBestOutdoorWindow}
          unavailableLabel={t('detail.environmentalForecastUnavailable')}
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
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  body: {
    color: colors.muted,
    fontSize: 14,
    fontWeight: '600',
  },
  content: {
    padding: spacing.lg,
  },
  screen: {
    backgroundColor: colors.background,
    flex: 1,
  },
  scroller: {
    backgroundColor: colors.background,
  },
});

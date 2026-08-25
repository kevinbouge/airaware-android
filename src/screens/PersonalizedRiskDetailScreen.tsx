import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import {
  ContextForecastScore,
  DailyForecastSection,
  RiskTimelineSection,
} from '../components/ContextForecast';
import { DetailHeader } from '../components/DetailHeader';
import { DetailStateView } from '../components/DetailStateView';
import { ReadingRow } from '../components/ReadingRow';
import { SectionCard } from '../components/SectionCard';
import { SummaryMetricGrid } from '../components/ui/SummaryMetricGrid';
import { profileForCapabilities } from '../capabilities/variables';
import { categoryLabel } from '../core/categories';
import {
  currentDataDetailValue,
  dataDetailVariable,
  formatDataDetailValue,
} from '../core/dataVariableMetadata';
import { useCapabilities } from '../hooks/useCapabilities';
import { useDerivedEnvironment } from '../hooks/useDerivedEnvironment';
import { useAppStore } from '../state/useAppStore';
import { colors, riskColor, spacing } from '../theme/theme';
import { contributorFromScore } from '../utils/contributorLabels';
import { formatScore, formatTimeRangeWithTomorrow } from '../utils/format';
import type { EnvironmentalVariableId } from '../capabilities/types';
import type { ProfileFactorId } from '../models/profile';
import type { RootStackParamList } from '../navigation/AppNavigator';
import { goBackOrToday, type DetailBackNavigation } from '../navigation/detailNavigation';

interface DetailNavigation extends DetailBackNavigation {
  navigate: <RouteName extends keyof RootStackParamList>(
    routeName: RouteName,
    params: RootStackParamList[RouteName],
  ) => void;
}

const PROFILE_VARIABLES: Record<ProfileFactorId, EnvironmentalVariableId> = {
  pollen_alder: 'pollen_alder',
  pollen_birch: 'pollen_birch',
  pollen_grass: 'pollen_grass',
  pollen_mugwort: 'pollen_mugwort',
  pollen_olive: 'pollen_olive',
  pollen_ragweed: 'pollen_ragweed',
  pm25: 'pm25',
  pm10: 'pm10',
  nitrogen_dioxide: 'nitrogenDioxide',
  ozone: 'ozone',
  sulphur_dioxide: 'sulphurDioxide',
  carbon_monoxide: 'carbonMonoxide',
  aerosol_optical_depth: 'aerosolOpticalDepth',
  dust: 'dust',
  wildfire_pm10: 'wildfirePm10',
  mold: 'moldPotential',
  uv_index: 'uvIndex',
};

export function PersonalizedRiskDetailScreen() {
  const navigation = useNavigation<DetailNavigation>();
  const { t } = useTranslation();
  const environment = useAppStore((state) => state.environment);
  const profile = useAppStore((state) => state.profile);
  const capabilities = useCapabilities();
  const {
    personalizedScore,
    personalizedForecast,
    personalizedForecastDays,
    personalizedBestOutdoorWindow,
  } = useDerivedEnvironment();
  const effectiveProfile = profileForCapabilities(capabilities, profile);
  const handleBack = () => goBackOrToday(navigation);

  if (!environment || !effectiveProfile.enabled || !personalizedScore.available) {
    return (
      <DetailStateView
        title={t('risk.personalizedRisk')}
        message={t('detail.personalizedRiskUnavailable')}
        onBack={handleBack}
      />
    );
  }

  const selectedRows = (Object.keys(effectiveProfile.factors) as ProfileFactorId[]).flatMap(
    (factorId) => {
      if (!effectiveProfile.factors[factorId]) return [];
      const variableId = PROFILE_VARIABLES[factorId];
      const definition = dataDetailVariable(variableId);
      const value = definition ? currentDataDetailValue(environment.current, definition) : null;
      if (!definition || value === null) return [];

      return [
        {
          variableId,
          label: definition.label,
          value: formatDataDetailValue(definition, value),
        },
      ];
    },
  );
  const currentDate = environment.current.timestamp?.slice(0, 10) ?? null;
  const personalizedByDate = new Map(personalizedForecastDays.map((day) => [day.date, day.score]));
  const currentTimelinePoint = environment.current.timestamp
    ? {
        timestamp: environment.current.timestamp,
        score: personalizedScore.score,
        category: personalizedScore.category,
      }
    : null;
  const hourlyTimelinePoints =
    personalizedForecast?.hours.map((hour) => ({
      timestamp: hour.timestamp,
      score: hour.result.score,
      category: hour.result.category,
    })) ?? [];
  const dailyScore = (date: string): ContextForecastScore | null | undefined => {
    if (date === currentDate) return personalizedScore;
    return personalizedByDate.get(date);
  };
  const contributor = contributorFromScore(personalizedScore);
  const bestWindowValue =
    personalizedBestOutdoorWindow?.available &&
    personalizedBestOutdoorWindow.startTime &&
    personalizedBestOutdoorWindow.endTime
      ? formatTimeRangeWithTomorrow(
          personalizedBestOutdoorWindow.startTime,
          personalizedBestOutdoorWindow.endTime,
          environment.current.timestamp ?? environment.fetchedAt,
        )
      : t('common.unavailable');

  return (
    <View style={styles.screen}>
      <DetailHeader title={t('risk.personalizedRisk')} onBack={handleBack} />
      <ScrollView style={styles.scroller} contentContainerStyle={styles.content}>
        <SectionCard>
          <SummaryMetricGrid
            metrics={[
              {
                label: t('detail.score'),
                value: `${categoryLabel(personalizedScore.category)} · ${formatScore(
                  personalizedScore.score,
                )}`,
                accent: riskColor(personalizedScore.category),
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
          bestWindow={personalizedBestOutdoorWindow}
          unavailableLabel={t('detail.personalizedForecastUnavailable')}
        />

        <SectionCard title={t('detail.yourFactors')}>
          {selectedRows.length > 0 ? (
            selectedRows.map((row) => (
              <ReadingRow
                key={row.variableId}
                label={row.label}
                value={row.value}
                variableId={row.variableId}
                onPress={(variableId) => navigation.navigate('DataDetail', { variableId })}
              />
            ))
          ) : (
            <Text style={styles.muted}>{t('detail.noSelectedFactors')}</Text>
          )}
        </SectionCard>
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
  muted: {
    color: colors.muted,
  },
  screen: {
    backgroundColor: colors.background,
    flex: 1,
  },
  scroller: {
    backgroundColor: colors.background,
  },
});

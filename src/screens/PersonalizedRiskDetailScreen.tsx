import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import {
  ContextForecastScore,
  DailyForecastSection,
  RiskTimelineSection,
} from '../components/ContextForecast';
import { AppButton } from '../components/AppButton';
import { DetailStateView } from '../components/DetailStateView';
import { ReadingRow } from '../components/ReadingRow';
import { ScoreCard } from '../components/ScoreCard';
import { SectionCard } from '../components/SectionCard';
import { profileForCapabilities } from '../capabilities/variables';
import {
  currentDataDetailValue,
  dataDetailVariable,
  formatDataDetailValue,
} from '../core/dataVariableMetadata';
import { useCapabilities } from '../hooks/useCapabilities';
import { useDerivedEnvironment } from '../hooks/useDerivedEnvironment';
import { useAppStore } from '../state/useAppStore';
import { colors, spacing } from '../theme/theme';
import { contributorFromScore } from '../utils/contributorLabels';
import { formatShortTime } from '../utils/format';
import type { EnvironmentalVariableId } from '../capabilities/types';
import type { ProfileFactorId } from '../models/profile';
import type { RootStackParamList } from '../navigation/AppNavigator';

interface DetailNavigation {
  goBack: () => void;
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

  if (!environment || !effectiveProfile.enabled || !personalizedScore.available) {
    return (
      <DetailStateView
        message="Personalized risk data is unavailable."
        onBack={() => navigation.goBack()}
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

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <ScoreCard
        title="Personalized risk"
        score={personalizedScore.score}
        category={personalizedScore.category}
        details={[`Main factor: ${contributor.label ?? 'Unavailable'}`]}
      />

      {personalizedBestOutdoorWindow?.available ? (
        <SectionCard title="Best window">
          <Text style={styles.body}>
            {formatShortTime(personalizedBestOutdoorWindow.startTime)}–
            {formatShortTime(personalizedBestOutdoorWindow.endTime)}
          </Text>
        </SectionCard>
      ) : null}

      <DailyForecastSection
        title="Personalized risk forecast"
        days={environment.forecastDays}
        capabilities={capabilities}
        scoreForDate={dailyScore}
      />
      <RiskTimelineSection
        title="Personalized risk timeline"
        subtitle="Next 24 hours. The highlighted range marks the best window."
        current={currentTimelinePoint}
        hourly={hourlyTimelinePoints}
        bestWindow={personalizedBestOutdoorWindow}
        unavailableLabel="Personalized forecast is unavailable."
      />

      <SectionCard title="Your factors">
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
          <Text style={styles.muted}>No selected factors are currently available.</Text>
        )}
      </SectionCard>

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
  muted: {
    color: colors.muted,
  },
  screen: {
    backgroundColor: colors.background,
  },
});

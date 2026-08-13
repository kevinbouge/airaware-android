import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useMemo } from 'react';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import { ActivityForecastTimeline } from '../components/ActivityForecastTimeline';
import { DetailHeader } from '../components/DetailHeader';
import { DetailStateView } from '../components/DetailStateView';
import { ReadingRow } from '../components/ReadingRow';
import { SectionCard } from '../components/SectionCard';
import { ForecastBarSection } from '../components/ForecastSections';
import { SummaryMetricGrid } from '../components/ui/SummaryMetricGrid';
import { forecastDaysForCapabilities } from '../capabilities/forecast';
import { activityDefinition } from '../core/activityDefinitions';
import {
  activityCategoryLabel,
  activityVariableValue,
  bestActivityWindowForDate,
  bestActivityWindowForRange,
  evaluateActivity,
  formatActivityScore,
  formatActivityWindow,
} from '../core/activityEvaluator';
import { dataDetailVariable, formatDataDetailValue } from '../core/dataVariableMetadata';
import { useCapabilities } from '../hooks/useCapabilities';
import { useAppStore } from '../state/useAppStore';
import { colors, spacing } from '../theme/theme';
import { formatScore } from '../utils/format';
import { displayScore } from '../utils/number';
import type { EnvironmentalVariableId } from '../capabilities/types';
import type { HourlyEnvironmentalReading } from '../models/environment';
import type { ActivitySuitabilityCategory, ActivityWindowResult } from '../models/activities';
import type { RootStackParamList } from '../navigation/AppNavigator';
import { goBackOrToday, type DetailBackNavigation } from '../navigation/detailNavigation';

type ActivityDetailRoute = RouteProp<RootStackParamList, 'ActivityDetail'>;

interface ActivityDetailNavigation extends DetailBackNavigation {
  navigate: <RouteName extends keyof RootStackParamList>(
    routeName: RouteName,
    params: RootStackParamList[RouteName],
  ) => void;
}

function rowValue(
  variableId: EnvironmentalVariableId,
  reading: HourlyEnvironmentalReading,
): string | null {
  const definition = dataDetailVariable(variableId);
  if (!definition) return null;

  const value = activityVariableValue(reading, variableId);
  if (value === null) return null;

  return formatDataDetailValue(definition, value);
}

function activityColor(category: ActivitySuitabilityCategory): string {
  switch (category) {
    case 'excellent':
      return colors.low;
    case 'good':
      return colors.primary;
    case 'fair':
      return colors.moderate;
    case 'poor':
      return colors.high;
    case 'unsuitable':
      return colors.veryHigh;
    case 'insufficientData':
      return colors.unavailable;
  }
}

function buildActivityForecastRow({
  date,
  label,
  window,
  best,
  reserveBestSpace,
}: {
  date: string;
  label: string;
  window: ActivityWindowResult;
  best: boolean;
  reserveBestSpace: boolean;
}) {
  const available = window.available && typeof window.averageScore === 'number';
  const category = window.category;
  const accent = activityColor(category);
  const value = available ? formatScore(window.averageScore) : 'Unavailable';
  const displayValue = available ? `${activityCategoryLabel(category)} · ${value}` : value;

  return {
    accessibilityLabel: `${label} ${displayValue}`,
    accent,
    fillPercent: available ? window.averageScore : null,
    key: date,
    label,
    highlighted: best,
    markerLabel: best ? 'Best' : '',
    reserveMarkerSpace: reserveBestSpace,
    value: displayValue,
  };
}

function bestActivityForecastDates(
  windows: { date: string; window: ActivityWindowResult }[],
): Set<string> {
  const availableWindows = windows.filter(
    (item): item is { date: string; window: ActivityWindowResult & { averageScore: number } } =>
      item.window.available &&
      typeof item.window.averageScore === 'number' &&
      Number.isFinite(item.window.averageScore),
  );
  const bestScore = availableWindows
    .map((item) => displayScore(item.window.averageScore) ?? 0)
    .sort((left, right) => right - left)[0];

  if (bestScore === undefined) return new Set();

  return new Set(
    availableWindows
      .filter((item) => (displayScore(item.window.averageScore) ?? 0) === bestScore)
      .map((item) => item.date),
  );
}

export function ActivityDetailScreen() {
  const navigation = useNavigation<ActivityDetailNavigation>();
  const route = useRoute<ActivityDetailRoute>();
  const loading = useAppStore((state) => state.loading);
  const environment = useAppStore((state) => state.environment);
  const settings = useAppStore((state) => state.settings);
  const capabilities = useCapabilities();
  const activityId = route.params?.activityId;
  const definition = activityId ? activityDefinition(activityId) : null;
  const handleBack = () => goBackOrToday(navigation);
  const activityEnabled = definition ? settings.enabledActivities[definition.id] === true : false;
  const nowTimestamp = environment?.current.timestamp ?? environment?.fetchedAt ?? '';
  const visibleForecastDays = useMemo(
    () => forecastDaysForCapabilities(environment?.forecastDays ?? [], capabilities),
    [capabilities, environment?.forecastDays],
  );
  const evaluation = useMemo(
    () =>
      environment && definition && activityEnabled
        ? evaluateActivity(definition, {
            coordinates: environment.coordinates,
            now: environment.current.timestamp ?? environment.fetchedAt,
            hourly: environment.hourly,
            enabledActivities: settings.enabledActivities,
            forecastDates: visibleForecastDays.map((day) => day.date),
          })
        : null,
    [activityEnabled, definition, environment, settings.enabledActivities, visibleForecastDays],
  );
  const detailReading = useMemo(() => {
    if (!environment || !evaluation?.current) return null;
    return (
      environment.hourly.find((hour) => hour.timestamp === evaluation.current?.timestamp) ?? null
    );
  }, [environment, evaluation]);
  const conditionRows = useMemo(() => {
    if (!definition || !detailReading) return [];

    return definition.detailVariables.flatMap((variableId) => {
      const detailDefinition = dataDetailVariable(variableId);
      const value = rowValue(variableId, detailReading);
      if (!detailDefinition || !value) return [];

      return [
        {
          label: detailDefinition.label,
          value,
          variableId,
        },
      ];
    });
  }, [definition, detailReading]);
  const forecastRows = useMemo(() => {
    if (!definition || !evaluation) return [];

    const windows = visibleForecastDays.map((day) => ({
      date: day.date,
      label: day.label,
      window: bestActivityWindowForDate(evaluation.hours, day.date),
    }));
    const bestDates = bestActivityForecastDates(windows);

    return windows.map((day) =>
      buildActivityForecastRow({
        date: day.date,
        label: day.label,
        window: day.window,
        best: bestDates.has(day.date),
        reserveBestSpace: bestDates.size > 0,
      }),
    );
  }, [definition, evaluation, visibleForecastDays]);

  if (!capabilities.activities.available) {
    return (
      <DetailStateView
        title={definition?.label ?? 'Activities'}
        message="Activities require AirAware Pro."
        onBack={handleBack}
      />
    );
  }

  if (!definition) {
    return <DetailStateView message="Activity data is unavailable." onBack={handleBack} />;
  }

  if (!activityEnabled) {
    return (
      <DetailStateView
        title={definition.label}
        message="Enable this activity in Settings to view details."
        onBack={handleBack}
      />
    );
  }

  if (loading) {
    return (
      <DetailStateView
        title={definition.label}
        loading
        message="Updating activity data..."
        onBack={handleBack}
      />
    );
  }

  if (!evaluation) {
    return (
      <DetailStateView
        title={definition.label}
        message="Activity data is unavailable."
        onBack={handleBack}
      />
    );
  }

  const currentCategory = evaluation.current?.category ?? 'insufficientData';
  const currentAccent = activityColor(currentCategory);
  const timelineBestWindow = bestActivityWindowForRange(
    evaluation.hours,
    evaluation.current?.timestamp ?? nowTimestamp,
    24,
  );

  return (
    <View style={styles.screen}>
      <DetailHeader
        title={definition.label}
        subtitle={definition.description}
        onBack={handleBack}
      />
      <ScrollView style={styles.scroller} contentContainerStyle={styles.content}>
        <SectionCard>
          <SummaryMetricGrid
            metrics={[
              {
                label: 'Suitability',
                value: formatActivityScore(evaluation),
                accent: currentAccent,
              },
              {
                label: 'Best window',
                value: formatActivityWindow(timelineBestWindow, nowTimestamp),
                compact: true,
              },
            ]}
          />
          {!evaluation.available ? (
            <Text style={styles.notice}>{activityCategoryLabel('insufficientData')}</Text>
          ) : null}
        </SectionCard>

        <SectionCard title="Why">
          {evaluation.reasons.map((reason) => (
            <Text key={reason} style={styles.reason}>
              - {reason}
            </Text>
          ))}
        </SectionCard>

        <ForecastBarSection
          title="Daily forecast"
          rows={forecastRows}
          emptyLabel="Forecast data is unavailable."
        />

        <SectionCard title="24-hour forecast" contentTopSpacing={spacing.lg}>
          <ActivityForecastTimeline
            hours={evaluation.hours}
            now={evaluation.current?.timestamp ?? nowTimestamp}
            bestWindow={timelineBestWindow}
            unavailableLabel="Activity outlook is unavailable."
          />
        </SectionCard>

        <SectionCard title="Conditions">
          {conditionRows.length > 0 ? (
            conditionRows.map((row) => (
              <ReadingRow
                key={row.variableId}
                label={row.label}
                value={row.value}
                variableId={row.variableId}
                onPress={(nextVariableId) =>
                  navigation.navigate('DataDetail', { variableId: nextVariableId })
                }
              />
            ))
          ) : (
            <Text style={styles.notice}>Current activity measurements are unavailable.</Text>
          )}
        </SectionCard>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: spacing.lg,
  },
  notice: {
    color: colors.muted,
    lineHeight: 20,
  },
  reason: {
    color: colors.text,
    lineHeight: 20,
  },
  screen: {
    backgroundColor: colors.background,
    flex: 1,
  },
  scroller: {
    backgroundColor: colors.background,
  },
});

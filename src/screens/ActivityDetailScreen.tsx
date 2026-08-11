import { ScrollView, StyleSheet, Text, View, type DimensionValue } from 'react-native';
import { useMemo } from 'react';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import { AppButton } from '../components/AppButton';
import { ActivityForecastTimeline } from '../components/ActivityForecastTimeline';
import { DetailStateView } from '../components/DetailStateView';
import { ReadingRow } from '../components/ReadingRow';
import { SectionCard } from '../components/SectionCard';
import { forecastDaysForCapabilities } from '../capabilities/forecast';
import { activityDefinition } from '../core/activityDefinitions';
import {
  activityCategoryLabel,
  activityVariableValue,
  bestActivityWindowForDate,
  evaluateActivity,
  formatActivityScore,
  formatActivityWindow,
} from '../core/activityEvaluator';
import { dataDetailVariable, formatDataDetailValue } from '../core/dataVariableMetadata';
import { useCapabilities } from '../hooks/useCapabilities';
import { useAppStore } from '../state/useAppStore';
import { colors, spacing } from '../theme/theme';
import { formatScore } from '../utils/format';
import type { EnvironmentalVariableId } from '../capabilities/types';
import type { HourlyEnvironmentalReading } from '../models/environment';
import type { ActivitySuitabilityCategory, ActivityWindowResult } from '../models/activities';
import type { RootStackParamList } from '../navigation/AppNavigator';

type ActivityDetailRoute = RouteProp<RootStackParamList, 'ActivityDetail'>;

interface ActivityDetailNavigation {
  goBack: () => void;
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

function ActivityForecastRow({ label, window }: { label: string; window: ActivityWindowResult }) {
  const available = window.available && typeof window.averageScore === 'number';
  const category = window.category;
  const accent = activityColor(category);
  const fillWidth = `${Math.max(2, Math.min(100, window.averageScore ?? 0))}%` as DimensionValue;
  const value = available ? formatScore(window.averageScore) : 'Unavailable';

  return (
    <View style={styles.forecastRow}>
      <Text style={styles.forecastLabel}>{label}</Text>
      <View style={styles.forecastTrack}>
        {available ? (
          <View style={[styles.forecastFill, { backgroundColor: accent, width: fillWidth }]} />
        ) : null}
      </View>
      <Text style={[styles.forecastValue, { color: accent }]}>
        {available ? `${activityCategoryLabel(category)} · ${value}` : value}
      </Text>
    </View>
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

  if (!capabilities.activities.available) {
    return (
      <DetailStateView
        message="Activities require AirAware Pro."
        onBack={() => navigation.goBack()}
      />
    );
  }

  if (!definition) {
    return (
      <DetailStateView message="Activity data is unavailable." onBack={() => navigation.goBack()} />
    );
  }

  if (!activityEnabled) {
    return (
      <DetailStateView
        message="Enable this activity in Settings to view details."
        onBack={() => navigation.goBack()}
      />
    );
  }

  if (loading) {
    return (
      <DetailStateView
        loading
        message="Updating activity data..."
        onBack={() => navigation.goBack()}
      />
    );
  }

  if (!evaluation) {
    return (
      <DetailStateView message="Activity data is unavailable." onBack={() => navigation.goBack()} />
    );
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <SectionCard title={definition.label} subtitle={definition.description}>
        <Text style={styles.category}>{formatActivityScore(evaluation)}</Text>
        <Text style={styles.window}>
          Best window: {formatActivityWindow(evaluation.bestWindow)}
        </Text>
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

      <SectionCard title={`${definition.label} forecast`}>
        {visibleForecastDays.map((day) => (
          <ActivityForecastRow
            key={day.date}
            label={day.label}
            window={bestActivityWindowForDate(evaluation.hours, day.date, definition.windowHours)}
          />
        ))}
      </SectionCard>

      <SectionCard
        title={`${definition.label} 24-hour outlook`}
        subtitle="Next 24 hours. The highlighted range marks the best window."
      >
        <ActivityForecastTimeline
          hours={evaluation.hours}
          now={evaluation.current?.timestamp ?? nowTimestamp}
          bestWindow={evaluation.bestWindow}
          unavailableLabel="Activity outlook is unavailable."
        />
      </SectionCard>

      <SectionCard title="Conditions">
        {detailReading ? (
          definition.detailVariables.flatMap((variableId) => {
            const detailDefinition = dataDetailVariable(variableId);
            const value = rowValue(variableId, detailReading);
            if (!detailDefinition || !value) return [];

            return [
              <ReadingRow
                key={variableId}
                label={detailDefinition.label}
                value={value}
                variableId={variableId}
                onPress={(nextVariableId) =>
                  navigation.navigate('DataDetail', { variableId: nextVariableId })
                }
              />,
            ];
          })
        ) : (
          <Text style={styles.notice}>Current activity measurements are unavailable.</Text>
        )}
      </SectionCard>

      {definition.disclaimer ? (
        <SectionCard>
          <Text style={styles.notice}>{definition.disclaimer}</Text>
        </SectionCard>
      ) : null}

      <View style={styles.footer}>
        <AppButton title="Back" fullWidth onPress={() => navigation.goBack()} />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  category: {
    color: colors.primary,
    fontSize: 24,
    fontWeight: '800',
  },
  content: {
    padding: spacing.lg,
  },
  footer: {
    marginTop: spacing.sm,
  },
  forecastFill: {
    borderRadius: 999,
    height: '100%',
  },
  forecastLabel: {
    color: colors.muted,
    fontSize: 13,
    minWidth: 86,
  },
  forecastRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
    minHeight: 30,
    paddingHorizontal: spacing.xs,
    paddingVertical: spacing.xs,
  },
  forecastTrack: {
    backgroundColor: '#E6ECE7',
    borderRadius: 999,
    flex: 1,
    height: 12,
    overflow: 'hidden',
  },
  forecastValue: {
    fontSize: 13,
    fontWeight: '700',
    minWidth: 76,
    textAlign: 'right',
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
  },
  window: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '600',
  },
});

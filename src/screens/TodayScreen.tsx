import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useMemo } from 'react';
import { useNavigation } from '@react-navigation/native';
import { AppButton } from '../components/AppButton';
import { InsightCard } from '../components/InsightCard';
import { ScoreCard } from '../components/ScoreCard';
import { SectionCard } from '../components/SectionCard';
import { StateView } from '../components/StateView';
import { GasMaskIcon } from '../components/icons/GasMaskIcon';
import { useCapabilities } from '../hooks/useCapabilities';
import { useDerivedEnvironment } from '../hooks/useDerivedEnvironment';
import {
  activityCategoryLabel,
  evaluateActivities,
  formatActivityScore,
  formatActivityWindow,
} from '../core/activityEvaluator';
import { useAppStore } from '../state/useAppStore';
import { colors, riskColor, spacing } from '../theme/theme';
import { formatCoordinates, formatShortTime, formatTimestamp } from '../utils/format';
import { contributorFromScore } from '../utils/contributorLabels';
import type { ActivitySuitabilityCategory } from '../models/activities';
import type { RootStackParamList } from '../navigation/AppNavigator';

interface TodayNavigation {
  navigate: <RouteName extends keyof RootStackParamList>(
    routeName: RouteName,
    params: RootStackParamList[RouteName],
  ) => void;
}

function formatUpdateStatus(
  fetchedAt: string | null,
  stale: boolean,
  metadata: {
    airQualitySource?: 'fresh' | 'cached' | 'unavailable';
    weatherSource?: 'fresh' | 'cached' | 'unavailable';
  } | null,
): string {
  if (!stale) {
    return `Updated ${formatTimestamp(fetchedAt)}`;
  }

  const cachedParts = [
    metadata?.airQualitySource === 'cached' ? 'air quality' : null,
    metadata?.weatherSource === 'cached' ? 'weather' : null,
  ].filter((item): item is string => item !== null);

  if (cachedParts.length === 0 || cachedParts.length === 2) {
    return 'Cached data';
  }

  return `Cached ${cachedParts.join(', ')}`;
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

function appendAvailableWindowDetail(
  details: string[],
  label: string,
  window: { available: boolean; startTime: string | null; endTime: string | null } | null,
) {
  if (!window?.available || !window.startTime || !window.endTime) return details;

  return [
    ...details,
    `${label}: ${formatShortTime(window.startTime)}–${formatShortTime(window.endTime)}`,
  ];
}

export function TodayScreen() {
  const navigation = useNavigation<TodayNavigation>();
  const hydrated = useAppStore((state) => state.hydrated);
  const loading = useAppStore((state) => state.loading);
  const stale = useAppStore((state) => state.stale);
  const error = useAppStore((state) => state.error);
  const shareMessage = useAppStore((state) => state.shareMessage);
  const location = useAppStore((state) => state.location);
  const settings = useAppStore((state) => state.settings);
  const environment = useAppStore((state) => state.environment);
  const refresh = useAppStore((state) => state.refresh);
  const updateSettings = useAppStore((state) => state.updateSettings);
  const shareDailySummary = useAppStore((state) => state.shareDailySummary);
  const capabilities = useCapabilities();
  const {
    environmentalScore,
    personalizedScore,
    environmentalBestOutdoorWindow,
    personalizedBestOutdoorWindow,
  } = useDerivedEnvironment();
  const activityEvaluations = useMemo(
    () =>
      environment && capabilities.activities.available
        ? evaluateActivities({
            coordinates: environment.coordinates,
            now: environment.current.timestamp ?? environment.fetchedAt,
            hourly: environment.hourly,
            enabledActivities: settings.enabledActivities,
          })
        : [],
    [capabilities.activities.available, environment, settings.enabledActivities],
  );

  const startLocationRefresh = async () => {
    await updateSettings({ locationOnboardingComplete: true });
    await refresh();
  };

  if (!hydrated) return <StateView loading message="Loading AirAware..." />;

  const headlineCategory = personalizedScore.available
    ? personalizedScore.category
    : environmentalScore?.category;
  const locationLabel =
    environment?.placeName ??
    location.placeName ??
    formatCoordinates(environment?.coordinates ?? location.coordinates) ??
    'Location not set';
  const environmentalMainFactor = contributorFromScore(environmentalScore);
  const personalizedMainFactor = contributorFromScore(personalizedScore);
  const updateStatus = formatUpdateStatus(
    environment?.fetchedAt ?? null,
    stale,
    environment?.metadata ?? null,
  );
  const environmentalDetails = appendAvailableWindowDetail(
    [`Main factor: ${environmentalMainFactor.label ?? 'Unavailable'}`],
    'Best window',
    environmentalBestOutdoorWindow,
  );
  const personalizedDetails = appendAvailableWindowDetail(
    [`Main factor: ${personalizedMainFactor.label ?? 'Unavailable'}`],
    'Best window',
    personalizedBestOutdoorWindow,
  );

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={refresh} />}
    >
      <View style={styles.header}>
        <View style={styles.brandRow}>
          <GasMaskIcon
            size={36}
            color={headlineCategory ? riskColor(headlineCategory) : colors.unavailable}
          />
          <Text style={styles.brand}>AirAware</Text>
        </View>
        <Text style={styles.place}>{locationLabel}</Text>
      </View>

      {error ? <Text style={styles.notice}>{error}</Text> : null}

      {environmentalScore?.available ? (
        <ScoreCard
          title="Environmental burden"
          score={environmentalScore.score}
          category={environmentalScore.category}
          details={environmentalDetails}
          onPress={() => navigation.navigate('EnvironmentalBurdenDetail', undefined)}
        />
      ) : null}

      {personalizedScore.available ? (
        <ScoreCard
          title="Personalized risk"
          score={personalizedScore.score}
          category={personalizedScore.category}
          details={personalizedDetails}
          onPress={() => navigation.navigate('PersonalizedRiskDetail', undefined)}
        />
      ) : null}

      {environment ? (
        <>
          {activityEvaluations.length > 0 ? (
            <View style={styles.activitySection}>
              <Text style={styles.sectionTitle}>Activities</Text>
              {activityEvaluations.map((activity) => (
                <InsightCard
                  key={activity.id}
                  title={activity.label}
                  accent={activityColor(activity.current?.category ?? 'insufficientData')}
                  primary={
                    activity.current
                      ? activityCategoryLabel(activity.current.category)
                      : 'Unavailable'
                  }
                  compact
                  secondary={
                    activity.current?.available ? `${activity.current.displayScore}%` : undefined
                  }
                  details={[
                    `Best window: ${formatActivityWindow(activity.bestWindow)}`,
                    ...(!activity.available ? [activityCategoryLabel('insufficientData')] : []),
                  ]}
                  accessibilityLabel={`${activity.label}: ${formatActivityScore(activity)}. Opens details.`}
                  onPress={() => navigation.navigate('ActivityDetail', { activityId: activity.id })}
                />
              ))}
            </View>
          ) : null}

          <View style={styles.actions}>
            {shareMessage ? <Text style={styles.shareMessage}>{shareMessage}</Text> : null}
            <AppButton
              title={loading ? 'Refreshing...' : 'Refresh'}
              rightLabel={updateStatus}
              fullWidth
              onPress={refresh}
              disabled={loading}
            />
            <AppButton title="Share" onPress={shareDailySummary} />
          </View>
        </>
      ) : (
        <SectionCard title="Location required">
          <Text style={styles.body}>
            AirAware needs approximate location or manual coordinates to retrieve local
            environmental conditions. Your coordinates are sent only to Open-Meteo for local
            environmental data.
          </Text>
          <AppButton
            title="Continue and refresh"
            onPress={startLocationRefresh}
            disabled={loading}
          />
        </SectionCard>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  actions: {
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  activitySection: {
    marginBottom: spacing.sm,
  },
  body: {
    color: colors.text,
    lineHeight: 20,
  },
  brand: {
    color: colors.text,
    fontSize: 28,
    fontWeight: '800',
  },
  brandRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
  },
  content: {
    padding: spacing.lg,
  },
  header: {
    marginBottom: spacing.lg,
  },
  notice: {
    backgroundColor: '#FFF3CD',
    borderRadius: 8,
    color: '#604B00',
    marginBottom: spacing.md,
    padding: spacing.md,
  },
  place: {
    color: colors.muted,
    fontSize: 16,
    marginTop: spacing.xs,
  },
  screen: {
    backgroundColor: colors.background,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '700',
    marginBottom: spacing.sm,
  },
  pressed: {
    opacity: 0.82,
  },
  shareMessage: {
    color: colors.muted,
    fontSize: 13,
    textAlign: 'center',
  },
});

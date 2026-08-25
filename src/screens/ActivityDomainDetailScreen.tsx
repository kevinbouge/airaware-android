import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useMemo } from 'react';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import { DetailHeader } from '../components/DetailHeader';
import { DetailStateView } from '../components/DetailStateView';
import { InsightCard } from '../components/InsightCard';
import { ActivityIcon } from '../components/icons/ActivityIcon';
import { activityDomain, activityProfilesForDomain } from '../core/activityDefinitions';
import {
  activityCategoryLabel,
  bestActivityWindowForRange,
  evaluateActivity,
  formatActivityWindow,
} from '../core/activityEvaluator';
import { forecastDaysForCapabilities } from '../capabilities/forecast';
import { useCapabilities } from '../hooks/useCapabilities';
import { useAppStore } from '../state/useAppStore';
import { colors, spacing } from '../theme/theme';
import type { ActivitySemanticType, ActivitySuitabilityCategory } from '../models/activities';
import type { RootStackParamList } from '../navigation/AppNavigator';
import { goBackOrToday, type DetailBackNavigation } from '../navigation/detailNavigation';

type ActivityDomainDetailRoute = RouteProp<RootStackParamList, 'ActivityDomainDetail'>;

interface ActivityDomainDetailNavigation extends DetailBackNavigation {
  navigate: <RouteName extends keyof RootStackParamList>(
    routeName: RouteName,
    params: RootStackParamList[RouteName],
  ) => void;
}

function activityColor(
  category: ActivitySuitabilityCategory,
  semanticType: ActivitySemanticType,
): string {
  if (semanticType === 'risk') {
    switch (category) {
      case 'excellent':
        return colors.veryHigh;
      case 'good':
        return colors.high;
      case 'fair':
        return colors.moderate;
      case 'poor':
        return colors.primary;
      case 'unsuitable':
        return colors.low;
      case 'insufficientData':
        return colors.unavailable;
    }
  }

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

export function ActivityDomainDetailScreen() {
  const navigation = useNavigation<ActivityDomainDetailNavigation>();
  const route = useRoute<ActivityDomainDetailRoute>();
  const environment = useAppStore((state) => state.environment);
  const loading = useAppStore((state) => state.loading);
  const settings = useAppStore((state) => state.settings);
  const capabilities = useCapabilities();
  const domainId = route.params?.domainId;
  const domain = domainId ? activityDomain(domainId) : null;
  const handleBack = () => goBackOrToday(navigation);
  const domainEnabled = domain ? settings.enabledActivities[domain.id] === true : false;
  const nowTimestamp = environment?.current.timestamp ?? environment?.fetchedAt ?? '';
  const visibleForecastDays = useMemo(
    () => forecastDaysForCapabilities(environment?.forecastDays ?? [], capabilities),
    [capabilities, environment?.forecastDays],
  );
  const profileEvaluations = useMemo(() => {
    if (!environment || !domain || !domainEnabled) return [];

    return activityProfilesForDomain(domain.id).map((definition) =>
      evaluateActivity(definition, {
        coordinates: environment.coordinates,
        now: environment.current.timestamp ?? environment.fetchedAt,
        hourly: environment.hourly,
        enabledActivities: settings.enabledActivities,
        forecastDates: visibleForecastDays.map((day) => day.date),
      }),
    );
  }, [domain, domainEnabled, environment, settings.enabledActivities, visibleForecastDays]);

  if (!capabilities.activities.available) {
    return (
      <DetailStateView
        title={domain?.label ?? 'Activities'}
        message="Activities require AirAware Pro."
        onBack={handleBack}
      />
    );
  }

  if (!domain) {
    return <DetailStateView message="Activity data is unavailable." onBack={handleBack} />;
  }

  if (!domainEnabled) {
    return (
      <DetailStateView
        title={domain.label}
        message="Enable this activity domain in Settings to view details."
        onBack={handleBack}
      />
    );
  }

  if (loading) {
    return (
      <DetailStateView
        title={domain.label}
        loading
        message="Updating activity data..."
        onBack={handleBack}
      />
    );
  }

  return (
    <View style={styles.screen}>
      <DetailHeader
        title={domain.label}
        subtitle={domain.description}
        icon={<ActivityIcon activity={domain.id} size="activity" />}
        onBack={handleBack}
      />
      <ScrollView style={styles.scroller} contentContainerStyle={styles.content}>
        <Text style={styles.sectionTitle}>Professional profiles</Text>
        {profileEvaluations.length > 0 ? (
          profileEvaluations.map((profile) => {
            const category = profile.current?.category ?? 'insufficientData';
            const displayWindow = bestActivityWindowForRange(
              profile.hours,
              profile.current?.timestamp ?? nowTimestamp,
              24,
              profile.minimumUsefulWindowDuration,
            );
            const windowLabel =
              profile.semanticType === 'risk' ? 'Peak risk window' : 'Best window';

            return (
              <InsightCard
                key={profile.id}
                title={profile.label}
                icon={<ActivityIcon activity={domain.id} size="activity" color={colors.text} />}
                accent={activityColor(category, profile.semanticType)}
                primary={activityCategoryLabel(category, profile.semanticType)}
                secondary={
                  profile.current?.available && profile.current.displayScore !== null
                    ? `${profile.current.displayScore}%`
                    : undefined
                }
                compact
                details={[
                  `${windowLabel}: ${formatActivityWindow(displayWindow, nowTimestamp)}`,
                  profile.dataCompleteness.status === 'reduced'
                    ? `Reduced data: ${profile.dataCompleteness.availableFactors} / ${profile.dataCompleteness.expectedFactors} factors`
                    : null,
                ].filter((item): item is string => item !== null)}
                onPress={() =>
                  navigation.navigate('ActivityDetail', {
                    domainId: domain.id,
                    profileId: profile.id,
                  })
                }
              />
            );
          })
        ) : (
          <Text style={styles.notice}>Activity profiles are unavailable.</Text>
        )}
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
  sectionTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '700',
    marginBottom: spacing.sm,
  },
  screen: {
    backgroundColor: colors.background,
    flex: 1,
  },
  scroller: {
    backgroundColor: colors.background,
  },
});

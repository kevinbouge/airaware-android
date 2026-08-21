import {
  Modal,
  Pressable,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useMemo, useState } from 'react';
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
  bestActivityWindowForRange,
  evaluateActivityDomains,
  formatActivityWindow,
} from '../core/activityEvaluator';
import { useAppStore } from '../state/useAppStore';
import { colors, riskColor, spacing } from '../theme/theme';
import {
  formatCoordinates,
  formatMeasurement,
  formatTimeRangeWithTomorrow,
  formatTimestamp,
} from '../utils/format';
import { contributorFromScore } from '../utils/contributorLabels';
import type { ActivitySemanticType, ActivitySuitabilityCategory } from '../models/activities';
import type { RootStackParamList } from '../navigation/AppNavigator';
import { coordinatesForSavedLocation } from '../models/location';
import type { EnvironmentalEvent } from '../models/environmentalEvents';

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

function activityColor(
  category: ActivitySuitabilityCategory,
  semanticType: ActivitySemanticType = 'suitability',
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

function appendAvailableWindowDetail(
  details: string[],
  label: string,
  window: { available: boolean; startTime: string | null; endTime: string | null } | null,
  referenceTime: string | null,
) {
  if (!window?.available || !window.startTime || !window.endTime) return details;

  return [
    ...details,
    `${label}: ${formatTimeRangeWithTomorrow(window.startTime, window.endTime, referenceTime)}`,
  ];
}

function locationSelectorRightLabel(input: {
  selected: boolean;
  coordinates: ReturnType<typeof coordinatesForSavedLocation>;
}): string | undefined {
  if (input.selected) return 'Active';
  if (!input.coordinates) return undefined;
  return formatCoordinates(input.coordinates) ?? undefined;
}

function eventIcon(event: EnvironmentalEvent): string {
  switch (event.type) {
    case 'pollen':
      return '🌾';
    case 'saharan-dust':
      return '🟠';
    case 'wildfire-pollution':
      return '🔥';
    case 'uv':
      return '☀️';
    case 'mold':
      return '🍄';
    case 'pollution':
    case 'aerosol':
      return '🌫️';
    case 'headline-risk':
      return '🎯';
  }
}

function eventSeverityColor(event: EnvironmentalEvent): string {
  if (event.severity === 'very-high') return colors.veryHigh;
  if (event.severity === 'high') return colors.high;
  return colors.moderate;
}

function eventTimingLabel(event: EnvironmentalEvent, referenceTime: string | null): string {
  if (!event.endTime || event.startTime === event.endTime) {
    return event.peakTime
      ? `Peaks ${formatTimestamp(event.peakTime)}`
      : formatTimestamp(event.startTime);
  }

  return formatTimeRangeWithTomorrow(event.startTime, event.endTime, referenceTime);
}

function evidenceLabel(variable: string): string {
  const labels: Record<string, string> = {
    dust: 'Saharan dust',
    pm10: 'PM10',
    pm2_5: 'PM2.5',
    pm10_wildfires: 'Wildfire-related PM10',
    aerosol_optical_depth: 'Aerosol optical depth',
    pm2_5_total_organic_matter: 'PM2.5 organic matter',
    total_elementary_carbon: 'Total elementary carbon',
    uv_index: 'UV index',
    mold_potential: 'Mold potential',
    environmental_burden: 'Environmental burden',
    personalized_risk: 'Personalized risk',
  };

  return labels[variable] ?? variable.replaceAll('_', ' ');
}

function formatEvidenceValue(value: number | null | undefined, unit: string | undefined): string {
  if (unit === undefined) return formatMeasurement(value ?? null, '', 1);
  return formatMeasurement(value ?? null, unit, unit === 'µg/m³' || unit === 'grains/m³' ? 0 : 1);
}

export function TodayScreen() {
  const navigation = useNavigation<TodayNavigation>();
  const [locationSelectorVisible, setLocationSelectorVisible] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<EnvironmentalEvent | null>(null);
  const hydrated = useAppStore((state) => state.hydrated);
  const loading = useAppStore((state) => state.loading);
  const stale = useAppStore((state) => state.stale);
  const error = useAppStore((state) => state.error);
  const shareMessage = useAppStore((state) => state.shareMessage);
  const location = useAppStore((state) => state.location);
  const settings = useAppStore((state) => state.settings);
  const environment = useAppStore((state) => state.environment);
  const environmentalEvents = useAppStore((state) => state.environmentalEvents);
  const refresh = useAppStore((state) => state.refresh);
  const updateSettings = useAppStore((state) => state.updateSettings);
  const setActiveLocation = useAppStore((state) => state.setActiveLocation);
  const shareDailySummary = useAppStore((state) => state.shareDailySummary);
  const capabilities = useCapabilities();
  const {
    environmentalScore,
    personalizedScore,
    environmentalBestOutdoorWindow,
    personalizedBestOutdoorWindow,
  } = useDerivedEnvironment();
  const activityDomainEvaluations = useMemo(
    () =>
      environment && capabilities.activities.available
        ? evaluateActivityDomains({
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
    await refresh({ force: true });
  };

  if (!hydrated) return <StateView loading message="Loading AirAware..." />;

  const headlineCategory = personalizedScore.available
    ? personalizedScore.category
    : environmentalScore?.category;
  const locationLabel =
    location.activeLocationName ??
    environment?.placeName ??
    location.placeName ??
    formatCoordinates(environment?.coordinates ?? location.coordinates) ??
    'Location not set';
  const locationDetail =
    environment?.placeName && environment.placeName !== locationLabel
      ? environment.placeName
      : formatCoordinates(environment?.coordinates ?? location.coordinates);
  const environmentalMainFactor = contributorFromScore(environmentalScore);
  const personalizedMainFactor = contributorFromScore(personalizedScore);
  const updateStatus = formatUpdateStatus(
    environment?.fetchedAt ?? null,
    stale,
    environment?.metadata ?? null,
  );
  const referenceTime = environment?.current.timestamp ?? environment?.fetchedAt ?? null;
  const environmentalDetails = appendAvailableWindowDetail(
    [`Main factor: ${environmentalMainFactor.label ?? 'Unavailable'}`],
    'Best window',
    environmentalBestOutdoorWindow,
    referenceTime,
  );
  const personalizedDetails = appendAvailableWindowDetail(
    [`Main factor: ${personalizedMainFactor.label ?? 'Unavailable'}`],
    'Best window',
    personalizedBestOutdoorWindow,
    referenceTime,
  );

  return (
    <>
      <ScrollView
        style={styles.screen}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={loading} onRefresh={() => refresh({ force: true })} />
        }
      >
        <View style={styles.header}>
          <View style={styles.brandRow}>
            <GasMaskIcon
              size={36}
              color={headlineCategory ? riskColor(headlineCategory) : colors.unavailable}
            />
            <Text style={styles.brand}>AirAware</Text>
          </View>
          <Pressable
            accessibilityRole="button"
            onPress={() => setLocationSelectorVisible(true)}
            style={({ pressed }) => [pressed ? styles.pressed : null]}
          >
            <Text style={styles.place}>{locationLabel}</Text>
            {locationDetail ? <Text style={styles.placeDetail}>{locationDetail}</Text> : null}
          </Pressable>
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

        {environmentalEvents.length > 0 ? (
          <View style={styles.eventSection}>
            <Text style={styles.sectionTitle}>Environmental events</Text>
            {environmentalEvents.slice(0, 4).map((event) => (
              <Pressable
                key={event.id}
                accessibilityRole="button"
                onPress={() => setSelectedEvent(event)}
                style={({ pressed }) => [styles.eventCard, pressed ? styles.pressed : null]}
              >
                <View style={styles.eventHeader}>
                  <Text style={styles.eventTitle}>
                    {eventIcon(event)} {event.title}
                  </Text>
                  <Text style={[styles.eventSeverity, { color: eventSeverityColor(event) }]}>
                    {event.category ?? event.severity}
                  </Text>
                </View>
                <Text style={styles.eventTiming}>{eventTimingLabel(event, referenceTime)}</Text>
                <Text style={styles.eventBody}>{event.body}</Text>
              </Pressable>
            ))}
          </View>
        ) : null}

        {environment ? (
          <>
            {activityDomainEvaluations.length > 0 ? (
              <View style={styles.activitySection}>
                <Text style={styles.sectionTitle}>Activities</Text>
                {activityDomainEvaluations.map((domain) => {
                  const previewProfiles = domain.profiles.slice(0, 2);
                  const best = domain.bestOpportunity;
                  const displayWindow =
                    best !== null
                      ? bestActivityWindowForRange(
                          best.hours,
                          best.current?.timestamp ?? referenceTime ?? '',
                          24,
                          best.minimumUsefulWindowDuration,
                        )
                      : null;
                  const primaryProfile = previewProfiles[0];

                  return (
                    <InsightCard
                      key={domain.id}
                      title={domain.label}
                      accent={activityColor(
                        primaryProfile?.current?.category ?? 'insufficientData',
                        primaryProfile?.semanticType,
                      )}
                      primary={
                        primaryProfile?.current
                          ? activityCategoryLabel(
                              primaryProfile.current.category,
                              primaryProfile.semanticType,
                            )
                          : 'Unavailable'
                      }
                      compact
                      secondary={primaryProfile?.label}
                      details={[
                        ...previewProfiles.map((profile) =>
                          profile.current
                            ? `${profile.label}: ${activityCategoryLabel(
                                profile.current.category,
                                profile.semanticType,
                              )}`
                            : `${profile.label}: Unavailable`,
                        ),
                        best && displayWindow
                          ? `Best opportunity: ${best.label} · ${formatActivityWindow(
                              displayWindow,
                              referenceTime,
                            )}`
                          : 'Best opportunity: Unavailable',
                      ]}
                      accessibilityLabel={`${domain.label}. Opens professional profiles.`}
                      onPress={() =>
                        navigation.navigate('ActivityDomainDetail', { domainId: domain.id })
                      }
                    />
                  );
                })}
              </View>
            ) : null}

            <View style={styles.actions}>
              {shareMessage ? <Text style={styles.shareMessage}>{shareMessage}</Text> : null}
              <AppButton
                title={loading ? 'Refreshing...' : 'Refresh'}
                rightLabel={updateStatus}
                fullWidth
                onPress={() => refresh({ force: true })}
                disabled={loading}
              />
              <AppButton title="Share" onPress={shareDailySummary} />
            </View>
          </>
        ) : (
          <SectionCard title="Location required">
            <Text style={styles.body}>
              AirAware needs Current location or a saved manual location to retrieve local
              environmental conditions. Coordinates are sent only to environmental providers that
              need them.
            </Text>
            <AppButton
              title="Continue and refresh"
              onPress={startLocationRefresh}
              disabled={loading}
            />
          </SectionCard>
        )}
      </ScrollView>
      <Modal
        animationType="fade"
        onRequestClose={() => setLocationSelectorVisible(false)}
        transparent
        visible={locationSelectorVisible}
      >
        <SafeAreaView style={styles.selectorOverlay}>
          <View style={styles.selectorPanel}>
            <Text style={styles.selectorTitle}>Active location</Text>
            <ScrollView
              style={styles.selectorList}
              contentContainerStyle={styles.selectorListContent}
            >
              {settings.locations.map((savedLocation) => {
                const selected = savedLocation.id === settings.activeLocationId;
                const coordinates = coordinatesForSavedLocation(savedLocation);

                return (
                  <AppButton
                    key={savedLocation.id}
                    title={savedLocation.name}
                    rightLabel={locationSelectorRightLabel({ selected, coordinates })}
                    selected={selected}
                    fullWidth
                    disabled={selected}
                    onPress={() => {
                      void setActiveLocation(savedLocation.id);
                      setLocationSelectorVisible(false);
                    }}
                  />
                );
              })}
            </ScrollView>
            <AppButton title="Close" fullWidth onPress={() => setLocationSelectorVisible(false)} />
          </View>
        </SafeAreaView>
      </Modal>
      <Modal
        animationType="fade"
        onRequestClose={() => setSelectedEvent(null)}
        transparent
        visible={selectedEvent !== null}
      >
        <SafeAreaView style={styles.selectorOverlay}>
          <View style={styles.selectorPanel}>
            {selectedEvent ? (
              <>
                <Text style={styles.selectorTitle}>{selectedEvent.title}</Text>
                <Text style={styles.eventTiming}>
                  Expected: {eventTimingLabel(selectedEvent, referenceTime)}
                </Text>
                {selectedEvent.peakTime ? (
                  <Text style={styles.eventTiming}>
                    Peak: {formatTimestamp(selectedEvent.peakTime)}
                  </Text>
                ) : null}
                <Text style={styles.body}>{selectedEvent.body}</Text>
                {selectedEvent.evidence.slice(0, 4).map((evidence) => (
                  <View key={`${evidence.variable}:${evidence.role}`} style={styles.evidenceRow}>
                    <Text style={styles.evidenceVariable}>{evidenceLabel(evidence.variable)}</Text>
                    <Text style={styles.evidenceValue}>
                      {formatEvidenceValue(evidence.value, evidence.unit)}
                    </Text>
                  </View>
                ))}
                <Text style={styles.notice}>
                  Data: Open-Meteo Air Quality API using CAMS forecasts. Environmental conditions
                  only, not medical advice.
                </Text>
              </>
            ) : null}
            <AppButton title="Close" fullWidth onPress={() => setSelectedEvent(null)} />
          </View>
        </SafeAreaView>
      </Modal>
    </>
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
  eventBody: {
    color: colors.text,
    fontSize: 13,
    lineHeight: 19,
  },
  eventCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    gap: spacing.xs,
    padding: spacing.md,
  },
  eventHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
    justifyContent: 'space-between',
  },
  eventSection: {
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  eventSeverity: {
    fontSize: 13,
    fontWeight: '800',
  },
  eventTiming: {
    color: colors.muted,
    fontSize: 13,
  },
  eventTitle: {
    color: colors.text,
    flex: 1,
    fontSize: 15,
    fontWeight: '800',
  },
  evidenceRow: {
    alignItems: 'center',
    borderBottomColor: colors.border,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing.xs,
  },
  evidenceValue: {
    color: colors.text,
    fontWeight: '700',
  },
  evidenceVariable: {
    color: colors.muted,
    flex: 1,
    marginRight: spacing.md,
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
  placeDetail: {
    color: colors.muted,
    fontSize: 13,
    marginTop: spacing.xs,
  },
  screen: {
    backgroundColor: colors.background,
  },
  selectorOverlay: {
    backgroundColor: 'rgba(23, 32, 26, 0.28)',
    flex: 1,
    justifyContent: 'flex-end',
  },
  selectorPanel: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    gap: spacing.sm,
    maxHeight: '82%',
    padding: spacing.lg,
  },
  selectorList: {
    maxHeight: '78%',
  },
  selectorListContent: {
    gap: spacing.sm,
  },
  selectorTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '700',
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

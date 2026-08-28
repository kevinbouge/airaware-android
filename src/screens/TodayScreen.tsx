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
import { useTranslation } from 'react-i18next';
import { useNavigation } from '@react-navigation/native';
import { AppButton } from '../components/AppButton';
import { InsightCard } from '../components/InsightCard';
import { ScoreCard } from '../components/ScoreCard';
import { SectionCard } from '../components/SectionCard';
import { StateView } from '../components/StateView';
import { ActivityIcon } from '../components/icons/ActivityIcon';
import { AppIcon } from '../components/icons/AppIcon';
import { APP_ICON_SIZES } from '../components/icons/appIconTypes';
import { EnvironmentalIcon } from '../components/icons/EnvironmentalIcon';
import { ENVIRONMENTAL_ICON_SIZES } from '../components/icons/environmentalIconTypes';
import { GasMaskIcon } from '../components/icons/GasMaskIcon';
import { getEventIconName } from '../components/icons/environmentalIconResolver';
import {
  environmentalEventBody,
  environmentalEventCategoryLabel,
  environmentalEventEvidenceLabel,
  environmentalEventTitle,
} from '../core/environmentalEvents';
import {
  healthSignalCategoryLabel,
  healthSignalPeriodLabel,
  healthSignalGeographyLabel,
  healthSignalTrendLabel,
  healthSignalTypeLabel,
  healthSignalValueLabel,
} from '../core/healthSignals';
import { translate } from '../i18n';
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
import { CURRENT_LOCATION_ID, coordinatesForSavedLocation } from '../models/location';
import type { EnvironmentalEvent } from '../models/environmentalEvents';
import type { HealthSignal } from '../models/healthSignals';

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
    return translate('today.updatedAt', { time: formatTimestamp(fetchedAt) });
  }

  const cachedParts = [
    metadata?.airQualitySource === 'cached' ? translate('today.airQuality') : null,
    metadata?.weatherSource === 'cached' ? translate('today.weather') : null,
  ].filter((item): item is string => item !== null);

  if (cachedParts.length === 0 || cachedParts.length === 2) {
    return translate('today.cachedData');
  }

  return translate('today.cachedSources', { sources: cachedParts.join(', ') });
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
  if (input.selected) return translate('common.active');
  if (!input.coordinates) return undefined;
  return formatCoordinates(input.coordinates) ?? undefined;
}

function eventSeverityColor(event: EnvironmentalEvent): string {
  if (event.severity === 'very-high') return colors.veryHigh;
  if (event.severity === 'high') return colors.high;
  return colors.moderate;
}

function eventTimingLabel(event: EnvironmentalEvent, referenceTime: string | null): string {
  if (!event.endTime || event.startTime === event.endTime) {
    return event.peakTime
      ? translate('today.eventPeak', { time: formatTimestamp(event.peakTime) })
      : formatTimestamp(event.startTime);
  }

  return formatTimeRangeWithTomorrow(event.startTime, event.endTime, referenceTime);
}

function evidenceLabel(variable: string): string {
  return environmentalEventEvidenceLabel(variable);
}

function formatEvidenceValue(value: number | null | undefined, unit: string | undefined): string {
  if (unit === undefined) return formatMeasurement(value ?? null, '', 1);
  return formatMeasurement(value ?? null, unit, unit === 'µg/m³' || unit === 'grains/m³' ? 0 : 1);
}

function healthSignalIcon(
  signal: HealthSignal,
): 'respiratory' | 'population-health' | 'radiological' {
  if (signal.domain === 'radiological') return 'radiological';
  return signal.domain === 'population-health' ? 'population-health' : 'respiratory';
}

function healthTrendIcon(signal: HealthSignal): 'trend-rising' | 'trend-falling' | 'trend-stable' {
  if (signal.trend === 'rising') return 'trend-rising';
  if (signal.trend === 'falling') return 'trend-falling';
  return 'trend-stable';
}

function HealthSignalRow({
  signal,
  onPress,
}: {
  signal: HealthSignal;
  onPress: (signal: HealthSignal) => void;
}) {
  const label = healthSignalTypeLabel(signal.type);
  const secondaryLabel =
    signal.domain === 'radiological'
      ? healthSignalCategoryLabel(signal)
      : healthSignalTrendLabel(signal.trend);
  const showTrendIcon = signal.domain !== 'radiological';

  return (
    <Pressable
      accessibilityLabel={translate('today.opensDetails', {
        label: `${label}: ${healthSignalValueLabel(signal)}`,
      })}
      accessibilityRole="button"
      onPress={() => onPress(signal)}
      style={({ pressed }) => [styles.healthRow, pressed ? styles.pressed : null]}
    >
      <AppIcon name={healthSignalIcon(signal)} size="inline" color={colors.muted} />
      <View style={styles.healthCopy}>
        <Text style={styles.healthTitle}>{label}</Text>
        <Text style={styles.healthMeta}>
          {healthSignalGeographyLabel(signal)} · {healthSignalPeriodLabel(signal)}
        </Text>
      </View>
      <View style={styles.healthValueBlock}>
        <Text style={styles.healthValue}>{healthSignalValueLabel(signal)}</Text>
        <View style={styles.healthTrend}>
          {showTrendIcon ? (
            <AppIcon name={healthTrendIcon(signal)} size={14} color={colors.muted} />
          ) : null}
          <Text style={styles.healthMeta}>{secondaryLabel}</Text>
        </View>
      </View>
      <AppIcon name="chevron-right" size="inline" color={colors.muted} />
    </Pressable>
  );
}

export function TodayScreen() {
  const navigation = useNavigation<TodayNavigation>();
  const { t } = useTranslation();
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
  const healthSignals = useAppStore((state) => state.healthSignals);
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

  if (!hydrated) return <StateView loading message={t('common.loading')} />;

  const headlineCategory = personalizedScore.available
    ? personalizedScore.category
    : environmentalScore?.category;
  const locationLabel =
    (location.activeLocationId === CURRENT_LOCATION_ID
      ? t('settings.locations.currentLocation')
      : location.activeLocationName) ??
    environment?.placeName ??
    location.placeName ??
    formatCoordinates(environment?.coordinates ?? location.coordinates) ??
    t('today.locationNotSet');
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
    [`${t('today.mainFactor')}: ${environmentalMainFactor.label ?? t('common.unavailable')}`],
    t('today.bestWindow'),
    environmentalBestOutdoorWindow,
    referenceTime,
  );
  const personalizedDetails = appendAvailableWindowDetail(
    [`${t('today.mainFactor')}: ${personalizedMainFactor.label ?? t('common.unavailable')}`],
    t('today.bestWindow'),
    personalizedBestOutdoorWindow,
    referenceTime,
  );
  const biologicalSignals = healthSignals.signals.filter(
    (signal) => signal.domain === 'biological',
  );
  const populationSignals = healthSignals.signals.filter(
    (signal) => signal.domain === 'population-health',
  );
  const radiologicalSignals = healthSignals.signals.filter(
    (signal) => signal.domain === 'radiological',
  );
  const hasHealthSignalLocationContext =
    settings.locationOnboardingComplete || location.coordinates !== null || environment !== null;
  const shouldShowHealthSignals =
    hasHealthSignalLocationContext &&
    (healthSignals.loading || healthSignals.error !== null || healthSignals.signals.length > 0);
  const openHealthSignal = (signal: HealthSignal) => {
    navigation.navigate('HealthSignalDetail', { signalId: signal.id });
  };
  let respiratoryContent = (
    <Text style={styles.body}>{healthSignals.error ?? t('today.unavailableRespiratory')}</Text>
  );
  if (healthSignals.loading) {
    respiratoryContent = <Text style={styles.body}>{t('today.loadingRespiratory')}</Text>;
  } else if (biologicalSignals.length > 0) {
    respiratoryContent = (
      <>
        {biologicalSignals.map((signal) => (
          <HealthSignalRow key={signal.id} signal={signal} onPress={openHealthSignal} />
        ))}
      </>
    );
  }

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
              size={APP_ICON_SIZES.hero}
              color={headlineCategory ? riskColor(headlineCategory) : colors.unavailable}
            />
            <Text style={styles.brand}>AirAware</Text>
          </View>
          <Pressable
            accessibilityRole="button"
            onPress={() => setLocationSelectorVisible(true)}
            style={({ pressed }) => [styles.placeButton, pressed ? styles.pressed : null]}
          >
            <AppIcon name="location" size="inline" color={colors.muted} />
            <View style={styles.placeCopy}>
              <Text style={styles.place}>{locationLabel}</Text>
              {locationDetail ? <Text style={styles.placeDetail}>{locationDetail}</Text> : null}
            </View>
            <AppIcon name="chevron-right" size="inline" color={colors.muted} />
          </Pressable>
        </View>

        {error ? <Text style={styles.notice}>{error}</Text> : null}

        {environmentalScore?.available ? (
          <ScoreCard
            title={t('risk.environmentalBurden')}
            score={environmentalScore.score}
            category={environmentalScore.category}
            details={environmentalDetails}
            iconName="environmental-risk"
            onPress={() => navigation.navigate('EnvironmentalBurdenDetail', undefined)}
          />
        ) : null}

        {personalizedScore.available ? (
          <ScoreCard
            title={t('risk.personalizedRisk')}
            score={personalizedScore.score}
            category={personalizedScore.category}
            details={personalizedDetails}
            iconName="environmental-risk"
            onPress={() => navigation.navigate('PersonalizedRiskDetail', undefined)}
          />
        ) : null}

        {environmentalEvents.length > 0 ? (
          <View style={styles.eventSection}>
            <Text style={styles.sectionTitle}>{t('today.environmentalEvents')}</Text>
            {environmentalEvents.slice(0, 4).map((event) => {
              const title = environmentalEventTitle(event);
              const body = environmentalEventBody(event, referenceTime);
              const category = environmentalEventCategoryLabel(event);

              return (
                <Pressable
                  key={event.id}
                  accessibilityRole="button"
                  onPress={() => setSelectedEvent(event)}
                  style={({ pressed }) => [styles.eventCard, pressed ? styles.pressed : null]}
                >
                  <View style={styles.eventRow}>
                    <View
                      style={[
                        styles.eventIconContainer,
                        { borderColor: eventSeverityColor(event) },
                      ]}
                    >
                      <EnvironmentalIcon
                        accessibilityLabel={t('today.eventIconLabel', { title })}
                        color={eventSeverityColor(event)}
                        name={getEventIconName(event.type)}
                        size="event"
                      />
                    </View>
                    <View style={styles.eventCopy}>
                      <View style={styles.eventHeader}>
                        <Text style={styles.eventTitle}>{title}</Text>
                        <Text style={[styles.eventSeverity, { color: eventSeverityColor(event) }]}>
                          {category}
                        </Text>
                      </View>
                      <Text style={styles.eventTiming}>
                        {eventTimingLabel(event, referenceTime)}
                      </Text>
                      <Text style={styles.eventBody}>{body}</Text>
                    </View>
                  </View>
                </Pressable>
              );
            })}
          </View>
        ) : null}

        {shouldShowHealthSignals ? (
          <>
            <SectionCard
              title={t('today.respiratoryActivity')}
              subtitle={healthSignals.geography?.name ?? t('today.latestSurveillance')}
            >
              {respiratoryContent}
            </SectionCard>

            {populationSignals.length > 0 ? (
              <SectionCard
                title={t('today.populationHealth')}
                subtitle={healthSignals.geography?.name}
              >
                {populationSignals.map((signal) => (
                  <HealthSignalRow key={signal.id} signal={signal} onPress={openHealthSignal} />
                ))}
              </SectionCard>
            ) : null}

            {radiologicalSignals.length > 0 ? (
              <SectionCard title={t('today.radiological')} subtitle={t('today.radiologicalSource')}>
                {radiologicalSignals.map((signal) => (
                  <HealthSignalRow key={signal.id} signal={signal} onPress={openHealthSignal} />
                ))}
              </SectionCard>
            ) : null}
          </>
        ) : null}

        {environment ? (
          <>
            {activityDomainEvaluations.length > 0 ? (
              <View style={styles.activitySection}>
                <Text style={styles.sectionTitle}>{t('today.activities')}</Text>
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
                      icon={
                        <ActivityIcon activity={domain.id} size="inline" color={colors.muted} />
                      }
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
                          : t('common.unavailable')
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
                            : `${profile.label}: ${t('common.unavailable')}`,
                        ),
                        best && displayWindow
                          ? `${t('today.bestOpportunity')}: ${best.label} · ${formatActivityWindow(
                              displayWindow,
                              referenceTime,
                            )}`
                          : `${t('today.bestOpportunity')}: ${t('common.unavailable')}`,
                      ]}
                      accessibilityLabel={t('today.opensDetails', { label: domain.label })}
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
                title={loading ? t('today.refreshing') : t('today.refresh')}
                iconName="refresh"
                rightLabel={updateStatus}
                fullWidth
                onPress={() => refresh({ force: true })}
                disabled={loading}
              />
              <AppButton title={t('today.share')} iconName="share" onPress={shareDailySummary} />
            </View>
          </>
        ) : (
          <SectionCard title={t('today.locationRequired')}>
            <Text style={styles.body}>{t('today.locationRequiredBody')}</Text>
            <AppButton
              title={t('today.continueAndRefresh')}
              iconName="current-location"
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
            <Text style={styles.selectorTitle}>{t('today.activeLocation')}</Text>
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
                    title={
                      savedLocation.id === CURRENT_LOCATION_ID
                        ? t('settings.locations.currentLocation')
                        : savedLocation.name
                    }
                    iconName={savedLocation.type === 'current' ? 'current-location' : 'location'}
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
            <AppButton
              title={t('common.close')}
              iconName="close"
              fullWidth
              onPress={() => setLocationSelectorVisible(false)}
            />
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
                <View style={styles.eventDetailTitleRow}>
                  <EnvironmentalIcon
                    accessibilityLabel={t('today.eventIconLabel', {
                      title: environmentalEventTitle(selectedEvent),
                    })}
                    color={eventSeverityColor(selectedEvent)}
                    name={getEventIconName(selectedEvent.type)}
                    size="event"
                  />
                  <Text style={styles.selectorTitle}>{environmentalEventTitle(selectedEvent)}</Text>
                </View>
                <Text style={styles.eventTiming}>
                  {t('today.eventExpected', {
                    time: eventTimingLabel(selectedEvent, referenceTime),
                  })}
                </Text>
                {selectedEvent.peakTime ? (
                  <Text style={styles.eventTiming}>
                    {t('today.eventPeak', { time: formatTimestamp(selectedEvent.peakTime) })}
                  </Text>
                ) : null}
                <Text style={styles.body}>
                  {environmentalEventBody(selectedEvent, referenceTime)}
                </Text>
                {selectedEvent.evidence.slice(0, 4).map((evidence) => (
                  <View key={`${evidence.variable}:${evidence.role}`} style={styles.evidenceRow}>
                    <Text style={styles.evidenceVariable}>{evidenceLabel(evidence.variable)}</Text>
                    <Text style={styles.evidenceValue}>
                      {formatEvidenceValue(evidence.value, evidence.unit)}
                    </Text>
                  </View>
                ))}
                <Text style={styles.notice}>{t('today.eventDataAttribution')}</Text>
              </>
            ) : null}
            <AppButton
              title={t('common.close')}
              iconName="close"
              fullWidth
              onPress={() => setSelectedEvent(null)}
            />
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
  eventCopy: {
    flex: 1,
    gap: spacing.xs,
  },
  eventDetailTitleRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
  },
  eventIconContainer: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: colors.pressedSurface,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    height: ENVIRONMENTAL_ICON_SIZES.event + spacing.md,
    justifyContent: 'center',
    width: ENVIRONMENTAL_ICON_SIZES.event + spacing.md,
  },
  eventRow: {
    flexDirection: 'row',
    gap: spacing.md,
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
  healthCopy: {
    flex: 1,
    minWidth: 0,
  },
  healthMeta: {
    color: colors.muted,
    fontSize: 12,
  },
  healthRow: {
    alignItems: 'center',
    borderRadius: 8,
    flexDirection: 'row',
    gap: spacing.sm,
    minHeight: 52,
  },
  healthTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '700',
  },
  healthTrend: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.xs,
    justifyContent: 'flex-end',
  },
  healthValue: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '800',
    textAlign: 'right',
  },
  healthValueBlock: {
    alignItems: 'flex-end',
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
  },
  placeButton: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    borderRadius: 10,
    flexDirection: 'row',
    gap: spacing.xs,
    marginTop: spacing.xs,
    minHeight: 44,
    paddingRight: spacing.sm,
  },
  placeCopy: {
    flex: 1,
    minWidth: 0,
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

import { Modal, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { ReactNode } from 'react';
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
import { EnvironmentalIcon } from '../components/icons/EnvironmentalIcon';
import { APP_ICON_SIZES } from '../components/icons/appIconTypes';
import { ENVIRONMENTAL_ICON_SIZES } from '../components/icons/environmentalIconTypes';
import { GasMaskIcon } from '../components/icons/GasMaskIcon';
import { getEventIconName } from '../components/icons/environmentalIconResolver';
import {
  environmentalEventBody,
  environmentalEventCategoryLabel,
  environmentalEventTitle,
} from '../core/environmentalEvents';
import {
  healthSignalCategoryLabel,
  healthSignalFreshnessLabel,
  healthSignalGeographyLabel,
  healthSignalPeriodLabel,
  healthSignalTrendLabel,
  healthSignalTypeLabel,
  healthSignalValueLabel,
} from '../core/healthSignals';
import { todayHealthSectionVisibility } from '../core/healthSignalPresentation';
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
  formatScore,
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

function eventSeverityLabel(event: EnvironmentalEvent): string {
  const category = environmentalEventCategoryLabel(event);
  const value = eventDataValueLabel(event);
  if (!value) {
    return category;
  }

  return `${category} · ${value}`;
}

function eventDataValueLabel(event: EnvironmentalEvent): string | null {
  const value = event.peakValue ?? event.currentValue;
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;

  const primaryEvidence = event.evidence.find((evidence) => evidence.role === 'primary');
  const unit =
    primaryEvidence?.unit ?? (event.type === 'headline-risk' || event.type === 'mold' ? '%' : '');

  if (unit === '%') return formatScore(value);

  if (event.type === 'aerosol' || event.factor === 'aerosol_optical_depth') {
    return formatMeasurement(value, unit, 2);
  }

  if (event.type === 'uv') {
    return formatMeasurement(value, unit, 1);
  }

  return formatMeasurement(value, unit);
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

function healthSecondaryLabel(signal: HealthSignal): string {
  if (signal.domain === 'radiological' || signal.type === 'thermal-stress') {
    return healthSignalCategoryLabel(signal);
  }

  return healthSignalTrendLabel(signal.trend);
}

function isDemotedHealthSignal(signal: HealthSignal): boolean {
  return signal.metadata?.unavailable === true || signal.freshness.status === 'stale';
}

function healthSignalSortValue(signal: HealthSignal): number {
  if (signal.metadata?.unavailable === true) return 3;
  if (signal.freshness.status === 'stale') return 2;
  if (signal.freshness.status === 'aging') return 1;
  return 0;
}

function sortedHealthSignals(signals: HealthSignal[]): HealthSignal[] {
  return [...signals].sort((a, b) => healthSignalSortValue(a) - healthSignalSortValue(b));
}

function HealthSignalRow({
  signal,
  onPress,
}: {
  signal: HealthSignal;
  onPress: (signal: HealthSignal) => void;
}) {
  const label = healthSignalTypeLabel(signal.type);
  const demoted = isDemotedHealthSignal(signal);
  const freshnessPrefix =
    signal.metadata?.unavailable === true || signal.freshness.status === 'fresh'
      ? null
      : healthSignalFreshnessLabel(signal.freshness.status);
  const secondaryValue =
    signal.metadata?.unavailable === true
      ? healthSignalTrendLabel(signal.trend)
      : healthSecondaryLabel(signal);
  const secondaryLabel = [freshnessPrefix, secondaryValue].filter(Boolean).join(' · ');
  const showTrendIcon = signal.domain !== 'radiological' && signal.type !== 'thermal-stress';

  return (
    <Pressable
      accessibilityLabel={translate('today.opensDetails', {
        label: `${label}: ${healthSignalValueLabel(signal)}`,
      })}
      accessibilityRole="button"
      onPress={() => onPress(signal)}
      style={({ pressed }) => [
        styles.healthRow,
        demoted ? styles.healthRowDemoted : null,
        pressed ? styles.pressed : null,
      ]}
    >
      {signal.type === 'thermal-stress' ? (
        <EnvironmentalIcon
          name="apparent-temperature"
          size="event"
          color={demoted ? colors.unavailable : colors.muted}
        />
      ) : (
        <AppIcon
          name={healthSignalIcon(signal)}
          size="inline"
          color={demoted ? colors.unavailable : colors.muted}
        />
      )}
      <View style={styles.healthCopy}>
        <Text style={[styles.healthTitle, demoted ? styles.healthTextDemoted : null]}>{label}</Text>
        <Text style={styles.healthMeta}>
          {healthSignalGeographyLabel(signal)} · {healthSignalPeriodLabel(signal)}
        </Text>
      </View>
      <View style={styles.healthValueBlock}>
        <Text style={[styles.healthValue, demoted ? styles.healthTextDemoted : null]}>
          {healthSignalValueLabel(signal)}
        </Text>
        <View style={styles.healthTrend}>
          {showTrendIcon ? (
            <AppIcon
              name={healthTrendIcon(signal)}
              size={14}
              color={demoted ? colors.unavailable : colors.muted}
            />
          ) : null}
          <Text style={styles.healthMeta}>{secondaryLabel}</Text>
        </View>
      </View>
      <AppIcon name="chevron-right" size="inline" color={colors.muted} />
    </Pressable>
  );
}

function HealthSignalGroup({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string | undefined;
  children: ReactNode;
}) {
  return (
    <View style={styles.healthGroup}>
      <View style={styles.healthGroupHeader}>
        <Text style={styles.healthGroupTitle}>{title}</Text>
        {subtitle ? <Text style={styles.healthGroupSubtitle}>{subtitle}</Text> : null}
      </View>
      {children}
    </View>
  );
}

export function TodayScreen() {
  const navigation = useNavigation<TodayNavigation>();
  const { t } = useTranslation();
  const [locationSelectorVisible, setLocationSelectorVisible] = useState(false);
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
  const openManualLocationSettings = async () => {
    await updateSettings({ locationOnboardingComplete: true });
    navigation.navigate('MainTabs', { screen: 'Settings' });
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
  const thermalSignals = sortedHealthSignals(
    healthSignals.signals.filter((signal) => signal.type === 'thermal-stress'),
  );
  const respiratorySignals = sortedHealthSignals(
    healthSignals.signals.filter((signal) =>
      ['influenza', 'covid-19', 'rsv'].includes(signal.type),
    ),
  );
  const wastewaterSignals = sortedHealthSignals(
    healthSignals.signals.filter((signal) =>
      ['wastewater-covid-19', 'wastewater-influenza', 'wastewater-rsv'].includes(signal.type),
    ),
  );
  const vectorSignals = sortedHealthSignals(
    healthSignals.signals.filter((signal) =>
      ['dengue', 'west-nile', 'malaria', 'tick-borne-disease'].includes(signal.type),
    ),
  );
  const populationSignals = sortedHealthSignals(
    healthSignals.signals.filter((signal) => signal.domain === 'population-health'),
  );
  const radiologicalSignals = sortedHealthSignals(
    healthSignals.signals.filter((signal) => signal.domain === 'radiological'),
  );
  const contextualHealthSignalCount =
    respiratorySignals.length +
    wastewaterSignals.length +
    vectorSignals.length +
    populationSignals.length +
    radiologicalSignals.length;
  const hasHealthSignalLocationContext =
    settings.locationOnboardingComplete || location.coordinates !== null || environment !== null;
  const { shouldShowHealthSignals, shouldShowThermalSignals } = todayHealthSectionVisibility({
    contextualHealthSignalCount,
    hasHealthSignalLocationContext,
    healthSignalsError: healthSignals.error,
    healthSignalsLoading: healthSignals.loading,
    thermalSignalCount: thermalSignals.length,
  });
  const openHealthSignal = (signal: HealthSignal) => {
    navigation.navigate('HealthSignalDetail', { signalId: signal.id });
  };
  let respiratoryContent = (
    <Text style={styles.body}>{healthSignals.error ?? t('today.unavailableRespiratory')}</Text>
  );
  if (healthSignals.loading) {
    respiratoryContent = <Text style={styles.body}>{t('today.loadingRespiratory')}</Text>;
  } else if (respiratorySignals.length > 0) {
    respiratoryContent = (
      <>
        {respiratorySignals.map((signal) => (
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
              const category = eventSeverityLabel(event);

              return (
                <View key={event.id} style={styles.eventCard}>
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
                </View>
              );
            })}
          </View>
        ) : null}

        {shouldShowThermalSignals ? (
          <SectionCard title={t('today.thermalStress')} subtitle={t('today.thermalSource')}>
            {thermalSignals.map((signal) => (
              <HealthSignalRow key={signal.id} signal={signal} onPress={openHealthSignal} />
            ))}
          </SectionCard>
        ) : null}

        {shouldShowHealthSignals ? (
          <SectionCard title={t('today.healthSignals')} subtitle={t('today.healthSignalsSubtitle')}>
            <HealthSignalGroup
              title={t('today.respiratoryActivity')}
              subtitle={healthSignals.geography?.name ?? t('today.latestSurveillance')}
            >
              {respiratoryContent}
            </HealthSignalGroup>

            {wastewaterSignals.length > 0 ? (
              <HealthSignalGroup
                title={t('today.wastewaterSurveillance')}
                subtitle={t('today.wastewaterSource')}
              >
                {wastewaterSignals.map((signal) => (
                  <HealthSignalRow key={signal.id} signal={signal} onPress={openHealthSignal} />
                ))}
              </HealthSignalGroup>
            ) : null}

            {vectorSignals.length > 0 ? (
              <HealthSignalGroup
                title={t('today.vectorBorneActivity')}
                subtitle={healthSignals.geography?.name}
              >
                {vectorSignals.map((signal) => (
                  <HealthSignalRow key={signal.id} signal={signal} onPress={openHealthSignal} />
                ))}
              </HealthSignalGroup>
            ) : null}

            {populationSignals.length > 0 ? (
              <HealthSignalGroup
                title={t('today.populationHealth')}
                subtitle={healthSignals.geography?.name}
              >
                {populationSignals.map((signal) => (
                  <HealthSignalRow key={signal.id} signal={signal} onPress={openHealthSignal} />
                ))}
              </HealthSignalGroup>
            ) : null}

            {radiologicalSignals.length > 0 ? (
              <HealthSignalGroup
                title={t('today.radiological')}
                subtitle={t('today.radiologicalSource')}
              >
                {radiologicalSignals.map((signal) => (
                  <HealthSignalRow key={signal.id} signal={signal} onPress={openHealthSignal} />
                ))}
              </HealthSignalGroup>
            ) : null}
          </SectionCard>
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
              title={t('today.useCurrentLocation')}
              iconName="current-location"
              onPress={startLocationRefresh}
              disabled={loading}
            />
            <AppButton
              title={t('today.chooseManualLocation')}
              iconName="location"
              onPress={openManualLocationSettings}
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
    flexShrink: 0,
    textAlign: 'right',
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
  healthGroup: {
    borderTopColor: colors.border,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: spacing.xs,
    paddingTop: spacing.sm,
  },
  healthGroupHeader: {
    gap: spacing.xs,
  },
  healthGroupSubtitle: {
    color: colors.muted,
    fontSize: 12,
  },
  healthGroupTitle: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '800',
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
  healthRowDemoted: {
    opacity: 0.62,
  },
  healthTextDemoted: {
    color: colors.muted,
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

import { Modal, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigation } from '@react-navigation/native';
import { AppButton } from '../components/AppButton';
import { InsightCard } from '../components/InsightCard';
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
import {
  healthSignalHasTimelineDetail,
  healthSignalInlineDetailRows,
  isDemotedPublicHealthSignal,
  publicHealthContextRows,
  publicHealthContextSummary,
  todayHealthSectionVisibility,
} from '../core/healthSignalPresentation';
import { todayDecisionSummary } from '../core/todayDecision';
import { categoryLabel } from '../core/categories';
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
import type {
  EnvironmentalScoreResult,
  PersonalizedScoreResult,
  RiskCategoryId,
} from '../models/environment';
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

type ActivityDomainEvaluation = ReturnType<typeof evaluateActivityDomains>[number];

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

function todayHeadlineCategory(input: {
  environmentalScore: EnvironmentalScoreResult | null;
  personalizedScore: PersonalizedScoreResult;
}): RiskCategoryId | undefined {
  if (input.personalizedScore.available) return input.personalizedScore.category;
  return input.environmentalScore?.category;
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
):
  | 'respiratory'
  | 'wastewater'
  | 'vector-borne'
  | 'measured-spores'
  | 'population-health'
  | 'radiological' {
  if (signal.domain === 'radiological') return 'radiological';
  if (signal.domain === 'population-health') return 'population-health';
  if (
    signal.type === 'wastewater-covid-19' ||
    signal.type === 'wastewater-influenza' ||
    signal.type === 'wastewater-rsv'
  ) {
    return 'wastewater';
  }
  if (
    signal.type === 'dengue' ||
    signal.type === 'west-nile' ||
    signal.type === 'malaria' ||
    signal.type === 'tick-borne-disease'
  ) {
    return 'vector-borne';
  }
  if (signal.type === 'measured-mold-spores') return 'measured-spores';
  return 'respiratory';
}

function healthTrendIcon(signal: HealthSignal): 'trend-rising' | 'trend-falling' | 'trend-stable' {
  if (signal.trend === 'rising') return 'trend-rising';
  if (signal.trend === 'falling') return 'trend-falling';
  return 'trend-stable';
}

function healthSecondaryLabel(signal: HealthSignal): string {
  if (signal.type === 'thermal-stress') {
    const metric =
      signal.metadata?.metric === 'utci'
        ? translate('today.thermalMetric.utci')
        : translate('today.thermalMetric.apparentTemperature');
    return `${metric} · ${healthSignalCategoryLabel(signal)}`;
  }

  if (signal.domain === 'radiological') {
    return healthSignalCategoryLabel(signal);
  }

  return healthSignalTrendLabel(signal.trend);
}

function isDemotedHealthSignal(signal: HealthSignal): boolean {
  return isDemotedPublicHealthSignal(signal);
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

function todayHealthSignalValueLabel(signal: HealthSignal): string {
  if (signal.freshness.status !== 'stale') return healthSignalValueLabel(signal);

  return signal.type === 'ambient-dose-rate'
    ? translate('health.radiological.noRecentLocalMeasurement')
    : translate('health.noRecentData');
}

function HealthSignalVisualIcon({ demoted, signal }: { demoted: boolean; signal: HealthSignal }) {
  const color = demoted ? colors.unavailable : colors.muted;

  if (signal.type === 'thermal-stress') {
    return <EnvironmentalIcon name="apparent-temperature" size="event" color={color} />;
  }

  return <AppIcon name={healthSignalIcon(signal)} size="inline" color={color} />;
}

function HealthSignalTrendIndicator({
  demoted,
  signal,
}: {
  demoted: boolean;
  signal: HealthSignal;
}) {
  if (signal.domain === 'radiological' || signal.type === 'thermal-stress') return null;

  return (
    <AppIcon
      name={healthTrendIcon(signal)}
      size={14}
      color={demoted ? colors.unavailable : colors.muted}
    />
  );
}

function HealthSignalRow({
  expanded,
  signal,
  valueLabel,
  secondaryLabel,
  onToggleInline,
  onPress,
}: {
  expanded: boolean;
  signal: HealthSignal;
  valueLabel?: string | undefined;
  secondaryLabel?: string | undefined;
  onToggleInline: (signal: HealthSignal) => void;
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
  const rowValueLabel = valueLabel ?? todayHealthSignalValueLabel(signal);
  const rowSecondaryLabel =
    secondaryLabel ?? [freshnessPrefix, secondaryValue].filter(Boolean).join(' · ');
  const hasTimelineDetail = healthSignalHasTimelineDetail(signal);
  const hasInlineDetail = !hasTimelineDetail;
  const inlineRows = hasInlineDetail && expanded ? healthSignalInlineDetailRows(signal) : [];
  const accessibilityLabel = hasTimelineDetail
    ? translate('today.opensDetails', {
        label: `${label}: ${rowValueLabel}`,
      })
    : translate('today.expandsDetails', {
        label: `${label}: ${rowValueLabel}`,
      });

  const handlePress = () => {
    if (hasTimelineDetail) {
      onPress(signal);
      return;
    }
    onToggleInline(signal);
  };

  return (
    <View style={[styles.healthRowShell, demoted ? styles.healthRowDemoted : null]}>
      <Pressable
        accessibilityLabel={accessibilityLabel}
        accessibilityRole="button"
        accessibilityState={hasInlineDetail ? { expanded } : undefined}
        onPress={handlePress}
        style={({ pressed }) => [styles.healthRow, pressed ? styles.pressed : null]}
      >
        <HealthSignalVisualIcon signal={signal} demoted={demoted} />
        <View style={styles.healthCopy}>
          <Text style={[styles.healthTitle, demoted ? styles.healthTextDemoted : null]}>
            {label}
          </Text>
          <Text style={styles.healthMeta}>
            {healthSignalGeographyLabel(signal)} · {healthSignalPeriodLabel(signal)}
          </Text>
        </View>
        <View style={styles.healthValueBlock}>
          <Text style={[styles.healthValue, demoted ? styles.healthTextDemoted : null]}>
            {rowValueLabel}
          </Text>
          <View style={styles.healthTrend}>
            <HealthSignalTrendIndicator signal={signal} demoted={demoted} />
            <Text style={styles.healthMeta}>{rowSecondaryLabel}</Text>
          </View>
        </View>
        <AppIcon
          name={hasTimelineDetail ? 'chevron-right' : 'info'}
          size="inline"
          color={colors.muted}
        />
      </Pressable>
      {inlineRows.length > 0 ? (
        <View style={styles.healthInlineDetails}>
          {inlineRows.map((row) => (
            <View key={row.label} style={styles.healthInlineDetailRow}>
              <Text style={styles.healthInlineDetailLabel}>{row.label}</Text>
              <Text style={styles.healthInlineDetailValue}>{row.value}</Text>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

function LocationSelectorButton({
  locationLabel,
  locationDetail,
  onPress,
}: {
  locationLabel: string;
  locationDetail?: string | null | undefined;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.placeButton, pressed ? styles.pressed : null]}
    >
      <AppIcon name="location" size="inline" color={colors.muted} />
      <View style={styles.placeCopy}>
        <Text style={styles.place}>{locationLabel}</Text>
        {locationDetail ? <Text style={styles.placeDetail}>{locationDetail}</Text> : null}
      </View>
      <AppIcon name="chevron-right" size="inline" color={colors.muted} />
    </Pressable>
  );
}

function TodayDecisionCard({
  locationLabel,
  locationDetail,
  decision,
  onLocationPress,
}: {
  locationLabel: string;
  locationDetail?: string | null | undefined;
  decision: NonNullable<ReturnType<typeof todayDecisionSummary>>;
  onLocationPress: () => void;
}) {
  const accent = riskColor(decision.score.category);

  return (
    <View style={[styles.decisionCard, { borderTopColor: accent }]}>
      <Pressable
        accessibilityRole="button"
        onPress={onLocationPress}
        style={({ pressed }) => [styles.decisionLocation, pressed ? styles.pressed : null]}
      >
        <AppIcon name="location" size="inline" color={colors.muted} />
        <View style={styles.placeCopy}>
          <Text style={styles.decisionPlace}>{locationLabel}</Text>
          {locationDetail ? <Text style={styles.placeDetail}>{locationDetail}</Text> : null}
        </View>
        <AppIcon name="chevron-right" size="inline" color={colors.muted} />
      </Pressable>
      <View style={styles.decisionBody}>
        <Text style={[styles.decisionTitle, { color: accent }]}>{decision.title}</Text>
        <Text style={styles.decisionInterpretation}>{decision.interpretation}</Text>
      </View>
      <View style={styles.decisionGrid}>
        <View style={styles.decisionMetric}>
          <Text style={styles.decisionMetricLabel}>{translate('today.mainConcern')}</Text>
          <Text style={styles.decisionMetricValue}>{decision.mainConcern}</Text>
        </View>
        <View style={styles.decisionMetric}>
          <Text style={styles.decisionMetricLabel}>{translate('today.bestTimeToday')}</Text>
          <Text style={styles.decisionMetricValue}>{decision.bestWindow}</Text>
        </View>
      </View>
    </View>
  );
}

function PublicHealthContextSection({
  rows,
  expandedHealthSignalIds,
  healthSectionNotice,
  loading,
  onOpenDetails,
  onPressSignal,
  onToggleInline,
}: {
  rows: ReturnType<typeof publicHealthContextRows>;
  expandedHealthSignalIds: Set<string>;
  healthSectionNotice: string | null;
  loading: boolean;
  onOpenDetails: () => void;
  onPressSignal: (signal: HealthSignal) => void;
  onToggleInline: (signal: HealthSignal) => void;
}) {
  return (
    <SectionCard
      title={translate('today.publicHealthContext')}
      subtitle={translate('today.publicHealthContextSubtitle')}
    >
      {healthSectionNotice ? <Text style={styles.notice}>{healthSectionNotice}</Text> : null}
      {loading ? (
        <Text style={styles.body}>{translate('today.loadingPublicHealthContext')}</Text>
      ) : null}
      {!loading && rows.length === 0 ? (
        <Text style={styles.body}>{translate('today.publicHealthNoCurrentSignals')}</Text>
      ) : null}
      {rows.slice(0, 4).map((row) => (
        <View
          key={row.signal.id}
          style={[styles.publicHealthRowShell, row.demoted ? styles.healthRowDemoted : null]}
        >
          <Text style={styles.publicHealthScope}>{row.scopeLabel}</Text>
          <HealthSignalRow
            expanded={expandedHealthSignalIds.has(row.signal.id)}
            signal={row.signal}
            valueLabel={row.value}
            secondaryLabel={row.secondaryLabel}
            onPress={onPressSignal}
            onToggleInline={onToggleInline}
          />
          <Text style={styles.publicHealthContext}>{row.contextLabel}</Text>
        </View>
      ))}
      {rows.length > 0 ? (
        <Text style={styles.healthSummary}>{publicHealthContextSummary(rows)}</Text>
      ) : null}
      {rows.length > 0 ? (
        <AppButton
          title={translate('today.publicHealthViewAll')}
          iconName="chevron-right"
          fullWidth
          onPress={onOpenDetails}
        />
      ) : null}
    </SectionCard>
  );
}

function EnvironmentalEventsSection({
  events,
  referenceTime,
}: {
  events: EnvironmentalEvent[];
  referenceTime: string | null;
}) {
  if (events.length === 0) return null;

  return (
    <View style={styles.eventSection}>
      <Text style={styles.sectionTitle}>{translate('today.environmentalEvents')}</Text>
      {events.slice(0, 4).map((event) => {
        const title = environmentalEventTitle(event);
        const body = environmentalEventBody(event, referenceTime);
        const category = eventSeverityLabel(event);

        return (
          <View key={event.id} style={styles.eventCard}>
            <View style={styles.eventRow}>
              <View style={[styles.eventIconContainer, { borderColor: eventSeverityColor(event) }]}>
                <EnvironmentalIcon
                  accessibilityLabel={translate('today.eventIconLabel', { title })}
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
                <Text style={styles.eventTiming}>{eventTimingLabel(event, referenceTime)}</Text>
                <Text style={styles.eventBody}>{body}</Text>
              </View>
            </View>
          </View>
        );
      })}
    </View>
  );
}

function ThermalConditionsSection({
  expandedHealthSignalIds,
  signals,
  visible,
  onPressSignal,
  onToggleInline,
}: {
  expandedHealthSignalIds: Set<string>;
  signals: HealthSignal[];
  visible: boolean;
  onPressSignal: (signal: HealthSignal) => void;
  onToggleInline: (signal: HealthSignal) => void;
}) {
  if (!visible) return null;

  return (
    <SectionCard
      title={translate('today.thermalStress')}
      subtitle={translate('today.thermalSource')}
    >
      {signals.map((signal) => (
        <HealthSignalRow
          key={signal.id}
          expanded={expandedHealthSignalIds.has(signal.id)}
          signal={signal}
          onPress={onPressSignal}
          onToggleInline={onToggleInline}
        />
      ))}
    </SectionCard>
  );
}

function EnvironmentalDetailsSection({
  environmentalDetails,
  environmentalScore,
  navigation,
  personalizedDetails,
  personalizedScore,
  visible,
}: {
  environmentalDetails: string[];
  environmentalScore: EnvironmentalScoreResult | null;
  navigation: TodayNavigation;
  personalizedDetails: string[];
  personalizedScore: PersonalizedScoreResult;
  visible: boolean;
}) {
  if (!visible || (!environmentalScore?.available && !personalizedScore.available)) return null;

  return (
    <SectionCard
      title={translate('today.environmentalDetails')}
      subtitle={translate('today.environmentalDetailsSubtitle')}
    >
      {environmentalScore?.available ? (
        <InsightCard
          title={translate('risk.environmentalBurden')}
          accent={riskColor(environmentalScore.category)}
          icon={<EnvironmentalIcon name="environmental-risk" size="card" />}
          primary={formatScore(environmentalScore.score)}
          secondary={categoryLabel(environmentalScore.category)}
          details={environmentalDetails}
          compact
          accessibilityLabel={translate('today.opensDetails', {
            label: translate('risk.environmentalBurden'),
          })}
          onPress={() => navigation.navigate('EnvironmentalBurdenDetail', undefined)}
        />
      ) : null}
      {personalizedScore.available ? (
        <InsightCard
          title={translate('risk.personalizedRisk')}
          accent={riskColor(personalizedScore.category)}
          icon={<EnvironmentalIcon name="environmental-risk" size="card" />}
          primary={formatScore(personalizedScore.score)}
          secondary={categoryLabel(personalizedScore.category)}
          details={personalizedDetails}
          compact
          accessibilityLabel={translate('today.opensDetails', {
            label: translate('risk.personalizedRisk'),
          })}
          onPress={() => navigation.navigate('PersonalizedRiskDetail', undefined)}
        />
      ) : null}
    </SectionCard>
  );
}

function ActivitySummarySection({
  evaluations,
  navigation,
  referenceTime,
}: {
  evaluations: ActivityDomainEvaluation[];
  navigation: TodayNavigation;
  referenceTime: string | null;
}) {
  if (evaluations.length === 0) return null;

  return (
    <View style={styles.activitySection}>
      <Text style={styles.sectionTitle}>{translate('today.activities')}</Text>
      {evaluations.map((domain) => {
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
            icon={<ActivityIcon activity={domain.id} size="inline" color={colors.muted} />}
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
                : translate('common.unavailable')
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
                  : `${profile.label}: ${translate('common.unavailable')}`,
              ),
              best && displayWindow
                ? `${translate('today.bestOpportunity')}: ${best.label} · ${formatActivityWindow(
                    displayWindow,
                    referenceTime,
                  )}`
                : `${translate('today.bestOpportunity')}: ${translate('common.unavailable')}`,
            ]}
            accessibilityLabel={translate('today.opensDetails', { label: domain.label })}
            onPress={() => navigation.navigate('ActivityDomainDetail', { domainId: domain.id })}
          />
        );
      })}
    </View>
  );
}

function LocationRequiredCard({
  loading,
  onChooseManualLocation,
  onUseCurrentLocation,
}: {
  loading: boolean;
  onChooseManualLocation: () => void;
  onUseCurrentLocation: () => void;
}) {
  return (
    <SectionCard title={translate('today.locationRequired')}>
      <Text style={styles.body}>{translate('today.locationRequiredBody')}</Text>
      <AppButton
        title={translate('today.useCurrentLocation')}
        iconName="current-location"
        onPress={onUseCurrentLocation}
        disabled={loading}
      />
      <AppButton
        title={translate('today.chooseManualLocation')}
        iconName="location"
        onPress={onChooseManualLocation}
        disabled={loading}
      />
    </SectionCard>
  );
}

export function TodayScreen() {
  const navigation = useNavigation<TodayNavigation>();
  const { t } = useTranslation();
  const [locationSelectorVisible, setLocationSelectorVisible] = useState(false);
  const [expandedHealthSignalIds, setExpandedHealthSignalIds] = useState<Set<string>>(
    () => new Set(),
  );
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

  const headlineCategory = todayHeadlineCategory({ environmentalScore, personalizedScore });
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
    [`${t('today.mainConcern')}: ${environmentalMainFactor.label ?? t('common.unavailable')}`],
    t('today.bestWindow'),
    environmentalBestOutdoorWindow,
    referenceTime,
  );
  const personalizedDetails = appendAvailableWindowDetail(
    [`${t('today.mainConcern')}: ${personalizedMainFactor.label ?? t('common.unavailable')}`],
    t('today.bestWindow'),
    personalizedBestOutdoorWindow,
    referenceTime,
  );
  const thermalSignals = sortedHealthSignals(
    healthSignals.signals.filter((signal) => signal.type === 'thermal-stress'),
  );
  const publicHealthSignals = sortedHealthSignals(
    healthSignals.signals.filter((signal) => signal.type !== 'thermal-stress'),
  );
  const publicHealthRows = publicHealthContextRows(publicHealthSignals);
  const contextualHealthSignalCount = publicHealthSignals.length;
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
  const toggleHealthSignalInline = (signal: HealthSignal) => {
    setExpandedHealthSignalIds((current) => {
      const next = new Set(current);
      if (next.has(signal.id)) {
        next.delete(signal.id);
      } else {
        next.add(signal.id);
      }
      return next;
    });
  };
  const healthSectionNotice = healthSignals.error;
  const decision = todayDecisionSummary({
    environmentalScore,
    environmentalBestOutdoorWindow,
    personalizedScore,
    personalizedBestOutdoorWindow,
    referenceTime,
  });

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
        </View>

        {error ? <Text style={styles.notice}>{error}</Text> : null}

        {decision ? (
          <TodayDecisionCard
            locationLabel={locationLabel}
            locationDetail={locationDetail}
            decision={decision}
            onLocationPress={() => setLocationSelectorVisible(true)}
          />
        ) : (
          <LocationSelectorButton
            locationLabel={locationLabel}
            locationDetail={locationDetail}
            onPress={() => setLocationSelectorVisible(true)}
          />
        )}

        {environment && !personalizedScore.available ? (
          <AppButton
            title={t('today.personalizeAirAware')}
            iconName="profile"
            fullWidth
            onPress={() => navigation.navigate('MainTabs', { screen: 'Profile' })}
          />
        ) : null}

        <EnvironmentalEventsSection events={environmentalEvents} referenceTime={referenceTime} />

        <ThermalConditionsSection
          expandedHealthSignalIds={expandedHealthSignalIds}
          signals={thermalSignals}
          visible={shouldShowThermalSignals}
          onPressSignal={openHealthSignal}
          onToggleInline={toggleHealthSignalInline}
        />

        <EnvironmentalDetailsSection
          environmentalDetails={environmentalDetails}
          environmentalScore={environmentalScore}
          navigation={navigation}
          personalizedDetails={personalizedDetails}
          personalizedScore={personalizedScore}
          visible={environment !== null}
        />

        {shouldShowHealthSignals ? (
          <PublicHealthContextSection
            rows={publicHealthRows}
            expandedHealthSignalIds={expandedHealthSignalIds}
            healthSectionNotice={healthSectionNotice}
            loading={healthSignals.loading}
            onOpenDetails={() => navigation.navigate('PublicHealthContext', undefined)}
            onPressSignal={openHealthSignal}
            onToggleInline={toggleHealthSignalInline}
          />
        ) : null}

        {environment ? (
          <>
            <ActivitySummarySection
              evaluations={activityDomainEvaluations}
              navigation={navigation}
              referenceTime={referenceTime}
            />
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
          <LocationRequiredCard
            loading={loading}
            onUseCurrentLocation={startLocationRefresh}
            onChooseManualLocation={openManualLocationSettings}
          />
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
  decisionBody: {
    gap: spacing.xs,
  },
  decisionCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 12,
    borderTopWidth: 5,
    borderWidth: StyleSheet.hairlineWidth,
    gap: spacing.lg,
    marginBottom: spacing.md,
    padding: spacing.lg,
  },
  decisionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  decisionInterpretation: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '600',
    lineHeight: 22,
  },
  decisionLocation: {
    alignItems: 'center',
    alignSelf: 'stretch',
    borderRadius: 10,
    flexDirection: 'row',
    gap: spacing.xs,
    minHeight: 44,
  },
  decisionMetric: {
    backgroundColor: colors.pressedSurface,
    borderRadius: 8,
    flexGrow: 1,
    flexShrink: 1,
    gap: spacing.xs,
    minWidth: 132,
    padding: spacing.md,
  },
  decisionMetricLabel: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  decisionMetricValue: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '800',
    lineHeight: 20,
  },
  decisionPlace: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '800',
  },
  decisionTitle: {
    fontSize: 32,
    fontWeight: '900',
    lineHeight: 36,
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
  healthInlineDetailLabel: {
    color: colors.muted,
    flex: 0.9,
    fontSize: 12,
    fontWeight: '700',
  },
  healthInlineDetailRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  healthInlineDetailValue: {
    color: colors.text,
    flex: 1.6,
    fontSize: 12,
    lineHeight: 17,
    textAlign: 'right',
  },
  healthInlineDetails: {
    borderTopColor: colors.border,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: spacing.xs,
    paddingBottom: spacing.sm,
    paddingHorizontal: spacing.sm,
    paddingTop: spacing.sm,
  },
  healthRow: {
    alignItems: 'center',
    borderRadius: 8,
    flexDirection: 'row',
    gap: spacing.sm,
    minHeight: 52,
    paddingHorizontal: spacing.xs,
  },
  healthRowDemoted: {
    opacity: 0.62,
  },
  healthRowShell: {
    borderRadius: 8,
    overflow: 'hidden',
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
  healthSummary: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: '700',
    marginTop: spacing.xs,
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
  publicHealthContext: {
    color: colors.muted,
    fontSize: 12,
    lineHeight: 17,
    paddingHorizontal: spacing.xs,
  },
  publicHealthRowShell: {
    borderTopColor: colors.border,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: spacing.xs,
    paddingTop: spacing.sm,
  },
  publicHealthScope: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0,
    paddingHorizontal: spacing.xs,
    textTransform: 'uppercase',
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

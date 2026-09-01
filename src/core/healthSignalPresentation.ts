import type { DimensionValue } from 'react-native';
import type { DataDetailRangeId } from '../models/dataDetail';
import type { HealthSignal, ReportingPeriod } from '../models/healthSignals';
import { translate } from '../i18n';
import { colors } from '../theme/theme';
import { formatDistanceMeters, formatMeasurement } from '../utils/format';
import { DATA_DETAIL_RANGES, dataDetailRange } from './dataVariableMetadata';
import {
  healthSignalTemporalClass,
  isCurrentContextEligible,
} from '../services/healthSignalFreshness';
import {
  healthSignalCategoryLabel,
  healthSignalFreshnessDetailLabel,
  healthSignalFreshnessLabel,
  healthSignalGeographyLabel,
  healthSignalPeriodLabel,
  healthSignalSourceLabel,
  healthSignalTrendLabel,
  healthSignalTypeLabel,
  healthSignalValueLabel,
} from './healthSignals';

interface RangeSelection {
  signalId: string | null;
  rangeId: DataDetailRangeId;
}

export interface HealthSignalDetailRangeOption {
  id: DataDetailRangeId;
  label: string;
}

export interface TimelineFillStyle {
  backgroundColor: string;
  left?: DimensionValue | undefined;
  position?: 'absolute' | undefined;
  width: DimensionValue;
}

export interface HealthTimelineRangePoint {
  period?: ReportingPeriod | undefined;
  time: number;
}

export interface HealthSignalDetailRow {
  label: string;
  value: string;
}

export interface PublicHealthContextRow {
  signal: HealthSignal;
  label: string;
  value: string;
  scopeLabel: string;
  contextLabel: string;
  sourceLabel: string;
  secondaryLabel: string;
  demoted: boolean;
}

const HOUR_MS = 60 * 60 * 1000;

function signalPeriodType(signal: HealthSignal): ReportingPeriod['type'] | null {
  return (
    signal.reportingPeriod?.type ??
    signal.history?.find((observation) => observation.period !== undefined)?.period?.type ??
    null
  );
}

export function healthSignalDetailDefaultRange(signal: HealthSignal): DataDetailRangeId {
  if (signal.type === 'thermal-stress' || signal.type === 'ambient-dose-rate') {
    return '24h';
  }

  const periodType = signal.reportingPeriod?.type ?? signal.history?.at(-1)?.period?.type;
  if (periodType === 'week' || periodType === 'month' || periodType === 'year') {
    return 'year';
  }

  return '24h';
}

export function healthSignalDetailRangeSupported(
  signal: HealthSignal,
  rangeId: DataDetailRangeId,
): boolean {
  if (signal.type === 'thermal-stress') return rangeId === '24h';
  if (signal.type === 'ambient-dose-rate') return rangeId !== 'year';

  const periodType = signalPeriodType(signal);
  if (periodType === 'week') return rangeId === 'month' || rangeId === 'year';
  if (periodType === 'month') return rangeId === 'year';
  if (periodType === 'year') return rangeId === 'year';

  return rangeId !== 'year';
}

function isWastewaterSignal(signal: Pick<HealthSignal, 'type'>): boolean {
  return (
    signal.type === 'wastewater-covid-19' ||
    signal.type === 'wastewater-influenza' ||
    signal.type === 'wastewater-rsv'
  );
}

export function healthSignalDetailPrimaryLabel(
  signal: Pick<HealthSignal, 'domain' | 'type'>,
): string {
  if (signal.type === 'thermal-stress') return translate('health.thermalStress.currentConditions');
  if (signal.domain === 'radiological') return translate('health.radiological.currentMeasurement');
  if (signal.type === 'outbreak-event') return translate('health.outbreakSourceLabel');
  if (signal.domain === 'population-health') return translate('health.latestAvailable');
  if (signal.type === 'malaria') return translate('health.latestAnnualContext');
  if (isWastewaterSignal(signal)) return translate('health.latestWastewaterObservation');
  return translate('health.latestSurveillance');
}

export function healthSignalDetailRangeLabel(
  signal: HealthSignal,
  rangeId: DataDetailRangeId,
): string {
  const periodType = signalPeriodType(signal);

  if (signal.type === 'thermal-stress') return translate('health.timelineRanges.next24Hours');

  if (signal.type === 'ambient-dose-rate') {
    if (rangeId === '24h') return translate('health.timelineRanges.last24Hours');
    if (rangeId === 'week') return translate('health.timelineRanges.last7Days');
    if (rangeId === 'month') return translate('health.timelineRanges.last30Days');
    return dataDetailRange(rangeId).label;
  }

  if (periodType === 'week') {
    if (rangeId === 'month') return translate('health.timelineRanges.last5ReportingWeeks');
    if (rangeId === 'year') return translate('health.timelineRanges.last52ReportingWeeks');
    return dataDetailRange(rangeId).label;
  }

  if (periodType === 'month') return translate('health.timelineRanges.last12ReportingMonths');
  if (periodType === 'year') return translate('health.timelineRanges.last5ReportingYears');

  return dataDetailRange(rangeId).label;
}

export function healthSignalDetailRangeOptions(
  signal: HealthSignal,
): HealthSignalDetailRangeOption[] {
  return DATA_DETAIL_RANGES.flatMap((range) =>
    healthSignalDetailRangeSupported(signal, range.id)
      ? [{ id: range.id, label: healthSignalDetailRangeLabel(signal, range.id) }]
      : [],
  );
}

export function healthSignalHasTimelineDetail(signal: HealthSignal): boolean {
  if (signal.metadata?.unavailable === true) return false;
  if (signal.freshness.status === 'stale') return false;
  const finiteObservationCount =
    signal.history?.filter((observation) => Number.isFinite(observation.value)).length ?? 0;
  return finiteObservationCount >= 2;
}

export function healthSignalInlineDetailRows(signal: HealthSignal): HealthSignalDetailRow[] {
  const rows: HealthSignalDetailRow[] = [];

  if (signal.metadata?.unavailable === true || signal.freshness.status === 'stale') {
    rows.push({
      label: translate('health.reason'),
      value:
        signal.metadata?.unavailable === true
          ? healthSignalValueLabel(signal)
          : healthSignalFreshnessLabel(signal.freshness.status),
    });
  }

  if (signal.metadata?.unavailable !== true) {
    rows.push({
      label: healthSignalDetailPrimaryLabel(signal),
      value: healthSignalValueLabel(signal),
    });
  }

  rows.push(
    {
      label: translate('common.source'),
      value: healthSignalSourceLabel(signal),
    },
    {
      label: translate('health.geography'),
      value: healthSignalGeographyLabel(signal),
    },
    {
      label: translate('health.period'),
      value: healthSignalPeriodLabel(signal),
    },
    {
      label: translate('health.freshness'),
      value: healthSignalFreshnessDetailLabel(signal),
    },
  );

  if (signal.source.measure) {
    rows.push({
      label: translate('health.measure'),
      value: signal.source.measure,
    });
  }

  return rows.filter((row) => row.value.length > 0);
}

export function healthSignalReportingScopeLabel(signal: HealthSignal): string {
  if (signal.domain === 'radiological') return translate('health.scope.localSensor');
  if (signal.geography.level === 'country') return translate('health.scope.countryLevel');
  if (signal.geography.level === 'region') return translate('health.scope.regional');
  if (signal.geography.level === 'local') return translate('health.scope.localMonitoring');
  return translate('health.scope.publicMonitoring');
}

export function isDemotedPublicHealthSignal(signal: HealthSignal): boolean {
  return signal.metadata?.unavailable === true || signal.freshness.status !== 'fresh';
}

function healthSignalUnavailableReason(signal: HealthSignal): string | null {
  return typeof signal.metadata?.reason === 'string' ? signal.metadata.reason : null;
}

function hasNoMatchingEcdcReportingArea(signal: HealthSignal): boolean {
  const reason = healthSignalUnavailableReason(signal);
  return reason === 'no-ecdc-dengue-cluster' || reason === 'no-ecdc-chikungunya-cluster';
}

function unavailableOutbreakLabel(signal: HealthSignal): string | null {
  const reason = healthSignalUnavailableReason(signal);
  if (
    signal.type === 'outbreak-event' &&
    signal.metadata?.unavailable === true &&
    reason === 'no-relevant-who-outbreak-events'
  ) {
    return translate('health.coverage.noRelevantOutbreakEvents');
  }

  return null;
}

function staleHealthSignalValueLabel(signal: HealthSignal): string {
  if (signal.type === 'ambient-dose-rate') {
    return translate('health.radiological.noRecentLocalMeasurement');
  }
  if (isWastewaterSignal(signal)) return translate('health.wastewater.noLocalData');
  if (hasNoMatchingEcdcReportingArea(signal)) {
    return translate('health.coverage.noMatchingReportingArea');
  }
  return translate('health.noRecentData');
}

function unavailableHealthSignalValueLabel(signal: HealthSignal): string | null {
  if (signal.metadata?.providerStatus === 'provider-error') {
    return translate('health.coverage.providerUnavailable');
  }
  if (unavailableOutbreakLabel(signal)) return unavailableOutbreakLabel(signal);
  if (isWastewaterSignal(signal)) return translate('health.wastewater.noLocalData');
  if (hasNoMatchingEcdcReportingArea(signal)) {
    return translate('health.coverage.noMatchingReportingArea');
  }
  return null;
}

function publicHealthContextValueLabel(signal: HealthSignal): string {
  if (signal.metadata?.unavailable === true) {
    const unavailableLabel = unavailableHealthSignalValueLabel(signal);
    if (unavailableLabel) return unavailableLabel;
    if (signal.freshness.status === 'stale') return staleHealthSignalValueLabel(signal);
    return healthSignalValueLabel(signal);
  }

  if (signal.freshness.status === 'stale') return staleHealthSignalValueLabel(signal);
  if (signal.type === 'outbreak-event') return healthSignalValueLabel(signal);

  return healthSignalValueLabel(signal);
}

export function publicHealthContextRow(signal: HealthSignal): PublicHealthContextRow {
  const unavailable = signal.metadata?.unavailable === true;
  const freshness = healthSignalFreshnessDetailLabel(signal);
  const nearestSensorDistanceKm = signal.metadata?.nearestSensorDistanceKm;
  const temporalLabel =
    healthSignalTemporalClass(signal) === 'background'
      ? translate('health.temporal.background')
      : null;
  const geography =
    signal.domain === 'radiological' && typeof nearestSensorDistanceKm === 'number'
      ? [
          healthSignalGeographyLabel(signal),
          formatDistanceMeters(nearestSensorDistanceKm * 1000),
        ].join(' · ')
      : healthSignalGeographyLabel(signal);
  const value = publicHealthContextValueLabel(signal);
  let secondary: string;
  if (signal.type === 'outbreak-event') {
    secondary = translate('health.outbreakSourceLabel');
  } else if (unavailable || signal.domain === 'radiological') {
    secondary = healthSignalCategoryLabel(signal);
  } else {
    secondary = healthSignalTrendLabel(signal.trend);
  }

  return {
    signal,
    label:
      signal.type === 'outbreak-event' && typeof signal.metadata?.title === 'string'
        ? signal.metadata.title
        : healthSignalTypeLabel(signal.type),
    value,
    scopeLabel: healthSignalReportingScopeLabel(signal),
    contextLabel: [temporalLabel, geography, healthSignalPeriodLabel(signal), freshness]
      .filter(Boolean)
      .join(' · '),
    sourceLabel: healthSignalSourceLabel(signal),
    secondaryLabel: secondary,
    demoted: isDemotedPublicHealthSignal(signal),
  };
}

function publicHealthRowSort(left: PublicHealthContextRow, right: PublicHealthContextRow): number {
  const leftRank = left.demoted ? 1 : 0;
  const rightRank = right.demoted ? 1 : 0;
  if (leftRank !== rightRank) return leftRank - rightRank;
  if (left.signal.freshness.status !== right.signal.freshness.status) {
    return left.signal.freshness.status.localeCompare(right.signal.freshness.status);
  }
  return left.label.localeCompare(right.label);
}

export function currentPublicHealthContextRows(signals: HealthSignal[]): PublicHealthContextRow[] {
  return signals
    .filter(isCurrentContextEligible)
    .map(publicHealthContextRow)
    .sort(publicHealthRowSort);
}

export function backgroundPublicHealthContextRows(
  signals: HealthSignal[],
): PublicHealthContextRow[] {
  return signals
    .filter(
      (signal) =>
        healthSignalTemporalClass(signal) === 'background' &&
        signal.metadata?.unavailable !== true &&
        signal.metadata?.providerStatus !== 'provider-error',
    )
    .map(publicHealthContextRow)
    .sort(publicHealthRowSort);
}

function hasCoverageAvailabilityState(signal: HealthSignal): boolean {
  const unavailableOrErrored =
    signal.metadata?.unavailable === true || signal.metadata?.providerStatus === 'provider-error';
  if (healthSignalTemporalClass(signal) === 'background') {
    return signal.type !== 'thermal-stress' && unavailableOrErrored;
  }

  return (
    signal.type !== 'thermal-stress' &&
    (unavailableOrErrored || signal.freshness.status === 'stale')
  );
}

export function coveragePublicHealthContextRows(signals: HealthSignal[]): PublicHealthContextRow[] {
  return signals
    .filter(hasCoverageAvailabilityState)
    .map(publicHealthContextRow)
    .sort(publicHealthRowSort);
}

export function publicHealthContextSummary(rows: PublicHealthContextRow[]): string {
  const currentCount = rows.filter((row) => isCurrentContextEligible(row.signal)).length;
  if (currentCount === 0) return translate('today.publicHealthNoCurrentSignals');
  return translate('today.publicHealthCurrentSignals', { count: currentCount });
}

export function publicHealthBackgroundSummary(rows: PublicHealthContextRow[]): string {
  const backgroundCount = rows.length;
  if (backgroundCount === 0) return '';
  return translate('today.publicHealthBackgroundSignals', { count: backgroundCount });
}

export function publicHealthCoverageSummary(rows: PublicHealthContextRow[]): string {
  const coverageCount = rows.length;
  if (coverageCount === 0) return '';
  return translate('today.publicHealthCoverageSignals', { count: coverageCount });
}

export function healthSignalDetailMetadataRows(signal: HealthSignal): HealthSignalDetailRow[] {
  const statusLabel =
    signal.domain === 'radiological' || signal.type === 'thermal-stress'
      ? translate('health.radiological.statusLabel')
      : translate('health.trendLabel');
  const statusValue =
    signal.domain === 'radiological' || signal.type === 'thermal-stress'
      ? healthSignalCategoryLabel(signal)
      : healthSignalTrendLabel(signal.trend);

  return [
    {
      label: translate('common.source'),
      value: healthSignalSourceLabel(signal),
    },
    {
      label: translate('health.geography'),
      value: healthSignalGeographyLabel(signal),
    },
    {
      label: translate('health.period'),
      value: healthSignalPeriodLabel(signal),
    },
    {
      label: translate('health.freshness'),
      value: healthSignalFreshnessDetailLabel(signal),
    },
    {
      label: statusLabel,
      value: statusValue,
    },
  ];
}

export function selectedHealthSignalDetailRange(
  signal: HealthSignal | undefined,
  rangeSelection: RangeSelection,
): DataDetailRangeId {
  if (!signal) return '24h';
  if (
    rangeSelection.signalId === signal.id &&
    healthSignalDetailRangeSupported(signal, rangeSelection.rangeId)
  ) {
    return rangeSelection.rangeId;
  }
  return healthSignalDetailDefaultRange(signal);
}

export function healthTimelinePointsForRange<TPoint extends HealthTimelineRangePoint>(input: {
  points: TPoint[];
  signal: HealthSignal;
  rangeId: DataDetailRangeId;
  anchorTime: number;
}): TPoint[] {
  if (!healthSignalDetailRangeSupported(input.signal, input.rangeId)) return [];

  const periodType = signalPeriodType(input.signal);
  const orderedPoints = [...input.points].sort((left, right) => left.time - right.time);

  if (input.signal.type === 'thermal-stress') {
    const maxTime = input.anchorTime + 24 * HOUR_MS;
    return orderedPoints.filter((point) => point.time >= input.anchorTime && point.time <= maxTime);
  }

  if (periodType === 'week') {
    return orderedPoints.slice(input.rangeId === 'month' ? -5 : -52);
  }

  if (periodType === 'month') {
    return orderedPoints.slice(-12);
  }

  if (periodType === 'year') {
    return orderedPoints.slice(-5);
  }

  const range = dataDetailRange(input.rangeId);
  const minTime = input.anchorTime - range.historyHours * HOUR_MS;
  const maxTime = input.anchorTime + range.forecastHours * HOUR_MS;
  return orderedPoints.filter((point) => point.time >= minTime && point.time <= maxTime);
}

export function timelinePositionPercent(value: number, min: number, max: number): number {
  if (max <= min) return 0;
  const ratio = ((value - min) / (max - min)) * 100;
  return Math.max(0, Math.min(100, ratio));
}

export function healthTimelinePointValueLabel(
  point: { value: number | null; unit: string | null },
  signal: Pick<HealthSignal, 'type'>,
): string {
  const precision = signal.type === 'ambient-dose-rate' ? 2 : 1;
  const formatted = formatMeasurement(point.value, point.unit ?? '', precision);
  return signal.type === 'excess-mortality' && point.value !== null && point.value > 0
    ? `+${formatted}`
    : formatted;
}

export function healthTimelineFillStyle(input: {
  value: number;
  min: number;
  max: number;
  signalType: HealthSignal['type'];
}): TimelineFillStyle {
  if (input.signalType !== 'excess-mortality') {
    const ratio = timelinePositionPercent(input.value, input.min, input.max);
    return {
      backgroundColor: colors.primary,
      width: `${Math.max(2, Math.min(100, ratio))}%`,
    };
  }

  const baseline = timelinePositionPercent(0, input.min, input.max);
  const valuePosition = timelinePositionPercent(input.value, input.min, input.max);
  const left = Math.min(baseline, valuePosition);
  const width = Math.max(2, Math.abs(valuePosition - baseline));

  return {
    backgroundColor: input.value >= 0 ? colors.high : colors.low,
    left: `${left}%`,
    position: 'absolute',
    width: `${width}%`,
  };
}

export function todayHealthSectionVisibility(input: {
  backgroundSignalCount: number;
  contextualHealthSignalCount: number;
  coverageSignalCount: number;
  hasHealthSignalLocationContext: boolean;
  healthSignalsError: string | null;
  healthSignalsLoading: boolean;
  thermalSignalCount: number;
}): { shouldShowHealthSignals: boolean; shouldShowThermalSignals: boolean } {
  return {
    shouldShowHealthSignals:
      input.hasHealthSignalLocationContext &&
      (input.healthSignalsLoading ||
        input.healthSignalsError !== null ||
        input.contextualHealthSignalCount > 0 ||
        input.backgroundSignalCount > 0 ||
        input.coverageSignalCount > 0),
    shouldShowThermalSignals: input.hasHealthSignalLocationContext && input.thermalSignalCount > 0,
  };
}

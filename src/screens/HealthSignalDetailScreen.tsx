import { useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, View, type DimensionValue } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { AppButton } from '../components/AppButton';
import { DetailHeader } from '../components/DetailHeader';
import { DetailStateView } from '../components/DetailStateView';
import { AppIcon } from '../components/icons/AppIcon';
import { EnvironmentalIcon } from '../components/icons/EnvironmentalIcon';
import {
  healthSignalFreshnessDetailLabel,
  healthSignalGeographyLabel,
  healthSignalPeriodLabel,
  healthSignalTypeLabel,
  healthSignalValueLabel,
} from '../core/healthSignals';
import {
  healthSignalDetailPrimaryLabel,
  healthSignalDetailMetadataRows,
  healthSignalDetailRangeOptions,
  healthSignalDetailRangeLabel,
  healthSignalDetailRangeSupported,
  healthTimelineFillStyle,
  healthTimelinePointValueLabel,
  healthTimelinePointsForRange,
  selectedHealthSignalDetailRange,
  timelinePositionPercent,
} from '../core/healthSignalPresentation';
import { appLocale, translate } from '../i18n';
import type { DataDetailRangeId } from '../models/dataDetail';
import type { HealthSignal, HealthSignalObservation } from '../models/healthSignals';
import { goBackOrToday, type DetailBackNavigation } from '../navigation/detailNavigation';
import { useAppStore } from '../state/useAppStore';
import { colors, spacing } from '../theme/theme';
import { formatMeasurement, formatTimestamp } from '../utils/format';
import { isFiniteNumber } from '../utils/number';

const ROW_HEIGHT = 46;

interface HealthSignalRouteParams {
  signalId: string;
}

interface HealthTimelinePoint {
  id: string;
  label: string;
  value: number | null;
  unit: string | null;
  source: 'history' | 'forecast';
  time: number;
  period?: HealthSignalObservation['period'] | undefined;
}

interface RangeSelection {
  signalId: string | null;
  rangeId: DataDetailRangeId;
}

function isHealthSignalRouteParams(value: unknown): value is HealthSignalRouteParams {
  return (
    value !== null &&
    typeof value === 'object' &&
    typeof (value as Record<string, unknown>).signalId === 'string'
  );
}

function observationTime(observation: HealthSignalObservation): number {
  const timestamp = observation.periodEnd ?? observation.observedAt ?? observation.updatedAt;
  const parsed = timestamp ? Date.parse(timestamp) : Number.NaN;
  return Number.isFinite(parsed) ? parsed : 0;
}

function signalAnchorTime(signal: HealthSignal): number {
  const timestamp = signal.observedAt ?? signal.periodEnd ?? signal.updatedAt;
  const parsed = Date.parse(timestamp);
  return Number.isFinite(parsed) ? parsed : Date.now();
}

function observationLabel(observation: HealthSignalObservation): string {
  if (observation.period?.type === 'week') {
    return `W${String(observation.period.week).padStart(2, '0')} ${observation.period.year}`;
  }
  if (observation.period?.type === 'month') {
    const date = new Date(Date.UTC(observation.period.year, observation.period.month - 1, 1));
    return new Intl.DateTimeFormat(appLocale(), {
      month: 'short',
      timeZone: 'UTC',
      year: 'numeric',
    }).format(date);
  }
  if (observation.period?.type === 'year') {
    return String(observation.period.year);
  }

  return formatTimestamp(observation.observedAt ?? observation.updatedAt ?? null);
}

function timelinePoints(signal: HealthSignal): HealthTimelinePoint[] {
  const anchorTime = signalAnchorTime(signal);
  const observations = signal.history ?? [];

  return observations
    .filter((observation) => isFiniteNumber(observation.value))
    .sort((left, right) => observationTime(left) - observationTime(right))
    .map((observation, index) => {
      const time = observationTime(observation);
      return {
        id: [
          observation.periodEnd,
          observation.observedAt,
          observation.updatedAt,
          observation.measure,
          index,
        ].join(':'),
        label: observationLabel(observation),
        value: observation.value,
        unit: observation.unit,
        source: time > anchorTime ? ('forecast' as const) : ('history' as const),
        time,
        period: observation.period,
      };
    });
}

function average(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function visiblePointsForRange(
  points: HealthTimelinePoint[],
  signal: HealthSignal,
  rangeId: DataDetailRangeId,
): HealthTimelinePoint[] {
  return healthTimelinePointsForRange({
    anchorTime: signalAnchorTime(signal),
    points,
    rangeId,
    signal,
  });
}

function summaryRows(signal: HealthSignal, points: HealthTimelinePoint[]) {
  const values = points.map((point) => point.value).filter(isFiniteNumber);
  if (values.length <= 1) return [];

  return [
    {
      label: translate('detail.minimum'),
      value: formatMeasurement(
        Math.min(...values),
        signal.unit ?? '',
        signal.type === 'ambient-dose-rate' ? 2 : 1,
      ),
    },
    {
      label: translate('detail.maximum'),
      value: formatMeasurement(
        Math.max(...values),
        signal.unit ?? '',
        signal.type === 'ambient-dose-rate' ? 2 : 1,
      ),
    },
    {
      label: translate('detail.average'),
      value: formatMeasurement(
        average(values),
        signal.unit ?? '',
        signal.type === 'ambient-dose-rate' ? 2 : 1,
      ),
    },
  ];
}

function detailHeaderIcon(signal: HealthSignal) {
  if (signal.type === 'thermal-stress') {
    return <EnvironmentalIcon name="apparent-temperature" size="event" color={colors.primary} />;
  }

  if (signal.domain === 'radiological') {
    return <AppIcon name="radiological" size="action" color={colors.primary} />;
  }

  const iconName = signal.domain === 'population-health' ? 'population-health' : 'respiratory';
  return <AppIcon name={iconName} size="action" color={colors.primary} />;
}

function HealthTimelineChart({
  emptyMessage,
  points,
  signal,
}: {
  emptyMessage: string;
  points: HealthTimelinePoint[];
  signal: HealthSignal;
}) {
  const scrollRef = useRef<ScrollView>(null);
  const [viewportHeight, setViewportHeight] = useState(0);
  const historyPoints = useMemo(
    () => points.filter((point) => point.source === 'history'),
    [points],
  );
  const forecastPoints = useMemo(
    () => points.filter((point) => point.source === 'forecast'),
    [points],
  );
  const showNowSeparator = forecastPoints.length > 0;
  const values = points.map((point) => point.value).filter(isFiniteNumber);
  const min = values.length > 0 ? Math.min(...values, 0) : 0;
  const max = values.length > 0 ? Math.max(...values) : 1;
  const nowOffset = historyPoints.length * ROW_HEIGHT;

  useEffect(() => {
    if (viewportHeight <= 0) return;
    const targetOffset = showNowSeparator
      ? nowOffset - viewportHeight / 2
      : points.length * ROW_HEIGHT;
    const offset = Math.max(0, targetOffset);
    const timeout = setTimeout(
      () => scrollRef.current?.scrollTo({ y: offset, animated: false }),
      0,
    );
    return () => clearTimeout(timeout);
  }, [nowOffset, points.length, showNowSeparator, viewportHeight]);

  if (points.length === 0) {
    return (
      <View style={styles.emptyChart}>
        <Text style={styles.emptyText}>{emptyMessage}</Text>
      </View>
    );
  }

  return (
    <View style={styles.chart}>
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={styles.chartContent}
        nestedScrollEnabled
        onLayout={(event) => setViewportHeight(event.nativeEvent.layout.height)}
      >
        {historyPoints.map((point) => (
          <HealthPointRow key={point.id} point={point} signal={signal} min={min} max={max} />
        ))}
        {showNowSeparator ? (
          <View style={styles.nowSeparator}>
            <View style={styles.nowLine} />
            <Text style={styles.nowLabel}>{translate('detail.current')}</Text>
            <View style={styles.nowLine} />
          </View>
        ) : null}
        {forecastPoints.map((point) => (
          <HealthPointRow key={point.id} point={point} signal={signal} min={min} max={max} />
        ))}
      </ScrollView>
    </View>
  );
}

function HealthPointRow({
  point,
  signal,
  min,
  max,
}: {
  point: HealthTimelinePoint;
  signal: HealthSignal;
  min: number;
  max: number;
}) {
  return (
    <View
      style={[styles.pointRow, point.source === 'history' ? styles.historyRow : styles.forecastRow]}
    >
      <Text numberOfLines={1} style={styles.timeLabel}>
        {point.label}
      </Text>
      <View style={styles.track}>
        {point.value !== null ? (
          <View
            style={[
              styles.fill,
              healthTimelineFillStyle({
                value: point.value,
                min,
                max,
                signalType: signal.type,
              }),
            ]}
          />
        ) : null}
        {signal.type === 'excess-mortality' ? (
          <View
            style={[
              styles.zeroLine,
              { left: `${timelinePositionPercent(0, min, max)}%` as DimensionValue },
            ]}
          />
        ) : null}
      </View>
      <Text numberOfLines={1} style={styles.valueLabel}>
        {healthTimelinePointValueLabel(point, signal)}
      </Text>
    </View>
  );
}

export function HealthSignalDetailScreen() {
  const navigation = useNavigation<DetailBackNavigation>();
  const { t } = useTranslation();
  const route = useRoute();
  const params = isHealthSignalRouteParams(route.params) ? route.params : null;
  const [rangeSelection, setRangeSelection] = useState<RangeSelection>({
    signalId: null,
    rangeId: '24h',
  });
  const signal = useAppStore((state) =>
    params ? state.healthSignals.signals.find((item) => item.id === params.signalId) : undefined,
  );
  const handleBack = () => goBackOrToday(navigation);
  const rangeId = selectedHealthSignalDetailRange(signal, rangeSelection);
  const setRangeId = (nextRangeId: DataDetailRangeId) => {
    setRangeSelection({
      signalId: signal?.id ?? null,
      rangeId: nextRangeId,
    });
  };
  const points = useMemo(() => (signal ? timelinePoints(signal) : []), [signal]);
  const visiblePoints = useMemo(
    () => (signal ? visiblePointsForRange(points, signal, rangeId) : []),
    [points, rangeId, signal],
  );
  const rangeOptions = useMemo(
    () => (signal ? healthSignalDetailRangeOptions(signal) : []),
    [signal],
  );
  const chartPoints = visiblePoints.length >= 2 ? visiblePoints : [];
  const chartSummaryRows = signal ? summaryRows(signal, chartPoints) : [];
  const metadataRows = signal ? healthSignalDetailMetadataRows(signal) : [];
  const timelineTitle =
    signal?.type === 'thermal-stress'
      ? t('health.thermalStress.forecastTitle')
      : t('health.timelineTitle');
  const timelineSubtitle = signal ? healthSignalDetailRangeLabel(signal, rangeId) : '';
  const emptyTimelineMessage = useMemo(() => {
    if (!signal) return t('health.historyUnavailable');
    const rangeLabel = healthSignalDetailRangeLabel(signal, rangeId);
    if (!healthSignalDetailRangeSupported(signal, rangeId)) {
      return t('health.historyRangeUnavailable', { range: rangeLabel });
    }
    if (signal.type === 'thermal-stress') {
      return points.length === 0
        ? t('health.thermalStress.forecastUnavailable')
        : t('health.thermalStress.forecastInsufficientRange', { range: rangeLabel });
    }
    if (points.length === 0) return t('health.historyUnavailable');
    return t('health.historyInsufficientRange', { range: rangeLabel });
  }, [points.length, rangeId, signal, t]);

  if (!signal) {
    return (
      <DetailStateView
        title={t('health.detailTitle')}
        message={t('health.detailUnavailable')}
        onBack={handleBack}
      />
    );
  }

  return (
    <View style={styles.screen}>
      <DetailHeader
        title={healthSignalTypeLabel(signal.type)}
        subtitle={healthSignalGeographyLabel(signal)}
        icon={detailHeaderIcon(signal)}
        onBack={handleBack}
      />
      <View style={styles.content}>
        <View style={styles.header}>
          <Text style={styles.currentValue}>
            {healthSignalDetailPrimaryLabel(signal)}: {healthSignalValueLabel(signal)}
          </Text>
          <Text style={styles.status}>
            {healthSignalFreshnessDetailLabel(signal)} · {healthSignalPeriodLabel(signal)}
          </Text>
        </View>

        {metadataRows.length > 0 ? (
          <View style={styles.metadata}>
            {metadataRows.map((row) => (
              <View key={row.label} style={styles.metadataRow}>
                <Text style={styles.metadataLabel}>{row.label}</Text>
                <Text style={styles.metadataValue}>{row.value}</Text>
              </View>
            ))}
          </View>
        ) : null}

        {chartSummaryRows.length > 0 ? (
          <View style={styles.summary}>
            {chartSummaryRows.map((row) => (
              <View key={row.label} style={styles.summaryItem}>
                <Text numberOfLines={1} style={styles.summaryLabel}>
                  {row.label}
                </Text>
                <Text numberOfLines={2} style={styles.summaryValue}>
                  {row.value}
                </Text>
              </View>
            ))}
          </View>
        ) : null}
      </View>

      <View style={styles.chartArea}>
        <View style={styles.timelineHeader}>
          <Text style={styles.timelineTitle}>{timelineTitle}</Text>
          <Text style={styles.timelineSubtitle}>{timelineSubtitle}</Text>
        </View>
        <HealthTimelineChart
          emptyMessage={emptyTimelineMessage}
          points={chartPoints}
          signal={signal}
        />
      </View>
      {rangeOptions.length > 1 ? (
        <View style={styles.footer}>
          <View style={styles.rangeSelector}>
            {rangeOptions.map((item) => (
              <View key={item.id} style={styles.rangeButton}>
                <AppButton
                  title={item.label}
                  selected={rangeId === item.id}
                  onPress={() => setRangeId(item.id)}
                />
              </View>
            ))}
          </View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  chart: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 12,
    borderWidth: 1,
    flex: 1,
    overflow: 'hidden',
  },
  chartArea: {
    flex: 1,
    paddingBottom: spacing.lg,
    paddingHorizontal: spacing.lg,
  },
  chartContent: {
    paddingVertical: spacing.xs,
  },
  content: {
    gap: spacing.lg,
    padding: spacing.lg,
    paddingBottom: spacing.md,
  },
  currentValue: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '800',
  },
  emptyChart: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 12,
    borderWidth: 1,
    padding: spacing.lg,
  },
  emptyText: {
    color: colors.muted,
    fontSize: 14,
  },
  fill: {
    borderRadius: 999,
    height: '100%',
  },
  footer: {
    gap: spacing.sm,
    paddingBottom: spacing.lg,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
  },
  forecastRow: {
    backgroundColor: '#FFF7EC',
  },
  header: {
    gap: spacing.xs,
  },
  historyRow: {
    backgroundColor: '#EEF5F0',
  },
  metadata: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 12,
    borderWidth: 1,
    gap: spacing.sm,
    padding: spacing.md,
  },
  metadataLabel: {
    color: colors.muted,
    flex: 0.8,
    fontSize: 12,
    fontWeight: '700',
  },
  metadataRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  metadataValue: {
    color: colors.text,
    flex: 1.4,
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 18,
    textAlign: 'right',
  },
  nowLabel: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  nowLine: {
    backgroundColor: colors.primary,
    flex: 1,
    height: 2,
  },
  nowSeparator: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
    height: ROW_HEIGHT,
    paddingHorizontal: spacing.md,
  },
  pointRow: {
    alignItems: 'center',
    flexDirection: 'row',
    height: ROW_HEIGHT,
    paddingHorizontal: spacing.md,
  },
  rangeButton: {
    flex: 1,
  },
  rangeSelector: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  screen: {
    backgroundColor: colors.background,
    flex: 1,
  },
  status: {
    color: colors.muted,
    fontSize: 14,
    fontWeight: '700',
  },
  summary: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: 'row',
    padding: spacing.md,
  },
  summaryItem: {
    alignItems: 'center',
    flexBasis: 0,
    flexGrow: 1,
    gap: spacing.xs,
    minWidth: 0,
  },
  summaryLabel: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
  },
  summaryValue: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '800',
    textAlign: 'center',
  },
  timeLabel: {
    color: colors.muted,
    flex: 1.1,
    fontSize: 12,
  },
  timelineHeader: {
    gap: spacing.xs,
    paddingBottom: spacing.sm,
  },
  timelineSubtitle: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: '700',
  },
  timelineTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '800',
  },
  track: {
    backgroundColor: '#E6ECE7',
    borderRadius: 999,
    flex: 1.2,
    height: 12,
    overflow: 'hidden',
    position: 'relative',
  },
  valueLabel: {
    color: colors.text,
    flex: 0.8,
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'right',
  },
  zeroLine: {
    backgroundColor: colors.text,
    height: '100%',
    opacity: 0.45,
    position: 'absolute',
    width: 1,
  },
});

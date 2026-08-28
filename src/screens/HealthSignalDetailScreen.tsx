import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { DetailHeader } from '../components/DetailHeader';
import { DetailStateView } from '../components/DetailStateView';
import { AppIcon } from '../components/icons/AppIcon';
import { SectionCard } from '../components/SectionCard';
import { SummaryMetricGrid } from '../components/ui/SummaryMetricGrid';
import {
  healthSignalCategoryLabel,
  healthSignalPeriodLabel,
  healthSignalFreshnessLabel,
  healthSignalGeographyLabel,
  healthSignalSourceLabel,
  healthSignalTrendLabel,
  healthSignalTypeLabel,
  healthSignalValueLabel,
} from '../core/healthSignals';
import type {
  BiologicalEvidence,
  HealthSignal,
  RadiologicalEvidence,
} from '../models/healthSignals';
import { goBackOrToday, type DetailBackNavigation } from '../navigation/detailNavigation';
import { useAppStore } from '../state/useAppStore';
import { colors, spacing } from '../theme/theme';
import { formatMeasurement, formatTimestamp } from '../utils/format';

interface HealthSignalRouteParams {
  signalId: string;
}

function isHealthSignalRouteParams(value: unknown): value is HealthSignalRouteParams {
  return (
    value !== null &&
    typeof value === 'object' &&
    typeof (value as Record<string, unknown>).signalId === 'string'
  );
}

function iconNameForSignal(
  signal: HealthSignal,
): 'respiratory' | 'population-health' | 'radiological' {
  if (signal.domain === 'radiological') return 'radiological';
  return signal.domain === 'population-health' ? 'population-health' : 'respiratory';
}

function evidenceValueLabel(evidence: BiologicalEvidence | RadiologicalEvidence): string {
  if (evidence.value === undefined || evidence.unit === undefined) return '';

  return formatMeasurement(evidence.value, evidence.unit, evidence.unit === 'µSv/h' ? 2 : 1);
}

function isRadiologicalEvidence(
  evidence: BiologicalEvidence | RadiologicalEvidence,
): evidence is RadiologicalEvidence {
  return 'measuredAt' in evidence;
}

function evidenceKey(evidence: BiologicalEvidence | RadiologicalEvidence): string {
  if (isRadiologicalEvidence(evidence)) {
    return [
      evidence.provider,
      evidence.sensorId,
      evidence.measurementId,
      evidence.measuredAt,
      evidence.value,
    ].join(':');
  }

  return [
    evidence.provider,
    evidence.pathogen,
    evidence.periodStart ?? evidence.reportingPeriod.year,
    evidence.periodEnd ??
      (evidence.reportingPeriod.type === 'week'
        ? evidence.reportingPeriod.week
        : evidence.reportingPeriod.month),
    evidence.measure,
  ].join(':');
}

function evidenceLabel(evidence: BiologicalEvidence | RadiologicalEvidence): string {
  if (isRadiologicalEvidence(evidence)) return evidence.sensorId ?? evidence.provider;
  return evidence.measure;
}

function numberMetadata(signal: HealthSignal, key: string): number | null {
  const value = signal.metadata?.[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function baselineMedian(signal: HealthSignal): number | null {
  const baseline = signal.metadata?.baseline;
  if (baseline === null || typeof baseline !== 'object' || !('median' in baseline)) return null;
  return typeof baseline.median === 'number' && Number.isFinite(baseline.median)
    ? baseline.median
    : null;
}

export function HealthSignalDetailScreen() {
  const navigation = useNavigation<DetailBackNavigation>();
  const { t } = useTranslation();
  const route = useRoute();
  const params = isHealthSignalRouteParams(route.params) ? route.params : null;
  const signal = useAppStore((state) =>
    params ? state.healthSignals.signals.find((item) => item.id === params.signalId) : undefined,
  );
  const handleBack = () => goBackOrToday(navigation);

  if (!signal) {
    return (
      <DetailStateView
        title={t('health.detailTitle')}
        message={t('health.detailUnavailable')}
        onBack={handleBack}
      />
    );
  }
  const signalLabel = healthSignalTypeLabel(signal.type);
  const geographyLabel = healthSignalGeographyLabel(signal);

  return (
    <View style={styles.screen}>
      <DetailHeader
        title={signalLabel}
        subtitle={geographyLabel}
        icon={<AppIcon name={iconNameForSignal(signal)} size="action" color={colors.primary} />}
        onBack={handleBack}
      />
      <ScrollView style={styles.scroller} contentContainerStyle={styles.content}>
        <SectionCard>
          <SummaryMetricGrid
            metrics={[
              {
                label:
                  signal.domain === 'radiological'
                    ? t('health.radiological.currentMeasurement')
                    : t('health.latestSurveillance'),
                value: healthSignalValueLabel(signal),
                accent: colors.primary,
              },
              {
                label:
                  signal.domain === 'radiological'
                    ? t('health.radiological.statusLabel')
                    : t('health.trendLabel'),
                value:
                  signal.domain === 'radiological'
                    ? healthSignalCategoryLabel(signal)
                    : healthSignalTrendLabel(signal.trend),
                compact: true,
              },
            ]}
          />
        </SectionCard>

        <SectionCard title={t('health.reporting')}>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>{t('health.geography')}</Text>
            <Text style={styles.detailValue}>{geographyLabel}</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>{t('health.period')}</Text>
            <Text style={styles.detailValue}>{healthSignalPeriodLabel(signal)}</Text>
          </View>
          {signal.domain === 'radiological' ? (
            <>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>{t('health.radiological.nearestSensor')}</Text>
                <Text style={styles.detailValue}>
                  {formatMeasurement(numberMetadata(signal, 'nearestSensorDistanceKm'), 'km', 1)}
                </Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>{t('health.radiological.localBaseline')}</Text>
                <Text style={styles.detailValue}>
                  {formatMeasurement(baselineMedian(signal), 'µSv/h', 2)}
                </Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>{t('health.radiological.difference')}</Text>
                <Text style={styles.detailValue}>
                  {numberMetadata(signal, 'ratioToBaseline') !== null
                    ? `${formatMeasurement(numberMetadata(signal, 'ratioToBaseline'), '', 1)}×`
                    : t('common.unavailable')}
                </Text>
              </View>
            </>
          ) : null}
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>{t('common.updated')}</Text>
            <Text style={styles.detailValue}>{formatTimestamp(signal.updatedAt)}</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>{t('health.freshness')}</Text>
            <Text style={styles.detailValue}>
              {healthSignalFreshnessLabel(signal.freshness.status)}
            </Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>{t('common.source')}</Text>
            <Text style={styles.detailValue}>{healthSignalSourceLabel(signal)}</Text>
          </View>
        </SectionCard>

        {signal.evidence && signal.evidence.length > 0 ? (
          <SectionCard title={t('health.evidence')}>
            {signal.evidence.slice(0, 4).map((evidence) => (
              <View key={evidenceKey(evidence)} style={styles.detailRow}>
                <Text style={styles.detailLabel}>{evidenceLabel(evidence)}</Text>
                <Text style={styles.detailValue}>{evidenceValueLabel(evidence)}</Text>
              </View>
            ))}
          </SectionCard>
        ) : null}

        <SectionCard title={t('health.about')}>
          <Text style={styles.body}>
            {signal.domain === 'radiological'
              ? t('health.radiological.disclaimer')
              : t('health.populationDisclaimer')}
          </Text>
          {signal.source.measure ? <Text style={styles.body}>{signal.source.measure}</Text> : null}
        </SectionCard>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  body: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 20,
  },
  content: {
    padding: spacing.lg,
  },
  detailLabel: {
    color: colors.muted,
    flex: 1,
    fontSize: 14,
  },
  detailRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
    justifyContent: 'space-between',
    minHeight: 36,
  },
  detailValue: {
    color: colors.text,
    flex: 1,
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'right',
  },
  screen: {
    backgroundColor: colors.background,
    flex: 1,
  },
  scroller: {
    backgroundColor: colors.background,
  },
});

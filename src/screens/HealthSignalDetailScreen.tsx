import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { DetailHeader } from '../components/DetailHeader';
import { DetailStateView } from '../components/DetailStateView';
import { AppIcon } from '../components/icons/AppIcon';
import { SectionCard } from '../components/SectionCard';
import { SummaryMetricGrid } from '../components/ui/SummaryMetricGrid';
import {
  healthSignalPeriodLabel,
  healthSignalFreshnessLabel,
  healthSignalGeographyLabel,
  healthSignalSourceLabel,
  healthSignalTrendLabel,
  healthSignalTypeLabel,
  healthSignalValueLabel,
} from '../core/healthSignals';
import type { BiologicalEvidence, HealthSignal } from '../models/healthSignals';
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

function iconNameForSignal(signal: HealthSignal): 'respiratory' | 'population-health' {
  return signal.domain === 'population-health' ? 'population-health' : 'respiratory';
}

function evidenceValueLabel(evidence: BiologicalEvidence): string {
  if (evidence.value === undefined || evidence.unit === undefined) return '';

  return formatMeasurement(evidence.value, evidence.unit, 1);
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
                label: t('health.latestSurveillance'),
                value: healthSignalValueLabel(signal),
                accent: colors.primary,
              },
              {
                label: t('health.trendLabel'),
                value: healthSignalTrendLabel(signal.trend),
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
              <View
                key={[
                  evidence.provider,
                  evidence.pathogen,
                  evidence.periodStart ?? evidence.reportingPeriod.year,
                  evidence.periodEnd ??
                    (evidence.reportingPeriod.type === 'week'
                      ? evidence.reportingPeriod.week
                      : evidence.reportingPeriod.month),
                  evidence.measure,
                ].join(':')}
                style={styles.detailRow}
              >
                <Text style={styles.detailLabel}>{evidence.measure}</Text>
                <Text style={styles.detailValue}>{evidenceValueLabel(evidence)}</Text>
              </View>
            ))}
          </SectionCard>
        ) : null}

        <SectionCard title={t('health.about')}>
          <Text style={styles.body}>{t('health.populationDisclaimer')}</Text>
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

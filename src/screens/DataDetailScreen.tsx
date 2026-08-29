import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { AppButton } from '../components/AppButton';
import { DetailHeader } from '../components/DetailHeader';
import { DetailStateView } from '../components/DetailStateView';
import { EnvironmentalIcon } from '../components/icons/EnvironmentalIcon';
import { getVariableIconName } from '../components/icons/environmentalIconResolver';
import { VerticalTimelineChart } from '../components/VerticalTimelineChart';
import {
  DATA_DETAIL_RANGES,
  currentDataDetailValue,
  dataDetailRange,
  dataDetailVariable,
  formatDataDetailValue,
} from '../core/dataVariableMetadata';
import { visibleCurrentDataDetailValue } from '../core/dataDetailCurrentValue';
import type { DataDetailRangeId, DataDetailTimeline } from '../models/dataDetail';
import type { EnvironmentalVariableId } from '../capabilities/types';
import { goBackOrToday, type DetailBackNavigation } from '../navigation/detailNavigation';
import { loadDataDetailTimeline } from '../services/dataDetailService';
import { useAppStore } from '../state/useAppStore';
import { colors, spacing } from '../theme/theme';
import { translate } from '../i18n';

interface DataDetailRouteParams {
  variableId: EnvironmentalVariableId;
}

type DataDetailNavigation = DetailBackNavigation;

function isDataDetailRouteParams(value: unknown): value is DataDetailRouteParams {
  return (
    value !== null &&
    typeof value === 'object' &&
    typeof (value as Record<string, unknown>).variableId === 'string'
  );
}

function DetailUnavailable({ onBack }: { onBack: () => void }) {
  return (
    <DetailStateView
      title={translate('detail.timeline')}
      message={translate('detail.timelineUnavailable')}
      onBack={onBack}
    />
  );
}

function summaryStatLabel(stat: 'minimum' | 'maximum' | 'average'): string {
  if (stat === 'minimum') return translate('detail.minimum');
  if (stat === 'maximum') return translate('detail.maximum');
  return translate('detail.average');
}

export function DataDetailScreen() {
  const navigation = useNavigation<DataDetailNavigation>();
  const { t } = useTranslation();
  const route = useRoute();
  const environment = useAppStore((state) => state.environment);
  const [rangeId, setRangeId] = useState<DataDetailRangeId>('24h');
  const [timeline, setTimeline] = useState<DataDetailTimeline | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fallbackNow] = useState(() => new Date().toISOString());
  const params = isDataDetailRouteParams(route.params) ? route.params : null;
  const variable = params ? dataDetailVariable(params.variableId) : null;
  const range = dataDetailRange(rangeId);
  const now = environment?.current.timestamp ?? environment?.fetchedAt ?? fallbackNow;
  const environmentCurrentValue =
    environment?.current && variable ? currentDataDetailValue(environment.current, variable) : null;
  const currentValue = visibleCurrentDataDetailValue({
    environmentCurrentValue,
    timeline,
  });
  const handleBack = () => goBackOrToday(navigation);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!environment?.coordinates || !params?.variableId || !variable) {
        setTimeline(null);
        return;
      }

      setTimeline(null);
      setLoading(true);
      setError(null);

      try {
        const nextTimeline = await loadDataDetailTimeline({
          coordinates: environment.coordinates,
          variableId: params.variableId,
          rangeId,
          now,
        });
        if (!cancelled) {
          setTimeline(nextTimeline);
          setError(nextTimeline.error);
        }
      } catch (loadError) {
        if (!cancelled) {
          setTimeline(null);
          setError(
            loadError instanceof Error ? loadError.message : t('detail.timelineUnavailable'),
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [environment?.coordinates, now, params?.variableId, rangeId, t, variable]);

  const summaryRows =
    timeline && variable
      ? variable.summaryStats.flatMap((stat) => {
          const value = timeline.summary[stat];
          if (value === null) return [];
          const label = summaryStatLabel(stat);
          return [{ label, value: formatDataDetailValue(variable, value) }];
        })
      : [];

  if (!params || !variable || !environment?.coordinates) {
    return <DetailUnavailable onBack={handleBack} />;
  }

  return (
    <View style={styles.screen}>
      <DetailHeader title={variable.label} onBack={handleBack} />
      <View style={styles.content}>
        <View style={styles.header}>
          <EnvironmentalIcon
            accessibilityLabel={t('detail.environmentalIconLabel', { label: variable.label })}
            name={getVariableIconName(variable.id)}
            size="event"
          />
          <View style={styles.headerCopy}>
            <Text style={styles.currentValue}>
              {t('detail.current')}: {formatDataDetailValue(variable, currentValue)}
            </Text>
          </View>
        </View>

        {summaryRows.length > 0 ? (
          <View style={styles.summary}>
            {summaryRows.map((row) => (
              <View key={row.label} style={styles.summaryItem}>
                <Text style={styles.summaryLabel}>{row.label}</Text>
                <Text style={styles.summaryValue}>{row.value}</Text>
              </View>
            ))}
          </View>
        ) : null}

        {loading ? <Text style={styles.status}>{t('detail.loadingTimeline')}</Text> : null}
        {error && !loading ? <Text style={styles.status}>{error}</Text> : null}
      </View>

      <View style={styles.chartArea}>
        {timeline ? <VerticalTimelineChart timeline={timeline} variable={variable} /> : null}
      </View>
      <View style={styles.footer}>
        <View style={styles.rangeSelector}>
          {DATA_DETAIL_RANGES.map((item) => (
            <View key={item.id} style={styles.rangeButton}>
              <AppButton
                title={dataDetailRange(item.id).label}
                selected={range.id === item.id}
                onPress={() => setRangeId(item.id)}
              />
            </View>
          ))}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: spacing.lg,
    padding: spacing.lg,
    paddingBottom: spacing.md,
  },
  currentValue: {
    color: colors.muted,
    fontSize: 15,
    fontWeight: '700',
  },
  footer: {
    gap: spacing.sm,
    paddingBottom: spacing.lg,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.xs,
  },
  headerCopy: {
    flex: 1,
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
    fontStyle: 'italic',
  },
  summary: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: 'row',
    padding: spacing.md,
  },
  chartArea: {
    flex: 1,
    paddingBottom: spacing.lg,
    paddingHorizontal: spacing.lg,
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
    fontSize: 14,
    fontWeight: '800',
    textAlign: 'center',
  },
});

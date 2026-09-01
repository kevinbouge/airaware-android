import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { DetailHeader } from '../components/DetailHeader';
import { AppIcon } from '../components/icons/AppIcon';
import { getHealthSignalIconName } from '../components/icons/healthSignalIconResolver';
import {
  backgroundPublicHealthContextRows,
  coveragePublicHealthContextRows,
  currentPublicHealthContextRows,
  healthSignalHasTimelineDetail,
  healthSignalInlineDetailRows,
  publicHealthBackgroundSummary,
  publicHealthCoverageSummary,
  publicHealthContextSummary,
  type PublicHealthContextRow,
} from '../core/healthSignalPresentation';
import { translate } from '../i18n';
import type { HealthSignal } from '../models/healthSignals';
import { goBackOrToday, type DetailBackNavigation } from '../navigation/detailNavigation';
import { useAppStore } from '../state/useAppStore';
import { colors, spacing } from '../theme/theme';

function PublicHealthSignalRow({
  expanded,
  onPress,
  onToggleInline,
  row,
}: {
  expanded: boolean;
  onPress: (signal: HealthSignal) => void;
  onToggleInline: (signal: HealthSignal) => void;
  row: PublicHealthContextRow;
}) {
  const hasTimelineDetail = healthSignalHasTimelineDetail(row.signal);
  const inlineRows = !hasTimelineDetail && expanded ? healthSignalInlineDetailRows(row.signal) : [];
  const accessibilityLabel = hasTimelineDetail
    ? translate('today.opensDetails', { label: `${row.label}: ${row.value}` })
    : translate('today.expandsDetails', { label: `${row.label}: ${row.value}` });
  const color = row.demoted ? colors.unavailable : colors.primary;
  const handlePress = () => {
    if (hasTimelineDetail) {
      onPress(row.signal);
      return;
    }
    onToggleInline(row.signal);
  };

  return (
    <View style={[styles.signalCard, row.demoted ? styles.demoted : null]}>
      <Pressable
        accessibilityLabel={accessibilityLabel}
        accessibilityRole="button"
        accessibilityState={!hasTimelineDetail ? { expanded } : undefined}
        onPress={handlePress}
        style={({ pressed }) => [styles.signalButton, pressed ? styles.pressed : null]}
      >
        <View style={[styles.iconShell, { borderColor: color }]}>
          <AppIcon name={getHealthSignalIconName(row.signal)} size="action" color={color} />
        </View>
        <View style={styles.signalCopy}>
          <Text style={styles.scope}>{row.scopeLabel}</Text>
          <Text style={[styles.signalTitle, row.demoted ? styles.demotedText : null]}>
            {row.label}
          </Text>
          <Text style={styles.meta}>{row.contextLabel}</Text>
          {row.sourceLabel.length > 0 ? (
            <Text style={styles.meta}>
              {translate('common.source')}: {row.sourceLabel}
            </Text>
          ) : null}
        </View>
        <View style={styles.signalValueBlock}>
          <Text style={[styles.signalValue, row.demoted ? styles.demotedText : null]}>
            {row.value}
          </Text>
          <Text style={styles.meta}>{row.secondaryLabel}</Text>
        </View>
        <AppIcon
          name={hasTimelineDetail ? 'chevron-right' : 'info'}
          size="inline"
          color={colors.muted}
        />
      </Pressable>
      {inlineRows.length > 0 ? (
        <View style={styles.inlineDetails}>
          {inlineRows.map((detail) => (
            <View key={detail.label} style={styles.inlineRow}>
              <Text style={styles.inlineLabel}>{detail.label}</Text>
              <Text style={styles.inlineValue}>{detail.value}</Text>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

export function PublicHealthContextSignalGroups({
  coverageRows,
  currentRows,
  backgroundRows,
  expandedSignalIds,
  onPressSignal,
  onToggleInline,
}: {
  coverageRows: PublicHealthContextRow[];
  currentRows: PublicHealthContextRow[];
  backgroundRows: PublicHealthContextRow[];
  expandedSignalIds: Set<string>;
  onPressSignal: (signal: HealthSignal) => void;
  onToggleInline: (signal: HealthSignal) => void;
}) {
  return (
    <>
      {currentRows.length > 0 ? (
        <>
          <Text style={styles.sectionLabel}>{translate('health.temporal.current')}</Text>
          <Text style={styles.summary}>{publicHealthContextSummary(currentRows)}</Text>
          {currentRows.map((row) => (
            <PublicHealthSignalRow
              key={row.signal.id}
              expanded={expandedSignalIds.has(row.signal.id)}
              row={row}
              onPress={onPressSignal}
              onToggleInline={onToggleInline}
            />
          ))}
        </>
      ) : null}
      {backgroundRows.length > 0 ? (
        <>
          <Text style={styles.sectionLabel}>{translate('health.temporal.background')}</Text>
          <Text style={styles.summary}>{publicHealthBackgroundSummary(backgroundRows)}</Text>
          {backgroundRows.map((row) => (
            <PublicHealthSignalRow
              key={row.signal.id}
              expanded={expandedSignalIds.has(row.signal.id)}
              row={row}
              onPress={onPressSignal}
              onToggleInline={onToggleInline}
            />
          ))}
        </>
      ) : null}
      {coverageRows.length > 0 ? (
        <>
          <Text style={styles.sectionLabel}>{translate('health.temporal.coverage')}</Text>
          <Text style={styles.summary}>{publicHealthCoverageSummary(coverageRows)}</Text>
          {coverageRows.map((row) => (
            <PublicHealthSignalRow
              key={row.signal.id}
              expanded={expandedSignalIds.has(row.signal.id)}
              row={row}
              onPress={onPressSignal}
              onToggleInline={onToggleInline}
            />
          ))}
        </>
      ) : null}
    </>
  );
}

export function PublicHealthContextScreen() {
  const navigation = useNavigation<DetailBackNavigation>();
  const healthSignals = useAppStore((state) => state.healthSignals);
  const [expandedSignalIds, setExpandedSignalIds] = useState<Set<string>>(() => new Set());
  const contextualSignals = healthSignals.signals.filter(
    (signal) => signal.type !== 'thermal-stress',
  );
  const currentRows = currentPublicHealthContextRows(contextualSignals);
  const backgroundRows = backgroundPublicHealthContextRows(contextualSignals);
  const coverageRows = coveragePublicHealthContextRows(contextualSignals);
  const rows = [...currentRows, ...backgroundRows, ...coverageRows];
  const handleBack = () => goBackOrToday(navigation);
  const openSignal = (signal: HealthSignal) => {
    navigation.navigate('HealthSignalDetail', { signalId: signal.id });
  };
  const toggleInline = (signal: HealthSignal) => {
    setExpandedSignalIds((current) => {
      const next = new Set(current);
      if (next.has(signal.id)) {
        next.delete(signal.id);
      } else {
        next.add(signal.id);
      }
      return next;
    });
  };

  return (
    <View style={styles.screen}>
      <DetailHeader
        title={translate('today.publicHealthContext')}
        subtitle={translate('today.publicHealthContextSubtitle')}
        icon={<AppIcon name="respiratory" size="action" color={colors.primary} />}
        onBack={handleBack}
      />
      <ScrollView contentContainerStyle={styles.content}>
        {healthSignals.error ? <Text style={styles.notice}>{healthSignals.error}</Text> : null}
        {healthSignals.loading ? (
          <Text style={styles.body}>{translate('today.loadingPublicHealthContext')}</Text>
        ) : null}
        {!healthSignals.loading && rows.length === 0 ? (
          <Text style={styles.body}>{translate('today.publicHealthNoCurrentSignals')}</Text>
        ) : null}
        <PublicHealthContextSignalGroups
          coverageRows={coverageRows}
          currentRows={currentRows}
          backgroundRows={backgroundRows}
          expandedSignalIds={expandedSignalIds}
          onPressSignal={openSignal}
          onToggleInline={toggleInline}
        />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  body: {
    color: colors.text,
    lineHeight: 20,
  },
  content: {
    gap: spacing.md,
    padding: spacing.lg,
  },
  demoted: {
    opacity: 0.72,
  },
  demotedText: {
    color: colors.muted,
  },
  iconShell: {
    alignItems: 'center',
    borderRadius: 8,
    borderWidth: 1,
    height: 34,
    justifyContent: 'center',
    width: 34,
  },
  inlineDetails: {
    borderTopColor: colors.border,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: spacing.xs,
    padding: spacing.md,
    paddingTop: spacing.sm,
  },
  inlineLabel: {
    color: colors.muted,
    flex: 1,
    fontSize: 12,
    fontWeight: '700',
  },
  inlineRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  inlineValue: {
    color: colors.text,
    flex: 2,
    fontSize: 12,
    textAlign: 'right',
  },
  meta: {
    color: colors.muted,
    fontSize: 12,
    lineHeight: 17,
  },
  notice: {
    backgroundColor: '#FFF3CD',
    borderRadius: 8,
    color: '#856404',
    padding: spacing.md,
  },
  pressed: {
    backgroundColor: colors.pressedSurface,
  },
  scope: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0,
    textTransform: 'uppercase',
  },
  sectionLabel: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0,
    textTransform: 'uppercase',
  },
  screen: {
    backgroundColor: colors.background,
    flex: 1,
  },
  signalButton: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
    padding: spacing.md,
  },
  signalCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
  },
  signalCopy: {
    flex: 1,
    gap: 2,
    minWidth: 0,
  },
  signalTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '800',
  },
  signalValue: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '800',
    textAlign: 'right',
  },
  signalValueBlock: {
    alignItems: 'flex-end',
    flexShrink: 1,
    gap: 2,
  },
  summary: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 18,
  },
});

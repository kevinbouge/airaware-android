import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { AppButton } from '../components/AppButton';
import { OptionButton } from '../components/OptionButton';
import { SectionCard } from '../components/SectionCard';
import { ActivityIcon } from '../components/icons/ActivityIcon';
import { activityDomains } from '../core/activityDefinitions';
import { useCapabilities } from '../hooks/useCapabilities';
import { useAppStore } from '../state/useAppStore';
import { colors, spacing } from '../theme/theme';

const PRO_OUTCOME_GROUPS = [
  {
    titleKey: 'pro.outcomes.knowBeforeChange.title',
    bodyKey: 'pro.outcomes.knowBeforeChange.body',
    bulletKeys: [
      'pro.outcomes.knowBeforeChange.pollen',
      'pro.outcomes.knowBeforeChange.airPollution',
      'pro.outcomes.knowBeforeChange.dust',
      'pro.outcomes.knowBeforeChange.wildfire',
      'pro.outcomes.knowBeforeChange.uv',
      'pro.outcomes.knowBeforeChange.mold',
      'pro.outcomes.knowBeforeChange.overallRisk',
    ],
  },
  {
    titleKey: 'pro.outcomes.findBestTime.title',
    bodyKey: 'pro.outcomes.findBestTime.body',
    bulletKeys: [
      'pro.outcomes.findBestTime.agriculture',
      'pro.outcomes.findBestTime.droneOperations',
      'pro.outcomes.findBestTime.photography',
      'pro.outcomes.findBestTime.astronomy',
      'pro.outcomes.findBestTime.outdoorWork',
    ],
  },
  {
    titleKey: 'pro.outcomes.seeFurtherAhead.title',
    bodyKey: 'pro.outcomes.seeFurtherAhead.body',
    bulletKeys: ['pro.outcomes.seeFurtherAhead.forecast'],
  },
  {
    titleKey: 'pro.outcomes.withoutOpening.title',
    bodyKey: 'pro.outcomes.withoutOpening.body',
    bulletKeys: [
      'pro.outcomes.withoutOpening.currentCondition',
      'pro.outcomes.withoutOpening.mainFactor',
      'pro.outcomes.withoutOpening.bestWindow',
      'pro.outcomes.withoutOpening.compactForecast',
    ],
  },
] as const;

type StoreState = ReturnType<typeof useAppStore.getState>;
type ActivityDefinition = ReturnType<typeof activityDomains>[number];

function DevelopmentPreviewControls({
  developmentEntitlementOverride,
  onSetDevelopmentEntitlement,
  t,
}: {
  developmentEntitlementOverride: StoreState['developmentEntitlementOverride'];
  onSetDevelopmentEntitlement: StoreState['setDevelopmentEntitlement'];
  t: TFunction;
}) {
  if (!__DEV__) return null;

  return (
    <>
      <Text style={styles.body}>{t('pro.developmentPreview')}</Text>
      <View style={styles.buttonRow}>
        <OptionButton
          label={t('pro.useRevenueCat')}
          iconName="restore"
          selected={developmentEntitlementOverride === null}
          onPress={() => onSetDevelopmentEntitlement(null)}
        />
      </View>
      <View style={styles.twoButtonRow}>
        <OptionButton
          label={t('pro.previewFree')}
          iconName="profile"
          selected={developmentEntitlementOverride?.kind === 'free'}
          grow
          onPress={() => onSetDevelopmentEntitlement('free')}
        />
        <OptionButton
          label={t('pro.previewPro')}
          iconName="pro"
          selected={developmentEntitlementOverride?.kind === 'pro_lifetime'}
          grow
          onPress={() => onSetDevelopmentEntitlement('pro_lifetime')}
        />
      </View>
    </>
  );
}

function ProOutcomeGroups({ t }: { t: TFunction }) {
  return PRO_OUTCOME_GROUPS.map((group) => (
    <View key={group.titleKey} style={styles.outcomeGroup}>
      <Text style={styles.outcomeTitle}>{t(group.titleKey)}</Text>
      <Text style={styles.notice}>{t(group.bodyKey)}</Text>
      {group.bulletKeys.map((bulletKey) => (
        <Text key={bulletKey} style={styles.body}>
          - {t(bulletKey)}
        </Text>
      ))}
    </View>
  ));
}

function ProBillingActions({
  billingBusy,
  billingMessage,
  billingState,
  entitlement,
  purchaseAvailable,
  refreshBilling,
  restorePurchases,
  purchaseProLifetime,
  unlockTitle,
  t,
}: {
  billingBusy: boolean;
  billingMessage: string | null;
  billingState: StoreState['billingState'];
  entitlement: StoreState['entitlement'];
  purchaseAvailable: boolean;
  refreshBilling: StoreState['refreshBilling'];
  restorePurchases: StoreState['restorePurchases'];
  purchaseProLifetime: StoreState['purchaseProLifetime'];
  unlockTitle: string;
  t: TFunction;
}) {
  return (
    <>
      {billingState.billingStatus === 'unconfigured' ? (
        <Text style={styles.notice}>{t('pro.unconfigured')}</Text>
      ) : null}
      {billingState.billingStatus === 'unavailable' ? (
        <Text style={styles.notice}>{t('pro.unavailable')}</Text>
      ) : null}
      {billingState.billingStatus === 'error' || billingState.billingStatus === 'offline' ? (
        <Text style={styles.notice}>{t('pro.purchaseUnavailable')}</Text>
      ) : null}
      {billingState.billingStatus === 'ready' && !billingState.proActive ? (
        <AppButton
          title={unlockTitle}
          iconName="pro"
          fullWidth
          disabled={!purchaseAvailable || billingBusy}
          onPress={purchaseProLifetime}
        />
      ) : null}
      <AppButton
        title={billingState.restoreInProgress ? t('pro.restoring') : t('pro.restore')}
        iconName="restore"
        fullWidth
        disabled={billingState.billingStatus !== 'ready' || billingBusy}
        onPress={restorePurchases}
      />
      {billingState.billingStatus !== 'ready' ? (
        <AppButton title={t('pro.retry')} iconName="refresh" fullWidth onPress={refreshBilling} />
      ) : null}
      {billingMessage ? <Text style={styles.notice}>{billingMessage}</Text> : null}
      {!billingMessage && billingState.error ? (
        <Text style={styles.notice}>{billingState.error}</Text>
      ) : null}
      {__DEV__ ? (
        <Text style={styles.notice}>
          {t('pro.effectiveEntitlement', {
            kind: entitlement.kind === 'pro_lifetime' ? t('navigation.pro') : t('pro.free'),
            source: billingState.entitlementSource,
          })}
        </Text>
      ) : null}
    </>
  );
}

function ActivityToggleRow({
  activity,
  disabled,
  enabled,
  onToggle,
  t,
}: {
  activity: ActivityDefinition;
  disabled: boolean;
  enabled: boolean;
  onToggle: () => void;
  t: TFunction;
}) {
  return (
    <Pressable
      accessibilityLabel={t('activities.activityAccessibility', { label: activity.label })}
      accessibilityRole="switch"
      accessibilityState={{ checked: enabled, disabled }}
      disabled={disabled}
      onPress={onToggle}
      style={({ pressed }) => [
        styles.activityRow,
        disabled ? styles.disabled : null,
        pressed && !disabled ? styles.pressed : null,
      ]}
    >
      <View style={styles.activityIdentity}>
        <ActivityIcon activity={activity.id} size="activity" color={colors.text} />
        <View style={styles.activityText}>
          <Text style={styles.activityLabel}>{activity.label}</Text>
          <Text style={styles.activityState}>
            {enabled ? t('activities.enabled') : t('activities.disabled')}
          </Text>
        </View>
      </View>
      <Switch
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        disabled={disabled}
        onValueChange={onToggle}
        thumbColor={enabled ? colors.primary : colors.surface}
        trackColor={{ false: colors.border, true: colors.forecastTrack }}
        value={enabled}
      />
    </Pressable>
  );
}

export function ProScreen() {
  const { t } = useTranslation();
  const settings = useAppStore((state) => state.settings);
  const loading = useAppStore((state) => state.loading);
  const billingMessage = useAppStore((state) => state.billingMessage);
  const entitlement = useAppStore((state) => state.entitlement);
  const billingState = useAppStore((state) => state.billingState);
  const developmentEntitlementOverride = useAppStore(
    (state) => state.developmentEntitlementOverride,
  );
  const updateSettings = useAppStore((state) => state.updateSettings);
  const setDevelopmentEntitlement = useAppStore((state) => state.setDevelopmentEntitlement);
  const purchaseProLifetime = useAppStore((state) => state.purchaseProLifetime);
  const restorePurchases = useAppStore((state) => state.restorePurchases);
  const refreshBilling = useAppStore((state) => state.refreshBilling);
  const capabilities = useCapabilities();
  const purchaseAvailable =
    billingState.billingStatus === 'ready' &&
    billingState.offering?.available === true &&
    billingState.offering.priceString !== null &&
    !billingState.proActive;
  const billingBusy = billingState.purchaseInProgress || billingState.restoreInProgress;
  const unlockTitle = billingState.offering?.priceString
    ? t('pro.unlockWithPrice', { price: billingState.offering.priceString })
    : t('pro.unlock');

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <SectionCard title={t('pro.title')}>
        <DevelopmentPreviewControls
          developmentEntitlementOverride={developmentEntitlementOverride}
          onSetDevelopmentEntitlement={setDevelopmentEntitlement}
          t={t}
        />
        <Text style={styles.headline}>{t('pro.headline')}</Text>
        <Text style={styles.body}>
          {billingState.proActive ? t('pro.active') : t('pro.unlockBody')}
        </Text>
        <ProOutcomeGroups t={t} />
        <Text style={styles.oneTime}>{t('pro.oneTime')}</Text>
        <ProBillingActions
          billingBusy={billingBusy}
          billingMessage={billingMessage}
          billingState={billingState}
          entitlement={entitlement}
          purchaseAvailable={purchaseAvailable}
          refreshBilling={refreshBilling}
          restorePurchases={restorePurchases}
          purchaseProLifetime={purchaseProLifetime}
          unlockTitle={unlockTitle}
          t={t}
        />
      </SectionCard>

      <SectionCard title={t('today.activities')} subtitle={t('pro.activitiesSubtitle')}>
        {!capabilities.activities.available ? (
          <Text style={styles.notice}>{t('pro.activitiesRequirePro')}</Text>
        ) : null}
        {activityDomains().map((activity) => {
          const enabled = settings.enabledActivities[activity.id] === true;
          const disabled = !capabilities.activities.available || loading;
          const toggleActivity = () => {
            if (disabled) return;

            updateSettings({
              enabledActivities: {
                ...settings.enabledActivities,
                [activity.id]: !enabled,
              },
            });
          };

          return (
            <ActivityToggleRow
              key={activity.id}
              activity={activity}
              disabled={disabled}
              enabled={enabled}
              onToggle={toggleActivity}
              t={t}
            />
          );
        })}
      </SectionCard>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  activityLabel: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '700',
  },
  activityIdentity: {
    alignItems: 'center',
    flex: 1,
    flexDirection: 'row',
    gap: spacing.sm,
    minWidth: 0,
  },
  activityRow: {
    alignItems: 'center',
    borderColor: colors.border,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: spacing.md,
    justifyContent: 'space-between',
    minHeight: 56,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  activityState: {
    color: colors.muted,
    fontSize: 13,
    marginTop: spacing.xs,
  },
  activityText: {
    flex: 1,
    minWidth: 0,
  },
  body: {
    color: colors.text,
    lineHeight: 20,
  },
  buttonRow: {
    gap: spacing.sm,
  },
  content: {
    padding: spacing.lg,
  },
  disabled: {
    opacity: 0.55,
  },
  headline: {
    color: colors.text,
    fontSize: 22,
    fontWeight: '800',
    lineHeight: 28,
  },
  notice: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 18,
  },
  oneTime: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '800',
    lineHeight: 20,
  },
  outcomeGroup: {
    gap: spacing.xs,
  },
  outcomeTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '800',
  },
  screen: {
    backgroundColor: colors.background,
  },
  pressed: {
    backgroundColor: colors.pressedSurface,
  },
  twoButtonRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
});

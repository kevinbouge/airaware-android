import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { featureDefinitions } from '../capabilities/features';
import { AppButton } from '../components/AppButton';
import { OptionButton } from '../components/OptionButton';
import { SectionCard } from '../components/SectionCard';
import { ActivityIcon } from '../components/icons/ActivityIcon';
import { activityDomains } from '../core/activityDefinitions';
import { useCapabilities } from '../hooks/useCapabilities';
import { useAppStore } from '../state/useAppStore';
import { colors, spacing } from '../theme/theme';

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
  const extendedForecastFeature = featureDefinitions(capabilities).find(
    (feature) => feature.id === 'extended_forecast',
  );
  const advancedWidgetFeature = featureDefinitions(capabilities).find(
    (feature) => feature.id === 'advanced_home_widget',
  );
  const activitiesFeature = featureDefinitions(capabilities).find(
    (feature) => feature.id === 'activities',
  );
  const proFeatures = [extendedForecastFeature, activitiesFeature, advancedWidgetFeature]
    .filter(Boolean)
    .map((feature) => feature!.displayName);
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
        {__DEV__ ? (
          <>
            <Text style={styles.body}>{t('pro.developmentPreview')}</Text>
            <View style={styles.buttonRow}>
              <OptionButton
                label={t('pro.useRevenueCat')}
                iconName="restore"
                selected={developmentEntitlementOverride === null}
                onPress={() => setDevelopmentEntitlement(null)}
              />
            </View>
            <View style={styles.twoButtonRow}>
              <OptionButton
                label={t('pro.previewFree')}
                iconName="profile"
                selected={developmentEntitlementOverride?.kind === 'free'}
                grow
                onPress={() => setDevelopmentEntitlement('free')}
              />
              <OptionButton
                label={t('pro.previewPro')}
                iconName="pro"
                selected={developmentEntitlementOverride?.kind === 'pro_lifetime'}
                grow
                onPress={() => setDevelopmentEntitlement('pro_lifetime')}
              />
            </View>
          </>
        ) : null}
        {billingState.proActive ? (
          <Text style={styles.body}>{t('pro.active')}</Text>
        ) : (
          <Text style={styles.body}>{t('pro.unlockBody')}</Text>
        )}
        <View style={styles.featureList}>
          {proFeatures.map((feature) => (
            <Text key={feature} style={styles.body}>
              - {feature}
            </Text>
          ))}
        </View>
        <Text style={styles.notice}>{t('pro.oneTime')}</Text>
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
            <Pressable
              key={activity.id}
              accessibilityLabel={t('activities.activityAccessibility', { label: activity.label })}
              accessibilityRole="switch"
              accessibilityState={{ checked: enabled, disabled }}
              disabled={disabled}
              onPress={toggleActivity}
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
                onValueChange={toggleActivity}
                thumbColor={enabled ? colors.primary : colors.surface}
                trackColor={{ false: colors.border, true: colors.forecastTrack }}
                value={enabled}
              />
            </Pressable>
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
  featureList: {
    gap: spacing.xs,
  },
  notice: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 18,
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

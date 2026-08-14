import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { featureDefinitions } from '../capabilities/features';
import { AppButton } from '../components/AppButton';
import { OptionButton } from '../components/OptionButton';
import { SectionCard } from '../components/SectionCard';
import { ACTIVITY_DOMAINS } from '../core/activityDefinitions';
import { useCapabilities } from '../hooks/useCapabilities';
import { useAppStore } from '../state/useAppStore';
import { colors, spacing } from '../theme/theme';

export function ProScreen() {
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
    ? `Unlock AirAware Pro — ${billingState.offering.priceString}`
    : 'Unlock AirAware Pro';

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <SectionCard title="AirAware Pro">
        {__DEV__ ? (
          <>
            <Text style={styles.body}>
              Development capability preview. This is ignored in production and does not change
              RevenueCat entitlement.
            </Text>
            <View style={styles.buttonRow}>
              <OptionButton
                label="Use RevenueCat"
                selected={developmentEntitlementOverride === null}
                onPress={() => setDevelopmentEntitlement(null)}
              />
            </View>
            <View style={styles.twoButtonRow}>
              <OptionButton
                label="Preview Free"
                selected={developmentEntitlementOverride?.kind === 'free'}
                grow
                onPress={() => setDevelopmentEntitlement('free')}
              />
              <OptionButton
                label="Preview Pro"
                selected={developmentEntitlementOverride?.kind === 'pro_lifetime'}
                grow
                onPress={() => setDevelopmentEntitlement('pro_lifetime')}
              />
            </View>
          </>
        ) : null}
        {billingState.proActive ? (
          <Text style={styles.body}>
            AirAware Pro active. Your lifetime Pro features are unlocked.
          </Text>
        ) : (
          <Text style={styles.body}>
            Unlock additional AirAware capabilities with one lifetime purchase.
          </Text>
        )}
        <View style={styles.featureList}>
          {proFeatures.map((feature) => (
            <Text key={feature} style={styles.body}>
              - {feature}
            </Text>
          ))}
        </View>
        <Text style={styles.notice}>One-time purchase. No subscription. No AirAware account.</Text>
        {billingState.billingStatus === 'unconfigured' ? (
          <Text style={styles.notice}>
            AirAware Pro purchasing is not configured in this build.
          </Text>
        ) : null}
        {billingState.billingStatus === 'unavailable' ? (
          <Text style={styles.notice}>
            AirAware Pro purchasing requires an Android development or release build.
          </Text>
        ) : null}
        {billingState.billingStatus === 'error' || billingState.billingStatus === 'offline' ? (
          <Text style={styles.notice}>AirAware Pro purchasing is currently unavailable.</Text>
        ) : null}
        {billingState.billingStatus === 'ready' && !billingState.proActive ? (
          <AppButton
            title={unlockTitle}
            fullWidth
            disabled={!purchaseAvailable || billingBusy}
            onPress={purchaseProLifetime}
          />
        ) : null}
        <AppButton
          title={billingState.restoreInProgress ? 'Restoring purchase...' : 'Restore purchase'}
          fullWidth
          disabled={billingState.billingStatus !== 'ready' || billingBusy}
          onPress={restorePurchases}
        />
        {billingState.billingStatus !== 'ready' ? (
          <AppButton title="Retry AirAware Pro" fullWidth onPress={refreshBilling} />
        ) : null}
        {billingMessage ? <Text style={styles.notice}>{billingMessage}</Text> : null}
        {!billingMessage && billingState.error ? (
          <Text style={styles.notice}>{billingState.error}</Text>
        ) : null}
        {__DEV__ ? (
          <Text style={styles.notice}>
            Effective entitlement: {entitlement.kind === 'pro_lifetime' ? 'Pro' : 'Free'} · source:{' '}
            {billingState.entitlementSource}
          </Text>
        ) : null}
      </SectionCard>

      <SectionCard
        title="Activities"
        subtitle="Professional environmental tools for agriculture, drone operations, photography, astronomy, and outdoor work."
      >
        {!capabilities.activities.available ? (
          <Text style={styles.notice}>Activities are available with AirAware Pro.</Text>
        ) : null}
        {ACTIVITY_DOMAINS.map((activity) => {
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
              accessibilityLabel={`${activity.label} activity`}
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
              <View style={styles.activityText}>
                <Text style={styles.activityLabel}>{activity.label}</Text>
                <Text style={styles.activityState}>{enabled ? 'Enabled' : 'Disabled'}</Text>
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

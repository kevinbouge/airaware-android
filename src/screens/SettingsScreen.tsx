import { Modal, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useState } from 'react';
import {
  featureDefinitions,
  featureStatusMessage,
  isFeatureAvailable,
} from '../capabilities/features';
import { AppButton } from '../components/AppButton';
import { LocationMapPicker } from '../components/LocationMapPicker';
import { SectionCard } from '../components/SectionCard';
import { googlePlayPrivacyDisclosureText } from '../core/googlePlayCompliance';
import { useCapabilities } from '../hooks/useCapabilities';
import { parseManualCoordinates } from '../services/locationService';
import { useAppStore } from '../state/useAppStore';
import { colors, spacing } from '../theme/theme';
import { formatMapCoordinate } from '../utils/mapTiles';

const DEFAULT_MAP_COORDINATES = {
  latitude: 50.0755,
  longitude: 14.4378,
};

function OptionButton({
  label,
  selected,
  disabled = false,
  grow = false,
  onPress,
}: {
  label: string;
  selected: boolean;
  disabled?: boolean;
  grow?: boolean;
  onPress: () => void;
}) {
  return (
    <View style={grow ? styles.growingOption : undefined}>
      <AppButton
        title={label}
        onPress={onPress}
        selected={selected}
        disabled={disabled}
        fullWidth
      />
    </View>
  );
}

export function SettingsScreen() {
  const [mapPickerVisible, setMapPickerVisible] = useState(false);
  const [mapPickerCoordinates, setMapPickerCoordinates] =
    useState<typeof DEFAULT_MAP_COORDINATES>(DEFAULT_MAP_COORDINATES);
  const settings = useAppStore((state) => state.settings);
  const loading = useAppStore((state) => state.loading);
  const profileEnabled = useAppStore((state) => state.profile.enabled);
  const notificationMessage = useAppStore((state) => state.notificationMessage);
  const notificationPermissionStatus = useAppStore((state) => state.notificationPermissionStatus);
  const entitlement = useAppStore((state) => state.entitlement);
  const location = useAppStore((state) => state.location);
  const environment = useAppStore((state) => state.environment);
  const updateSettings = useAppStore((state) => state.updateSettings);
  const setDevelopmentEntitlement = useAppStore((state) => state.setDevelopmentEntitlement);
  const sendTestRiskNotification = useAppStore((state) => state.sendTestRiskNotification);
  const openNotificationSettings = useAppStore((state) => state.openNotificationSettings);
  const capabilities = useCapabilities();
  const manualCoordinates =
    parseManualCoordinates(settings) ??
    location.coordinates ??
    environment?.coordinates ??
    DEFAULT_MAP_COORDINATES;
  const automaticLocationAvailable = isFeatureAvailable(capabilities, 'automatic_location');
  const manualLocationAvailable = isFeatureAvailable(capabilities, 'manual_location');
  const extendedForecastFeature = featureDefinitions(capabilities).find(
    (feature) => feature.id === 'extended_forecast',
  );
  const extendedEnvironmentalDataFeature = featureDefinitions(capabilities).find(
    (feature) => feature.id === 'extended_environmental_data',
  );
  const advancedWidgetFeature = featureDefinitions(capabilities).find(
    (feature) => feature.id === 'advanced_home_widget',
  );

  const updateManualCoordinates = (coordinates: typeof manualCoordinates) => {
    void updateSettings({
      locationMode: 'manual',
      manualLatitude: formatMapCoordinate(coordinates.latitude),
      manualLongitude: formatMapCoordinate(coordinates.longitude),
    });
  };

  const selectManualLocationMode = () => {
    updateManualCoordinates(manualCoordinates);
  };

  const openManualLocationPicker = () => {
    setMapPickerCoordinates(manualCoordinates);
    setMapPickerVisible(true);
  };

  const closeManualLocationPicker = () => {
    setMapPickerVisible(false);
  };

  const confirmManualLocation = () => {
    updateManualCoordinates(mapPickerCoordinates);
    setMapPickerVisible(false);
  };

  return (
    <>
      <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
        <SectionCard
          title="Location"
          subtitle="Use approximate device location or manual coordinates."
        >
          <View style={styles.twoButtonRow}>
            <OptionButton
              label="Automatic"
              selected={settings.locationMode === 'automatic'}
              disabled={!automaticLocationAvailable || loading}
              grow
              onPress={() => updateSettings({ locationMode: 'automatic' })}
            />
            <OptionButton
              label="Manual"
              selected={settings.locationMode === 'manual'}
              disabled={!manualLocationAvailable || loading}
              grow
              onPress={selectManualLocationMode}
            />
          </View>
          {loading ? <Text style={styles.notice}>Refreshing environmental data...</Text> : null}
          {settings.locationMode === 'manual' && manualLocationAvailable ? (
            <View style={styles.manualLocationPreview}>
              <Text style={styles.body}>Selected manual location</Text>
              <Text style={styles.coordinateText}>
                {formatMapCoordinate(manualCoordinates.latitude)},{' '}
                {formatMapCoordinate(manualCoordinates.longitude)}
              </Text>
              <AppButton
                title="Choose on map"
                fullWidth
                onPress={openManualLocationPicker}
                disabled={loading}
              />
            </View>
          ) : null}
        </SectionCard>

        <SectionCard
          title="Nearby vegetation"
          subtitle="OpenStreetMap vegetation context around the active location."
        >
          <View style={styles.buttonRow}>
            {[
              { label: '1 km', value: 1000 },
              { label: '2 km', value: 2000 },
              { label: '5 km', value: 5000 },
            ].map((option) => (
              <OptionButton
                key={option.value}
                label={option.label}
                selected={settings.nearbyVegetationRadiusMeters === option.value}
                onPress={() =>
                  updateSettings({
                    nearbyVegetationRadiusMeters: option.value as 1000 | 2000 | 5000,
                  })
                }
              />
            ))}
          </View>
        </SectionCard>

        <SectionCard title="Refresh">
          <View style={styles.buttonRow}>
            {[30, 60, 120].map((minutes) => (
              <OptionButton
                key={minutes}
                label={`${minutes} min`}
                selected={settings.refreshIntervalMinutes === minutes}
                onPress={() => updateSettings({ refreshIntervalMinutes: minutes as 30 | 60 | 120 })}
              />
            ))}
          </View>
        </SectionCard>

        <SectionCard title="Best outdoor window">
          <View style={styles.buttonRow}>
            {[1, 2, 3].map((hours) => (
              <OptionButton
                key={hours}
                label={`${hours} h`}
                selected={settings.outdoorWindowDurationHours === hours}
                onPress={() => updateSettings({ outdoorWindowDurationHours: hours as 1 | 2 | 3 })}
              />
            ))}
          </View>
        </SectionCard>

        <SectionCard title="Headline score">
          <View style={styles.twoButtonRow}>
            <OptionButton
              label="Environmental"
              selected={settings.headlineScore === 'environmental'}
              grow
              onPress={() => updateSettings({ headlineScore: 'environmental' })}
            />
            <OptionButton
              label="Personalized"
              selected={settings.headlineScore === 'personalized'}
              disabled={!profileEnabled}
              grow
              onPress={() => updateSettings({ headlineScore: 'personalized' })}
            />
          </View>
        </SectionCard>

        <SectionCard title="Forecast score">
          <View style={styles.twoButtonRow}>
            <OptionButton
              label="Environmental"
              selected={settings.forecastScore === 'environmental'}
              grow
              onPress={() => updateSettings({ forecastScore: 'environmental' })}
            />
            <OptionButton
              label="Personalized"
              selected={settings.forecastScore === 'personalized'}
              disabled={!profileEnabled}
              grow
              onPress={() => updateSettings({ forecastScore: 'personalized' })}
            />
          </View>
        </SectionCard>

        <SectionCard
          title="Notifications"
          subtitle="Risk transition notifications are evaluated during app refreshes."
        >
          <Text style={styles.body}>
            AirAware can notify you when the selected headline score enters a high category. This
            uses environmental conditions only and does not predict symptoms.
          </Text>
          <View style={styles.twoButtonRow}>
            <OptionButton
              label="Disabled"
              selected={!settings.riskTransitionNotificationsEnabled}
              grow
              onPress={() => updateSettings({ riskTransitionNotificationsEnabled: false })}
            />
            <OptionButton
              label="Enabled"
              selected={settings.riskTransitionNotificationsEnabled}
              grow
              onPress={() => updateSettings({ riskTransitionNotificationsEnabled: true })}
            />
          </View>
          <View style={styles.twoButtonRow}>
            <OptionButton
              label="High + Very High"
              selected={settings.riskTransitionNotificationThreshold === 'highAndVeryHigh'}
              disabled={!settings.riskTransitionNotificationsEnabled}
              grow
              onPress={() =>
                updateSettings({ riskTransitionNotificationThreshold: 'highAndVeryHigh' })
              }
            />
            <OptionButton
              label="Very High only"
              selected={settings.riskTransitionNotificationThreshold === 'veryHighOnly'}
              disabled={!settings.riskTransitionNotificationsEnabled}
              grow
              onPress={() =>
                updateSettings({ riskTransitionNotificationThreshold: 'veryHighOnly' })
              }
            />
          </View>
          {notificationMessage ? <Text style={styles.notice}>{notificationMessage}</Text> : null}
          {notificationPermissionStatus === 'granted' &&
          settings.riskTransitionNotificationsEnabled ? (
            <Text style={styles.notice}>Notification permission is enabled.</Text>
          ) : null}
          <AppButton
            title="Send test notification"
            fullWidth
            onPress={sendTestRiskNotification}
            disabled={notificationPermissionStatus !== 'granted'}
          />
          <View style={styles.buttonRow}>
            {notificationPermissionStatus === 'denied' ||
            (settings.riskTransitionNotificationsEnabled &&
              notificationPermissionStatus !== 'granted') ? (
              <OptionButton
                label="Open Android settings"
                selected={false}
                onPress={openNotificationSettings}
              />
            ) : null}
          </View>
        </SectionCard>

        <SectionCard title="Daily summary">
          <View style={styles.twoButtonRow}>
            <OptionButton
              label="Environmental"
              selected={settings.summaryScore === 'environmental'}
              grow
              onPress={() => updateSettings({ summaryScore: 'environmental' })}
            />
            <OptionButton
              label="Personalized"
              selected={settings.summaryScore === 'personalized'}
              disabled={!profileEnabled}
              grow
              onPress={() => updateSettings({ summaryScore: 'personalized' })}
            />
          </View>
          <View style={styles.twoButtonRow}>
            <OptionButton
              label="Place name"
              selected={settings.summaryLocation === 'place'}
              grow
              onPress={() => updateSettings({ summaryLocation: 'place' })}
            />
            <OptionButton
              label="Hide location"
              selected={settings.summaryLocation === 'hidden'}
              grow
              onPress={() => updateSettings({ summaryLocation: 'hidden' })}
            />
          </View>
        </SectionCard>

        <SectionCard title="AirAware Pro">
          {__DEV__ ? (
            <>
              <Text style={styles.body}>
                Development entitlement override. This is ignored in production builds.
              </Text>
              <View style={styles.twoButtonRow}>
                <OptionButton
                  label="Free"
                  selected={entitlement.kind === 'free'}
                  grow
                  onPress={() => setDevelopmentEntitlement('free')}
                />
                <OptionButton
                  label="Pro"
                  selected={entitlement.kind === 'pro_lifetime'}
                  grow
                  onPress={() => setDevelopmentEntitlement('pro_lifetime')}
                />
              </View>
            </>
          ) : null}
          <Text style={styles.body}>
            {extendedForecastFeature
              ? featureStatusMessage(extendedForecastFeature)
              : 'AirAware Pro purchasing is not available in this build.'}
          </Text>
          <Text style={styles.body}>
            {extendedEnvironmentalDataFeature
              ? featureStatusMessage(extendedEnvironmentalDataFeature)
              : 'Advanced Environmental Data is not available in this build.'}
          </Text>
          <Text style={styles.body}>
            {advancedWidgetFeature
              ? featureStatusMessage(advancedWidgetFeature)
              : 'Advanced home-screen widget is not available in this build.'}
          </Text>
        </SectionCard>

        <SectionCard title="Privacy">
          <Text style={styles.body}>{googlePlayPrivacyDisclosureText()}</Text>
        </SectionCard>
      </ScrollView>

      <Modal
        animationType="slide"
        onRequestClose={closeManualLocationPicker}
        visible={mapPickerVisible}
      >
        <SafeAreaView style={styles.mapModal}>
          <View style={styles.mapModalHeader}>
            <View style={styles.mapModalTitleGroup}>
              <Text style={styles.mapModalTitle}>Choose manual location</Text>
              <Text style={styles.mapModalCoordinates}>
                {formatMapCoordinate(mapPickerCoordinates.latitude)},{' '}
                {formatMapCoordinate(mapPickerCoordinates.longitude)}
              </Text>
            </View>
          </View>
          <View style={styles.mapModalBody}>
            <LocationMapPicker
              coordinates={mapPickerCoordinates}
              onSelect={setMapPickerCoordinates}
            />
          </View>
          <View style={styles.mapModalActions}>
            <OptionButton
              label="Cancel"
              selected={false}
              grow
              onPress={closeManualLocationPicker}
            />
            <OptionButton
              label="Use this location"
              selected={false}
              grow
              onPress={confirmManualLocation}
            />
          </View>
        </SafeAreaView>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
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
  notice: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 18,
  },
  screen: {
    backgroundColor: colors.background,
  },
  growingOption: {
    flex: 1,
  },
  coordinateText: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '700',
  },
  manualLocationPreview: {
    gap: spacing.sm,
  },
  mapModal: {
    backgroundColor: colors.background,
    flex: 1,
  },
  mapModalActions: {
    flexDirection: 'row',
    gap: spacing.sm,
    padding: spacing.lg,
    paddingTop: 0,
  },
  mapModalBody: {
    flex: 1,
    justifyContent: 'center',
    padding: spacing.lg,
  },
  mapModalCoordinates: {
    color: colors.muted,
    fontSize: 14,
  },
  mapModalHeader: {
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    padding: spacing.lg,
  },
  mapModalTitle: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '800',
  },
  mapModalTitleGroup: {
    gap: spacing.xs,
  },
  twoButtonRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
});

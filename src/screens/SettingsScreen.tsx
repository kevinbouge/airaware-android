import { ScrollView, StyleSheet, Text, View } from 'react-native';
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
  onPress,
}: {
  label: string;
  selected: boolean;
  disabled?: boolean;
  onPress: () => void;
}) {
  return (
    <AppButton title={label} onPress={onPress} selected={selected} disabled={disabled} fullWidth />
  );
}

export function SettingsScreen() {
  const settings = useAppStore((state) => state.settings);
  const profileEnabled = useAppStore((state) => state.profile.enabled);
  const notificationMessage = useAppStore((state) => state.notificationMessage);
  const notificationPermissionStatus = useAppStore((state) => state.notificationPermissionStatus);
  const location = useAppStore((state) => state.location);
  const environment = useAppStore((state) => state.environment);
  const refresh = useAppStore((state) => state.refresh);
  const updateSettings = useAppStore((state) => state.updateSettings);
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

  const updateManualCoordinates = (coordinates: typeof manualCoordinates) => {
    void updateSettings({
      locationMode: 'manual',
      manualLatitude: formatMapCoordinate(coordinates.latitude),
      manualLongitude: formatMapCoordinate(coordinates.longitude),
    }).then(refresh);
  };

  const selectManualLocationMode = () => {
    updateManualCoordinates(manualCoordinates);
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <SectionCard
        title="Location"
        subtitle="Use approximate device location or manual coordinates."
      >
        <View style={styles.buttonRow}>
          <OptionButton
            label="Automatic"
            selected={settings.locationMode === 'automatic'}
            disabled={!automaticLocationAvailable}
            onPress={() => updateSettings({ locationMode: 'automatic' })}
          />
          <OptionButton
            label="Manual"
            selected={settings.locationMode === 'manual'}
            disabled={!manualLocationAvailable}
            onPress={selectManualLocationMode}
          />
        </View>
        {settings.locationMode === 'manual' && manualLocationAvailable ? (
          <LocationMapPicker coordinates={manualCoordinates} onSelect={updateManualCoordinates} />
        ) : null}
      </SectionCard>

      <SectionCard title="Refresh">
        <View style={styles.buttonRow}>
          {[60, 120, 240, 360].map((minutes) => (
            <OptionButton
              key={minutes}
              label={`${minutes} min`}
              selected={settings.refreshIntervalMinutes === minutes}
              onPress={() =>
                updateSettings({ refreshIntervalMinutes: minutes as 60 | 120 | 240 | 360 })
              }
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
        <View style={styles.buttonRow}>
          <OptionButton
            label="Environmental"
            selected={settings.headlineScore === 'environmental'}
            onPress={() => updateSettings({ headlineScore: 'environmental' })}
          />
          <OptionButton
            label="Personalized"
            selected={settings.headlineScore === 'personalized'}
            disabled={!profileEnabled}
            onPress={() => updateSettings({ headlineScore: 'personalized' })}
          />
        </View>
      </SectionCard>

      <SectionCard title="Forecast score">
        <View style={styles.buttonRow}>
          <OptionButton
            label="Environmental"
            selected={settings.forecastScore === 'environmental'}
            onPress={() => updateSettings({ forecastScore: 'environmental' })}
          />
          <OptionButton
            label="Personalized"
            selected={settings.forecastScore === 'personalized'}
            disabled={!profileEnabled}
            onPress={() => updateSettings({ forecastScore: 'personalized' })}
          />
        </View>
      </SectionCard>

      <SectionCard
        title="Notifications"
        subtitle="Risk transition notifications are evaluated during app refreshes."
      >
        <Text style={styles.body}>
          AirAware can notify you when the selected headline score enters a high category. This uses
          environmental conditions only and does not predict symptoms.
        </Text>
        <View style={styles.buttonRow}>
          <OptionButton
            label="Disabled"
            selected={!settings.riskTransitionNotificationsEnabled}
            onPress={() => updateSettings({ riskTransitionNotificationsEnabled: false })}
          />
          <OptionButton
            label="Enabled"
            selected={settings.riskTransitionNotificationsEnabled}
            onPress={() => updateSettings({ riskTransitionNotificationsEnabled: true })}
          />
        </View>
        <View style={styles.buttonRow}>
          <OptionButton
            label="High + Very High"
            selected={settings.riskTransitionNotificationThreshold === 'highAndVeryHigh'}
            disabled={!settings.riskTransitionNotificationsEnabled}
            onPress={() =>
              updateSettings({ riskTransitionNotificationThreshold: 'highAndVeryHigh' })
            }
          />
          <OptionButton
            label="Very High only"
            selected={settings.riskTransitionNotificationThreshold === 'veryHighOnly'}
            disabled={!settings.riskTransitionNotificationsEnabled}
            onPress={() => updateSettings({ riskTransitionNotificationThreshold: 'veryHighOnly' })}
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
        <View style={styles.buttonRow}>
          <OptionButton
            label="Environmental"
            selected={settings.summaryScore === 'environmental'}
            onPress={() => updateSettings({ summaryScore: 'environmental' })}
          />
          <OptionButton
            label="Personalized"
            selected={settings.summaryScore === 'personalized'}
            disabled={!profileEnabled}
            onPress={() => updateSettings({ summaryScore: 'personalized' })}
          />
        </View>
        <View style={styles.buttonRow}>
          <OptionButton
            label="Place name"
            selected={settings.summaryLocation === 'place'}
            onPress={() => updateSettings({ summaryLocation: 'place' })}
          />
          <OptionButton
            label="Hide location"
            selected={settings.summaryLocation === 'hidden'}
            onPress={() => updateSettings({ summaryLocation: 'hidden' })}
          />
        </View>
      </SectionCard>

      <SectionCard title="AirAware Pro">
        <Text style={styles.body}>
          {extendedForecastFeature
            ? featureStatusMessage(extendedForecastFeature)
            : 'AirAware Pro purchasing is not available in this build.'}
        </Text>
        <Text style={styles.body}>
          {extendedEnvironmentalDataFeature
            ? featureStatusMessage(extendedEnvironmentalDataFeature)
            : 'Extended Environmental Data is not available in this build.'}
        </Text>
      </SectionCard>

      <SectionCard title="Privacy">
        <Text style={styles.body}>{googlePlayPrivacyDisclosureText()}</Text>
      </SectionCard>
    </ScrollView>
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
});

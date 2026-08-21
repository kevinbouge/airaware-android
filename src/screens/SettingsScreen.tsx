import { Modal, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useState } from 'react';
import { isFeatureAvailable } from '../capabilities/features';
import { AppButton } from '../components/AppButton';
import { LocationMapPicker } from '../components/LocationMapPicker';
import { OptionButton } from '../components/OptionButton';
import { SectionCard } from '../components/SectionCard';
import { appDisclaimerText } from '../core/appDisclaimers';
import { googlePlayPrivacyDisclosureText } from '../core/googlePlayCompliance';
import { useCapabilities } from '../hooks/useCapabilities';
import { CURRENT_LOCATION_ID, coordinatesForSavedLocation } from '../models/location';
import { useAppStore } from '../state/useAppStore';
import { colors, spacing } from '../theme/theme';
import { formatMapCoordinate } from '../utils/mapTiles';

const DEFAULT_MAP_COORDINATES = {
  latitude: 50.0755,
  longitude: 14.4378,
};

export function SettingsScreen() {
  const [mapPickerVisible, setMapPickerVisible] = useState(false);
  const [mapPickerMode, setMapPickerMode] = useState<
    { type: 'add' } | { type: 'edit'; id: string }
  >({ type: 'add' });
  const [mapPickerCoordinates, setMapPickerCoordinates] =
    useState<typeof DEFAULT_MAP_COORDINATES>(DEFAULT_MAP_COORDINATES);
  const [newLocationName, setNewLocationName] = useState('');
  const [draftNames, setDraftNames] = useState<Record<string, string>>({});
  const settings = useAppStore((state) => state.settings);
  const loading = useAppStore((state) => state.loading);
  const profileEnabled = useAppStore((state) => state.profile.enabled);
  const notificationMessage = useAppStore((state) => state.notificationMessage);
  const notificationPermissionStatus = useAppStore((state) => state.notificationPermissionStatus);
  const location = useAppStore((state) => state.location);
  const environment = useAppStore((state) => state.environment);
  const updateSettings = useAppStore((state) => state.updateSettings);
  const setActiveLocation = useAppStore((state) => state.setActiveLocation);
  const addSavedLocation = useAppStore((state) => state.addSavedLocation);
  const renameSavedLocation = useAppStore((state) => state.renameSavedLocation);
  const updateSavedLocationCoordinates = useAppStore(
    (state) => state.updateSavedLocationCoordinates,
  );
  const deleteSavedLocation = useAppStore((state) => state.deleteSavedLocation);
  const sendTestRiskNotification = useAppStore((state) => state.sendTestRiskNotification);
  const openNotificationSettings = useAppStore((state) => state.openNotificationSettings);
  const capabilities = useCapabilities();
  const automaticLocationAvailable = isFeatureAvailable(capabilities, 'automatic_location');
  const manualLocationAvailable = isFeatureAvailable(capabilities, 'manual_location');
  const manualLocationCount = settings.locations.filter((item) => item.type === 'manual').length;
  const manualLocationLimitReached =
    manualLocationCount >= capabilities.locations.maxSavedLocations;
  const fallbackMapCoordinates =
    location.coordinates ?? environment?.coordinates ?? DEFAULT_MAP_COORDINATES;

  const openAddLocationPicker = () => {
    setMapPickerMode({ type: 'add' });
    setNewLocationName('');
    setMapPickerCoordinates(fallbackMapCoordinates);
    setMapPickerVisible(true);
  };

  const openEditLocationPicker = (id: string, coordinates: typeof DEFAULT_MAP_COORDINATES) => {
    setMapPickerMode({ type: 'edit', id });
    setMapPickerCoordinates(coordinates);
    setMapPickerVisible(true);
  };

  const closeManualLocationPicker = () => {
    setMapPickerVisible(false);
  };

  const confirmManualLocation = () => {
    if (mapPickerMode.type === 'add') {
      void addSavedLocation(mapPickerCoordinates, newLocationName);
    } else {
      void updateSavedLocationCoordinates(mapPickerMode.id, mapPickerCoordinates);
    }
    setMapPickerVisible(false);
  };

  return (
    <>
      <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
        <SectionCard title="Locations" subtitle="Choose the active location for AirAware data.">
          {settings.locations.map((savedLocation) => {
            const selected = savedLocation.id === settings.activeLocationId;
            const coordinates = coordinatesForSavedLocation(savedLocation);
            const draftName = draftNames[savedLocation.id] ?? savedLocation.name;

            return (
              <View key={savedLocation.id} style={styles.locationRow}>
                <View style={styles.locationHeader}>
                  <View style={styles.locationTitleGroup}>
                    <Text style={styles.locationName}>{savedLocation.name}</Text>
                    <Text style={styles.notice}>
                      {savedLocation.type === 'current'
                        ? 'Uses approximate foreground location'
                        : `${formatMapCoordinate(savedLocation.latitude)}, ${formatMapCoordinate(
                            savedLocation.longitude,
                          )}`}
                    </Text>
                  </View>
                  <Text style={[styles.locationStatus, selected ? styles.activeStatus : null]}>
                    {selected ? 'Active' : 'Saved'}
                  </Text>
                </View>
                <AppButton
                  title={selected ? 'Active location' : 'Use this location'}
                  selected={selected}
                  disabled={
                    selected ||
                    (savedLocation.id === CURRENT_LOCATION_ID && !automaticLocationAvailable)
                  }
                  fullWidth
                  onPress={() => setActiveLocation(savedLocation.id)}
                />
                {savedLocation.type === 'manual' ? (
                  <View style={styles.manualLocationActions}>
                    <TextInput
                      accessibilityLabel={`Rename ${savedLocation.name}`}
                      autoCapitalize="words"
                      onChangeText={(value) =>
                        setDraftNames((current) => ({ ...current, [savedLocation.id]: value }))
                      }
                      placeholder="Location name"
                      placeholderTextColor={colors.muted}
                      style={styles.input}
                      value={draftName}
                    />
                    <View style={styles.twoButtonRow}>
                      <OptionButton
                        label="Rename"
                        selected={false}
                        disabled={loading || draftName.trim().length === 0}
                        grow
                        onPress={() => renameSavedLocation(savedLocation.id, draftName)}
                      />
                      <OptionButton
                        label="Edit map"
                        selected={false}
                        disabled={loading || coordinates === null}
                        grow
                        onPress={() =>
                          coordinates
                            ? openEditLocationPicker(savedLocation.id, coordinates)
                            : undefined
                        }
                      />
                    </View>
                    <AppButton
                      title="Delete location"
                      disabled={loading}
                      fullWidth
                      onPress={() => deleteSavedLocation(savedLocation.id)}
                    />
                  </View>
                ) : null}
              </View>
            );
          })}
          {loading ? <Text style={styles.notice}>Refreshing environmental data...</Text> : null}
          {manualLocationLimitReached ? (
            <Text style={styles.notice}>
              Saved location limit reached ({capabilities.locations.maxSavedLocations}).
            </Text>
          ) : null}
          {manualLocationAvailable ? (
            <AppButton
              title="Add saved location"
              fullWidth
              onPress={openAddLocationPicker}
              disabled={loading || manualLocationLimitReached}
            />
          ) : null}
        </SectionCard>

        <SectionCard
          title="Notifications"
          subtitle="Risk transition notifications are evaluated during app refreshes."
        >
          <Text style={styles.body}>
            AirAware can notify you when the active headline score enters a high category.
            Personalized risk is used when available; otherwise Environmental burden is used.
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

        <SectionCard title="Disclaimers">
          <Text style={styles.body}>{appDisclaimerText()}</Text>
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
              <Text style={styles.mapModalTitle}>
                {mapPickerMode.type === 'add' ? 'Add saved location' : 'Edit saved location'}
              </Text>
              <Text style={styles.mapModalCoordinates}>
                {formatMapCoordinate(mapPickerCoordinates.latitude)},{' '}
                {formatMapCoordinate(mapPickerCoordinates.longitude)}
              </Text>
            </View>
          </View>
          <View style={styles.mapModalBody}>
            {mapPickerMode.type === 'add' ? (
              <TextInput
                accessibilityLabel="Saved location name"
                autoCapitalize="words"
                onChangeText={setNewLocationName}
                placeholder="Name, such as Home or Work"
                placeholderTextColor={colors.muted}
                style={styles.input}
                value={newLocationName}
              />
            ) : null}
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
  activeStatus: {
    color: colors.primary,
  },
  input: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 10,
    borderWidth: 1,
    color: colors.text,
    fontSize: 15,
    minHeight: 48,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  locationHeader: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: spacing.md,
    justifyContent: 'space-between',
  },
  locationName: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '700',
  },
  locationRow: {
    borderBottomColor: colors.border,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: spacing.sm,
    paddingBottom: spacing.md,
  },
  locationStatus: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: '700',
  },
  locationTitleGroup: {
    flex: 1,
    gap: spacing.xs,
  },
  manualLocationActions: {
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

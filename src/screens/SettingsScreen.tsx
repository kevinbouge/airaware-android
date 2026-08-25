import {
  Alert,
  Modal,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { isFeatureAvailable } from '../capabilities/features';
import { AppButton } from '../components/AppButton';
import { LocationMapPicker } from '../components/LocationMapPicker';
import { OptionButton } from '../components/OptionButton';
import { SectionCard } from '../components/SectionCard';
import { AppIcon } from '../components/icons/AppIcon';
import { useCapabilities } from '../hooks/useCapabilities';
import type { EnvironmentalEventNotificationSettings } from '../models/environmentalEvents';
import {
  CURRENT_LOCATION_ID,
  type SavedLocation,
  type ManualSavedLocation,
} from '../models/location';
import { useAppStore } from '../state/useAppStore';
import { colors, spacing } from '../theme/theme';
import { formatMapCoordinate } from '../utils/mapTiles';
import type { LanguagePreference } from '../i18n/types';

const DEFAULT_MAP_COORDINATES = {
  latitude: 50.0755,
  longitude: 14.4378,
};

const ENVIRONMENTAL_ALERT_OPTIONS: {
  id: keyof EnvironmentalEventNotificationSettings;
  labelKey: string;
}[] = [
  { id: 'pollen', labelKey: 'environment.pollen.generic' },
  { id: 'airPollution', labelKey: 'environment.pollutants.regulated' },
  { id: 'saharanDust', labelKey: 'environment.irritants.dust' },
  { id: 'wildfirePollution', labelKey: 'events.titles.wildfirePollution' },
  { id: 'uv', labelKey: 'environment.uvIndex' },
  { id: 'mold', labelKey: 'environment.moldPotential' },
  { id: 'headlineRisk', labelKey: 'risk.environmentalBurden' },
];

const LANGUAGE_OPTIONS: { id: LanguagePreference; labelKey: string }[] = [
  { id: 'system', labelKey: 'language.system' },
  { id: 'en', labelKey: 'language.english' },
  { id: 'fr', labelKey: 'language.french' },
];

function savedLocationLabel(location: SavedLocation, t: (key: string) => string): string {
  if (location.id === CURRENT_LOCATION_ID) return t('settings.locations.currentLocation');
  return location.name;
}

interface SettingsSwitchRowProps {
  label: string;
  value: boolean;
  disabled?: boolean;
  description?: string | undefined;
  onValueChange: (value: boolean) => void;
}

function SettingsSwitchRow({
  label,
  value,
  disabled = false,
  description,
  onValueChange,
}: SettingsSwitchRowProps) {
  return (
    <View style={[styles.switchRow, disabled ? styles.disabled : null]}>
      <View style={styles.switchCopy}>
        <Text style={styles.switchLabel}>{label}</Text>
        {description ? <Text style={styles.notice}>{description}</Text> : null}
      </View>
      <Switch
        accessibilityLabel={label}
        accessibilityState={{ checked: value, disabled }}
        disabled={disabled}
        onValueChange={onValueChange}
        thumbColor={value ? colors.primary : colors.surface}
        trackColor={{ false: colors.border, true: colors.forecastTrack }}
        value={value}
      />
    </View>
  );
}

function isManualLocation(location: SavedLocation): location is ManualSavedLocation {
  return location.type === 'manual';
}

export function SettingsScreen() {
  const { t } = useTranslation();
  const [mapPickerVisible, setMapPickerVisible] = useState(false);
  const [managedLocationId, setManagedLocationId] = useState<string | null>(null);
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
  const advancedEnvironmentalAlertsAvailable = isFeatureAvailable(
    capabilities,
    'advanced_environment_notifications',
  );
  const environmentalAlertsEnabled = Object.values(settings.environmentalEventNotifications).some(
    (enabled) => enabled,
  );
  const notificationsEnabled =
    settings.riskTransitionNotificationsEnabled || environmentalAlertsEnabled;
  const fallbackMapCoordinates =
    location.coordinates ?? environment?.coordinates ?? DEFAULT_MAP_COORDINATES;
  const managedLocation =
    settings.locations.find(
      (savedLocation): savedLocation is ManualSavedLocation =>
        savedLocation.id === managedLocationId && isManualLocation(savedLocation),
    ) ?? null;

  const openAddLocationPicker = () => {
    setMapPickerMode({ type: 'add' });
    setNewLocationName('');
    setMapPickerCoordinates(fallbackMapCoordinates);
    setMapPickerVisible(true);
  };

  const openEditLocationPicker = (id: string, coordinates: typeof DEFAULT_MAP_COORDINATES) => {
    setManagedLocationId(null);
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

  const toggleEnvironmentalAlert = (id: keyof EnvironmentalEventNotificationSettings) => {
    void updateSettings({
      environmentalEventNotifications: {
        ...settings.environmentalEventNotifications,
        [id]: !settings.environmentalEventNotifications[id],
      },
    });
  };

  const requestDeleteLocation = (savedLocation: ManualSavedLocation) => {
    Alert.alert(
      t('settings.locations.deleteTitle'),
      t('settings.locations.deleteBody', { name: savedLocation.name }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.delete'),
          style: 'destructive',
          onPress: () => {
            void deleteSavedLocation(savedLocation.id);
            setManagedLocationId(null);
          },
        },
      ],
    );
  };

  return (
    <>
      <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
        <SectionCard
          title={t('settings.language.title')}
          subtitle={t('settings.language.subtitle')}
        >
          <View style={styles.buttonRow}>
            {LANGUAGE_OPTIONS.map((option) => (
              <OptionButton
                key={option.id}
                label={t(option.labelKey)}
                selected={settings.languagePreference === option.id}
                onPress={() => updateSettings({ languagePreference: option.id })}
              />
            ))}
          </View>
        </SectionCard>

        <SectionCard
          title={t('settings.locations.title')}
          subtitle={t('settings.locations.subtitle')}
        >
          {settings.locations.map((savedLocation) => {
            const selected = savedLocation.id === settings.activeLocationId;

            return (
              <View key={savedLocation.id} style={styles.locationRow}>
                <View style={styles.locationHeader}>
                  <View style={styles.locationTitleGroup}>
                    <View style={styles.locationNameRow}>
                      <AppIcon
                        name={savedLocation.type === 'current' ? 'current-location' : 'location'}
                        size="inline"
                        color={colors.primary}
                      />
                      <Text style={styles.locationName}>
                        {savedLocationLabel(savedLocation, t)}
                      </Text>
                    </View>
                    <Text style={styles.notice}>
                      {savedLocation.type === 'current'
                        ? t('settings.locations.approximate')
                        : `${formatMapCoordinate(savedLocation.latitude)}, ${formatMapCoordinate(
                            savedLocation.longitude,
                          )}`}
                    </Text>
                  </View>
                  <Text style={[styles.locationStatus, selected ? styles.activeStatus : null]}>
                    {selected ? t('common.active') : t('common.saved')}
                  </Text>
                </View>
                <AppButton
                  title={
                    selected
                      ? t('settings.locations.activeLocation')
                      : t('settings.locations.useLocation')
                  }
                  iconName={savedLocation.type === 'current' ? 'current-location' : 'location'}
                  selected={selected}
                  disabled={
                    selected ||
                    (savedLocation.id === CURRENT_LOCATION_ID && !automaticLocationAvailable)
                  }
                  fullWidth
                  onPress={() => setActiveLocation(savedLocation.id)}
                />
                {savedLocation.type === 'manual' ? (
                  <AppButton
                    title={t('settings.locations.manage')}
                    iconName="settings"
                    fullWidth
                    disabled={loading}
                    onPress={() => setManagedLocationId(savedLocation.id)}
                  />
                ) : null}
              </View>
            );
          })}
          {loading ? <Text style={styles.notice}>{t('settings.locations.refreshing')}</Text> : null}
          {manualLocationLimitReached ? (
            <Text style={styles.notice}>
              {t('settings.locations.limitReached', {
                count: capabilities.locations.maxSavedLocations,
              })}
            </Text>
          ) : null}
          {manualLocationAvailable ? (
            <AppButton
              title={t('settings.locations.add')}
              iconName="add"
              fullWidth
              onPress={openAddLocationPicker}
              disabled={loading || manualLocationLimitReached}
            />
          ) : null}
        </SectionCard>

        <SectionCard
          title={t('settings.notifications.title')}
          subtitle={t('settings.notifications.subtitle')}
        >
          <Text style={styles.body}>{t('settings.notifications.body')}</Text>
          <SettingsSwitchRow
            label={t('settings.notifications.riskTransitions')}
            value={settings.riskTransitionNotificationsEnabled}
            onValueChange={(enabled) =>
              updateSettings({ riskTransitionNotificationsEnabled: enabled })
            }
          />
          <View style={styles.twoButtonRow}>
            <OptionButton
              label={t('settings.notifications.highAndVeryHigh')}
              selected={settings.riskTransitionNotificationThreshold === 'highAndVeryHigh'}
              disabled={!settings.riskTransitionNotificationsEnabled}
              grow
              onPress={() =>
                updateSettings({ riskTransitionNotificationThreshold: 'highAndVeryHigh' })
              }
            />
            <OptionButton
              label={t('settings.notifications.veryHighOnly')}
              selected={settings.riskTransitionNotificationThreshold === 'veryHighOnly'}
              disabled={!settings.riskTransitionNotificationsEnabled}
              grow
              onPress={() =>
                updateSettings({ riskTransitionNotificationThreshold: 'veryHighOnly' })
              }
            />
          </View>
          {notificationMessage ? <Text style={styles.notice}>{notificationMessage}</Text> : null}
          {notificationPermissionStatus === 'granted' && notificationsEnabled ? (
            <Text style={styles.notice}>{t('settings.notifications.permissionEnabled')}</Text>
          ) : null}
          <AppButton
            title={t('settings.notifications.test')}
            iconName="notifications"
            fullWidth
            onPress={sendTestRiskNotification}
            disabled={notificationPermissionStatus !== 'granted'}
          />
          <View style={styles.buttonRow}>
            {notificationPermissionStatus === 'denied' ||
            (notificationsEnabled && notificationPermissionStatus !== 'granted') ? (
              <OptionButton
                label={t('settings.notifications.openAndroidSettings')}
                iconName="settings"
                selected={false}
                onPress={openNotificationSettings}
              />
            ) : null}
          </View>
          <View style={styles.notificationDivider} />
          <Text style={styles.sectionLabel}>{t('settings.notifications.environmentalAlerts')}</Text>
          <Text style={styles.notice}>{t('settings.notifications.environmentalAlertsBody')}</Text>
          {!advancedEnvironmentalAlertsAvailable ? (
            <Text style={styles.notice}>{t('settings.notifications.environmentalAlertsPro')}</Text>
          ) : null}
          <View style={styles.buttonRow}>
            {ENVIRONMENTAL_ALERT_OPTIONS.map((option) => (
              <SettingsSwitchRow
                key={option.id}
                label={t(option.labelKey)}
                value={
                  advancedEnvironmentalAlertsAvailable &&
                  settings.environmentalEventNotifications[option.id]
                }
                disabled={!advancedEnvironmentalAlertsAvailable}
                onValueChange={() => toggleEnvironmentalAlert(option.id)}
              />
            ))}
          </View>
        </SectionCard>

        <SectionCard title={t('settings.summary.title')}>
          <View style={styles.twoButtonRow}>
            <OptionButton
              label={t('settings.summary.environmental')}
              iconName="generic"
              selected={settings.summaryScore === 'environmental'}
              grow
              onPress={() => updateSettings({ summaryScore: 'environmental' })}
            />
            <OptionButton
              label={t('settings.summary.personalized')}
              iconName="profile"
              selected={settings.summaryScore === 'personalized'}
              disabled={!profileEnabled}
              grow
              onPress={() => updateSettings({ summaryScore: 'personalized' })}
            />
          </View>
          <View style={styles.twoButtonRow}>
            <OptionButton
              label={t('settings.summary.placeName')}
              iconName="location"
              selected={settings.summaryLocation === 'place'}
              grow
              onPress={() => updateSettings({ summaryLocation: 'place' })}
            />
            <OptionButton
              label={t('settings.summary.hideLocation')}
              iconName="privacy"
              selected={settings.summaryLocation === 'hidden'}
              grow
              onPress={() => updateSettings({ summaryLocation: 'hidden' })}
            />
          </View>
        </SectionCard>

        <SectionCard title={t('settings.disclaimers')}>
          <Text style={styles.body}>{t('settings.disclaimerText')}</Text>
        </SectionCard>

        <SectionCard title={t('settings.privacy')}>
          <Text style={styles.body}>{t('settings.privacyText')}</Text>
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
                {mapPickerMode.type === 'add'
                  ? t('settings.locations.addTitle')
                  : t('settings.locations.editTitle')}
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
                accessibilityLabel={t('settings.locations.nameLabel')}
                autoCapitalize="words"
                onChangeText={setNewLocationName}
                placeholder={t('settings.locations.namePlaceholder')}
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
              label={t('common.cancel')}
              iconName="close"
              selected={false}
              grow
              onPress={closeManualLocationPicker}
            />
            <OptionButton
              label={t('settings.locations.useLocation')}
              iconName="location"
              selected={false}
              grow
              onPress={confirmManualLocation}
            />
          </View>
        </SafeAreaView>
      </Modal>
      <Modal
        animationType="fade"
        onRequestClose={() => setManagedLocationId(null)}
        transparent
        visible={managedLocation !== null}
      >
        <SafeAreaView style={styles.managementOverlay}>
          <View style={styles.managementPanel}>
            {managedLocation ? (
              <>
                <View style={styles.mapModalTitleGroup}>
                  <Text style={styles.mapModalTitle}>{managedLocation.name}</Text>
                  <Text style={styles.notice}>
                    {formatMapCoordinate(managedLocation.latitude)},{' '}
                    {formatMapCoordinate(managedLocation.longitude)}
                  </Text>
                </View>
                <TextInput
                  accessibilityLabel={t('settings.locations.renameLabel', {
                    name: managedLocation.name,
                  })}
                  autoCapitalize="words"
                  onChangeText={(value) =>
                    setDraftNames((current) => ({ ...current, [managedLocation.id]: value }))
                  }
                  placeholder={t('settings.locations.renamePlaceholder')}
                  placeholderTextColor={colors.muted}
                  style={styles.input}
                  value={draftNames[managedLocation.id] ?? managedLocation.name}
                />
                <View style={styles.twoButtonRow}>
                  <OptionButton
                    label={t('settings.locations.rename')}
                    iconName="edit"
                    selected={false}
                    disabled={
                      loading ||
                      (draftNames[managedLocation.id] ?? managedLocation.name).trim().length === 0
                    }
                    grow
                    onPress={() =>
                      renameSavedLocation(
                        managedLocation.id,
                        draftNames[managedLocation.id] ?? managedLocation.name,
                      )
                    }
                  />
                  <OptionButton
                    label={t('settings.locations.editMap')}
                    iconName="location-management"
                    selected={false}
                    disabled={loading}
                    grow
                    onPress={() =>
                      openEditLocationPicker(managedLocation.id, {
                        latitude: managedLocation.latitude,
                        longitude: managedLocation.longitude,
                      })
                    }
                  />
                </View>
                <AppButton
                  title={t('settings.locations.delete')}
                  iconName="delete"
                  disabled={loading}
                  fullWidth
                  onPress={() => requestDeleteLocation(managedLocation)}
                />
              </>
            ) : null}
            <AppButton
              title={t('common.close')}
              iconName="close"
              fullWidth
              onPress={() => setManagedLocationId(null)}
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
  disabled: {
    opacity: 0.55,
  },
  locationHeader: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: spacing.md,
    justifyContent: 'space-between',
  },
  locationName: {
    color: colors.text,
    flex: 1,
    fontSize: 16,
    fontWeight: '700',
  },
  locationNameRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.xs,
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
  managementOverlay: {
    backgroundColor: 'rgba(23, 32, 26, 0.28)',
    flex: 1,
    justifyContent: 'flex-end',
  },
  managementPanel: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    gap: spacing.sm,
    padding: spacing.lg,
  },
  notificationDivider: {
    backgroundColor: colors.border,
    height: StyleSheet.hairlineWidth,
    marginVertical: spacing.sm,
  },
  sectionLabel: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '700',
  },
  pressed: {
    backgroundColor: colors.pressedSurface,
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
  switchCopy: {
    flex: 1,
    gap: spacing.xs,
    minWidth: 0,
  },
  switchLabel: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '700',
  },
  switchRow: {
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
});

import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { AppButton } from '../components/AppButton';
import { LocationMapPicker } from '../components/LocationMapPicker';
import { SectionCard } from '../components/SectionCard';
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
  return <AppButton title={label} onPress={onPress} selected={selected} disabled={disabled} />;
}

export function SettingsScreen() {
  const settings = useAppStore((state) => state.settings);
  const profileEnabled = useAppStore((state) => state.profile.enabled);
  const location = useAppStore((state) => state.location);
  const environment = useAppStore((state) => state.environment);
  const refresh = useAppStore((state) => state.refresh);
  const updateSettings = useAppStore((state) => state.updateSettings);
  const manualCoordinates =
    parseManualCoordinates(settings) ??
    location.coordinates ??
    environment?.coordinates ??
    DEFAULT_MAP_COORDINATES;

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
            onPress={() => updateSettings({ locationMode: 'automatic' })}
          />
          <OptionButton
            label="Manual"
            selected={settings.locationMode === 'manual'}
            onPress={selectManualLocationMode}
          />
        </View>
        {settings.locationMode === 'manual' ? (
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

      <SectionCard title="Privacy">
        <Text style={styles.body}>
          AirAware does not use analytics or accounts. Coordinates are sent to Open-Meteo to
          retrieve environmental data. Profile selections and shared summaries remain on this
          device.
        </Text>
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
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  content: {
    padding: spacing.lg,
  },
  screen: {
    backgroundColor: colors.background,
  },
});

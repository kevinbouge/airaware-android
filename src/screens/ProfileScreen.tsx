import { ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { SectionCard } from '../components/SectionCard';
import { useAppStore } from '../state/useAppStore';
import { colors, spacing } from '../theme/theme';
import type { ProfileFactorId } from '../models/profile';

const POLLEN_FACTORS: [ProfileFactorId, string][] = [
  ['pollen_alder', 'Alder pollen'],
  ['pollen_birch', 'Birch pollen'],
  ['pollen_grass', 'Grass pollen'],
  ['pollen_mugwort', 'Mugwort pollen'],
  ['pollen_olive', 'Olive pollen'],
  ['pollen_ragweed', 'Ragweed pollen'],
];

const POLLUTION_FACTORS: [ProfileFactorId, string][] = [
  ['pm25', 'PM2.5'],
  ['pm10', 'PM10'],
  ['nitrogen_dioxide', 'Nitrogen dioxide'],
  ['ozone', 'Ozone'],
  ['sulphur_dioxide', 'Sulphur dioxide'],
  ['carbon_monoxide', 'Carbon monoxide'],
  ['aerosol_optical_depth', 'Atmospheric haze'],
  ['dust', 'Atmospheric dust'],
  ['wildfire_pm10', 'Smoke-related particulate context'],
];

const OTHER_FACTORS: [ProfileFactorId, string][] = [
  ['mold', 'Mold potential'],
  ['uv_index', 'UV index'],
];

function ToggleRow({
  label,
  value,
  onValueChange,
}: {
  label: string;
  value: boolean;
  onValueChange: () => void;
}) {
  return (
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      <Switch value={value} onValueChange={onValueChange} />
    </View>
  );
}

export function ProfileScreen() {
  const profile = useAppStore((state) => state.profile);
  const updateProfile = useAppStore((state) => state.updateProfile);
  const toggleProfileFactor = useAppStore((state) => state.toggleProfileFactor);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <SectionCard
        title="Personal Allergy Profile"
        subtitle="Factors you want AirAware to emphasize. This is not a diagnosis or symptom prediction."
      >
        <ToggleRow
          label="Enable personalized risk"
          value={profile.enabled}
          onValueChange={() => updateProfile({ enabled: !profile.enabled })}
        />
      </SectionCard>

      <SectionCard title="Pollen">
        {POLLEN_FACTORS.map(([factor, label]) => (
          <ToggleRow
            key={factor}
            label={label}
            value={profile.factors[factor]}
            onValueChange={() => toggleProfileFactor(factor)}
          />
        ))}
      </SectionCard>

      <SectionCard title="Pollution and irritants">
        {POLLUTION_FACTORS.map(([factor, label]) => (
          <ToggleRow
            key={factor}
            label={label}
            value={profile.factors[factor]}
            onValueChange={() => toggleProfileFactor(factor)}
          />
        ))}
      </SectionCard>

      <SectionCard title="Other environmental factors">
        {OTHER_FACTORS.map(([factor, label]) => (
          <ToggleRow
            key={factor}
            label={label}
            value={profile.factors[factor]}
            onValueChange={() => toggleProfileFactor(factor)}
          />
        ))}
      </SectionCard>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: spacing.lg,
  },
  label: {
    color: colors.text,
    flex: 1,
    fontSize: 15,
  },
  row: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 42,
  },
  screen: {
    backgroundColor: colors.background,
  },
});

import { ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { SectionCard } from '../components/SectionCard';
import { profileFactorSections } from '../core/profileSections';
import { useCapabilities } from '../hooks/useCapabilities';
import { useAppStore } from '../state/useAppStore';
import { colors, spacing } from '../theme/theme';

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
  const capabilities = useCapabilities();
  const {
    pollen: pollenFactors,
    regulatedPollution: regulatedPollutionFactors,
    atmosphericIrritants: atmosphericIrritantFactors,
    proSections,
  } = profileFactorSections(capabilities);

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
        {pollenFactors.map(([factor, label]) => (
          <ToggleRow
            key={factor}
            label={label}
            value={profile.factors[factor]}
            onValueChange={() => toggleProfileFactor(factor)}
          />
        ))}
      </SectionCard>

      <SectionCard title="Regulated pollution">
        {regulatedPollutionFactors.map(([factor, label]) => (
          <ToggleRow
            key={factor}
            label={label}
            value={profile.factors[factor]}
            onValueChange={() => toggleProfileFactor(factor)}
          />
        ))}
      </SectionCard>

      <SectionCard title="Atmospheric irritants">
        {atmosphericIrritantFactors.map(([factor, label]) => (
          <ToggleRow
            key={factor}
            label={label}
            value={profile.factors[factor]}
            onValueChange={() => toggleProfileFactor(factor)}
          />
        ))}
      </SectionCard>

      {proSections.map((section) => (
        <SectionCard key={section.id} title={section.title}>
          {section.rows.map((row) =>
            row.profileFactorId ? (
              <ToggleRow
                key={row.id}
                label={row.label}
                value={profile.factors[row.profileFactorId]}
                onValueChange={() => {
                  if (row.profileFactorId) void toggleProfileFactor(row.profileFactorId);
                }}
              />
            ) : null,
          )}
        </SectionCard>
      ))}
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

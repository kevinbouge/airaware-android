import { ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { SectionCard } from '../components/SectionCard';
import { EnvironmentalIcon } from '../components/icons/EnvironmentalIcon';
import { getProfileFactorIconName } from '../components/icons/environmentalIconResolver';
import { profileFactorSections } from '../core/profileSections';
import { useCapabilities } from '../hooks/useCapabilities';
import type { ProfileFactorId } from '../models/profile';
import { useAppStore } from '../state/useAppStore';
import { colors, spacing } from '../theme/theme';

function ToggleRow({
  label,
  profileFactorId,
  value,
  onValueChange,
}: {
  label: string;
  profileFactorId?: ProfileFactorId | undefined;
  value: boolean;
  onValueChange: () => void;
}) {
  return (
    <View style={styles.row}>
      {profileFactorId ? (
        <EnvironmentalIcon name={getProfileFactorIconName(profileFactorId)} size="measurement" />
      ) : null}
      <Text style={styles.label}>{label}</Text>
      <Switch value={value} onValueChange={onValueChange} />
    </View>
  );
}

export function ProfileScreen() {
  const { t } = useTranslation();
  const profile = useAppStore((state) => state.profile);
  const updateProfile = useAppStore((state) => state.updateProfile);
  const toggleProfileFactor = useAppStore((state) => state.toggleProfileFactor);
  const capabilities = useCapabilities();
  const {
    pollen: pollenFactors,
    regulatedPollution: regulatedPollutionFactors,
    atmosphericIrritants: atmosphericIrritantFactors,
    additionalSections,
  } = profileFactorSections(capabilities);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <SectionCard title={t('profile.title')} subtitle={t('profile.subtitle')}>
        <ToggleRow
          label={t('profile.enablePersonalizedRisk')}
          value={profile.enabled}
          onValueChange={() => updateProfile({ enabled: !profile.enabled })}
        />
      </SectionCard>

      <SectionCard title={t('environment.sections.pollen')}>
        {pollenFactors.map(([factor, label]) => (
          <ToggleRow
            key={factor}
            label={label}
            profileFactorId={factor}
            value={profile.factors[factor]}
            onValueChange={() => toggleProfileFactor(factor)}
          />
        ))}
      </SectionCard>

      <SectionCard title={t('profile.regulatedPollution')}>
        {regulatedPollutionFactors.map(([factor, label]) => (
          <ToggleRow
            key={factor}
            label={label}
            profileFactorId={factor}
            value={profile.factors[factor]}
            onValueChange={() => toggleProfileFactor(factor)}
          />
        ))}
      </SectionCard>

      <SectionCard title={t('profile.atmosphericIrritants')}>
        {atmosphericIrritantFactors.map(([factor, label]) => (
          <ToggleRow
            key={factor}
            label={label}
            profileFactorId={factor}
            value={profile.factors[factor]}
            onValueChange={() => toggleProfileFactor(factor)}
          />
        ))}
      </SectionCard>

      {additionalSections.map((section) => (
        <SectionCard key={section.id} title={section.title}>
          {section.rows.map((row) =>
            row.profileFactorId ? (
              <ToggleRow
                key={row.id}
                label={row.label}
                profileFactorId={row.profileFactorId}
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

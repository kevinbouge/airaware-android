import type { AppSettings, PersonalAllergyProfile } from '../models/profile';

export function settingsForProfileState(
  settings: AppSettings,
  profile: PersonalAllergyProfile,
): AppSettings {
  if (profile.enabled) return settings;

  if (settings.summaryScore === 'environmental') {
    return settings;
  }

  return {
    ...settings,
    summaryScore: 'environmental',
  };
}

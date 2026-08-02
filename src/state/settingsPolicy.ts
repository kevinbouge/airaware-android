import type { AppSettings, PersonalAllergyProfile } from '../models/profile';

export function settingsForProfileState(
  settings: AppSettings,
  profile: PersonalAllergyProfile,
): AppSettings {
  if (profile.enabled) return settings;

  if (
    settings.headlineScore === 'environmental' &&
    settings.forecastScore === 'environmental' &&
    settings.summaryScore === 'environmental'
  ) {
    return settings;
  }

  return {
    ...settings,
    headlineScore: 'environmental',
    forecastScore: 'environmental',
    summaryScore: 'environmental',
  };
}

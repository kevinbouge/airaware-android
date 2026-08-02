type PollenFactorId =
  | 'pollen_alder'
  | 'pollen_birch'
  | 'pollen_grass'
  | 'pollen_mugwort'
  | 'pollen_olive'
  | 'pollen_ragweed';

type RegulatedPollutantFactorId =
  'pm25' | 'pm10' | 'nitrogen_dioxide' | 'ozone' | 'sulphur_dioxide';

type AtmosphericIrritantFactorId =
  'carbon_monoxide' | 'aerosol_optical_depth' | 'dust' | 'wildfire_pm10';

export type ProfileFactorId =
  PollenFactorId | RegulatedPollutantFactorId | AtmosphericIrritantFactorId | 'mold' | 'uv_index';

export interface PersonalAllergyProfile {
  enabled: boolean;
  factors: Record<ProfileFactorId, boolean>;
}

export const DEFAULT_PROFILE: PersonalAllergyProfile = {
  enabled: false,
  factors: {
    pollen_alder: true,
    pollen_birch: true,
    pollen_grass: true,
    pollen_mugwort: true,
    pollen_olive: true,
    pollen_ragweed: true,
    mold: false,
    pm25: true,
    pm10: true,
    nitrogen_dioxide: true,
    ozone: true,
    sulphur_dioxide: true,
    carbon_monoxide: true,
    aerosol_optical_depth: true,
    dust: true,
    wildfire_pm10: true,
    uv_index: false,
  },
};

export interface AppSettings {
  locationMode: 'automatic' | 'manual';
  manualLatitude: string;
  manualLongitude: string;
  refreshIntervalMinutes: 60 | 120 | 240 | 360;
  outdoorWindowDurationHours: 1 | 2 | 3;
  headlineScore: 'environmental' | 'personalized';
  forecastScore: 'environmental' | 'personalized';
  summaryScore: 'environmental' | 'personalized';
  summaryLocation: 'place' | 'hidden';
  riskTransitionNotificationsEnabled: boolean;
  riskTransitionNotificationThreshold: 'highAndVeryHigh' | 'veryHighOnly';
  collapsedSections: Record<string, boolean>;
  locationOnboardingComplete: boolean;
}

export const DEFAULT_SETTINGS: AppSettings = {
  locationMode: 'automatic',
  manualLatitude: '',
  manualLongitude: '',
  refreshIntervalMinutes: 120,
  outdoorWindowDurationHours: 2,
  headlineScore: 'environmental',
  forecastScore: 'environmental',
  summaryScore: 'environmental',
  summaryLocation: 'place',
  riskTransitionNotificationsEnabled: false,
  riskTransitionNotificationThreshold: 'highAndVeryHigh',
  collapsedSections: {},
  locationOnboardingComplete: false,
};

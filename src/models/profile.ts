import { DEFAULT_ACTIVITY_SETTINGS } from '../core/activityDefinitions';
import type { ActivitySettings } from './activities';
import type { EnvironmentalEventNotificationSettings } from './environmentalEvents';
import type { LanguagePreference } from '../i18n/types';
import { CURRENT_LOCATION_ID, currentLocationEntry, type SavedLocation } from './location';

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
  enabled: true,
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
  locations: SavedLocation[];
  activeLocationId: string;
  summaryScore: 'environmental' | 'personalized';
  summaryLocation: 'place' | 'hidden';
  riskTransitionNotificationsEnabled: boolean;
  riskTransitionNotificationThreshold: 'highAndVeryHigh' | 'veryHighOnly';
  environmentalEventNotifications: EnvironmentalEventNotificationSettings;
  enabledActivities: ActivitySettings;
  collapsedSections: Record<string, boolean>;
  locationOnboardingComplete: boolean;
  languagePreference: LanguagePreference;
}

export const DEFAULT_ENVIRONMENTAL_EVENT_NOTIFICATIONS: EnvironmentalEventNotificationSettings = {
  pollen: false,
  airPollution: false,
  saharanDust: false,
  wildfirePollution: false,
  uv: false,
  mold: false,
  headlineRisk: false,
};

export const DEFAULT_SETTINGS: AppSettings = {
  locations: [currentLocationEntry()],
  activeLocationId: CURRENT_LOCATION_ID,
  summaryScore: 'personalized',
  summaryLocation: 'place',
  riskTransitionNotificationsEnabled: false,
  riskTransitionNotificationThreshold: 'highAndVeryHigh',
  environmentalEventNotifications: DEFAULT_ENVIRONMENTAL_EVENT_NOTIFICATIONS,
  enabledActivities: DEFAULT_ACTIVITY_SETTINGS,
  collapsedSections: {},
  locationOnboardingComplete: false,
  languagePreference: 'system',
};

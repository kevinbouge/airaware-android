import { availableProfileFactorOptions } from '../capabilities/variables';
import type { AppCapabilities } from '../capabilities/types';
import type { ProfileFactorId } from '../models/profile';

interface ProfileSectionRow {
  id: string;
  label: string;
  profileFactorId?: ProfileFactorId;
}

interface ProfileSectionDefinition {
  id: string;
  title: string;
  rows: ProfileSectionRow[];
}

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
];

const ATMOSPHERIC_IRRITANT_FACTORS: [ProfileFactorId, string][] = [
  ['carbon_monoxide', 'Carbon monoxide'],
  ['aerosol_optical_depth', 'Atmospheric haze'],
  ['dust', 'Atmospheric dust'],
  ['wildfire_pm10', 'Smoke-related particulate context'],
];

const ADDITIONAL_PROFILE_SECTIONS: ProfileSectionDefinition[] = [
  {
    id: 'profile.moldAndSun',
    title: 'Mold and sun',
    rows: [
      { id: 'mold', label: 'Mold potential', profileFactorId: 'mold' },
      { id: 'uv_index', label: 'UV index', profileFactorId: 'uv_index' },
    ],
  },
];

export function profileFactorSections(capabilities: AppCapabilities) {
  const profileFactors = (factors: [ProfileFactorId, string][]) =>
    factors.filter(([factor]) =>
      availableProfileFactorOptions(capabilities, [factor]).includes(factor),
    );
  const extendedAvailable =
    capabilities.environmentalVariables.availableGroups.includes('extended');

  return {
    pollen: profileFactors(POLLEN_FACTORS),
    regulatedPollution: profileFactors(POLLUTION_FACTORS),
    atmosphericIrritants: profileFactors(ATMOSPHERIC_IRRITANT_FACTORS),
    additionalSections: ADDITIONAL_PROFILE_SECTIONS.map((section) => ({
      ...section,
      rows: section.rows.filter(
        (row) =>
          row.profileFactorId === undefined ||
          availableProfileFactorOptions(capabilities, [row.profileFactorId]).includes(
            row.profileFactorId,
          ),
      ),
    })).filter((section) => section.rows.length > 0),
    extendedAvailable,
  };
}

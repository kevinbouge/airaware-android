import { availableProfileFactorOptions } from '../capabilities/variables';
import type { AppCapabilities } from '../capabilities/types';
import { translate } from '../i18n';
import type { ProfileFactorId } from '../models/profile';
import { pollenLabel, pollutantLabel } from '../utils/readingLabels';

type PollenLabelKey = Parameters<typeof pollenLabel>[0];
type PollutantLabelKey = Parameters<typeof pollutantLabel>[0];

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

const POLLEN_FACTORS: [ProfileFactorId, PollenLabelKey][] = [
  ['pollen_alder', 'alder'],
  ['pollen_birch', 'birch'],
  ['pollen_grass', 'grass'],
  ['pollen_mugwort', 'mugwort'],
  ['pollen_olive', 'olive'],
  ['pollen_ragweed', 'ragweed'],
];

const POLLUTION_FACTORS: [ProfileFactorId, PollutantLabelKey][] = [
  ['pm25', 'pm25'],
  ['pm10', 'pm10'],
  ['nitrogen_dioxide', 'nitrogenDioxide'],
  ['ozone', 'ozone'],
  ['sulphur_dioxide', 'sulphurDioxide'],
];

const ATMOSPHERIC_IRRITANT_FACTORS: [ProfileFactorId, string][] = [
  ['carbon_monoxide', 'environment.irritants.carbonMonoxide'],
  ['aerosol_optical_depth', 'profile.atmosphericHaze'],
  ['dust', 'profile.atmosphericDust'],
  ['wildfire_pm10', 'profile.smokeParticulateContext'],
];

const ADDITIONAL_PROFILE_SECTIONS: ProfileSectionDefinition[] = [
  {
    id: 'profile.moldAndSun',
    title: 'profile.moldAndSun',
    rows: [
      { id: 'mold', label: 'environment.moldPotential', profileFactorId: 'mold' },
      { id: 'uv_index', label: 'environment.uvIndex', profileFactorId: 'uv_index' },
    ],
  },
];

export function profileFactorSections(capabilities: AppCapabilities) {
  const profileFactors = <LabelKey extends string>(factors: [ProfileFactorId, LabelKey][]) =>
    factors.filter(([factor]) =>
      availableProfileFactorOptions(capabilities, [factor]).includes(factor),
    );
  const extendedAvailable =
    capabilities.environmentalVariables.availableGroups.includes('extended');

  return {
    pollen: profileFactors(POLLEN_FACTORS).map(
      ([factor, label]) => [factor, pollenLabel(label)] as [ProfileFactorId, string],
    ),
    regulatedPollution: profileFactors(POLLUTION_FACTORS).map(
      ([factor, label]) => [factor, pollutantLabel(label)] as [ProfileFactorId, string],
    ),
    atmosphericIrritants: profileFactors(ATMOSPHERIC_IRRITANT_FACTORS).map(
      ([factor, label]) => [factor, translate(label)] as [ProfileFactorId, string],
    ),
    additionalSections: ADDITIONAL_PROFILE_SECTIONS.map((section) => ({
      ...section,
      title: translate(section.title),
      rows: section.rows
        .filter(
          (row) =>
            row.profileFactorId === undefined ||
            availableProfileFactorOptions(capabilities, [row.profileFactorId]).includes(
              row.profileFactorId,
            ),
        )
        .map((row) => ({ ...row, label: translate(row.label) })),
    })).filter((section) => section.rows.length > 0),
    extendedAvailable,
  };
}

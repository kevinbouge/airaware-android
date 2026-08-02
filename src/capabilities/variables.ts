import type {
  AtmosphericIrritants,
  PollenReadings,
  RegulatedPollutants,
} from '../models/environment';
import type { PersonalAllergyProfile, ProfileFactorId } from '../models/profile';
import type {
  AppCapabilities,
  EnvironmentalVariableDefinition,
  EnvironmentalVariableId,
} from './types';
const ENVIRONMENTAL_VARIABLES: readonly EnvironmentalVariableDefinition[] = [
  {
    id: 'pollen_alder',
    displayName: 'Alder pollen',
    group: 'standard',
    profileFactorId: 'pollen_alder',
  },
  {
    id: 'pollen_birch',
    displayName: 'Birch pollen',
    group: 'standard',
    profileFactorId: 'pollen_birch',
  },
  {
    id: 'pollen_grass',
    displayName: 'Grass pollen',
    group: 'standard',
    profileFactorId: 'pollen_grass',
  },
  {
    id: 'pollen_mugwort',
    displayName: 'Mugwort pollen',
    group: 'standard',
    profileFactorId: 'pollen_mugwort',
  },
  {
    id: 'pollen_olive',
    displayName: 'Olive pollen',
    group: 'standard',
    profileFactorId: 'pollen_olive',
  },
  {
    id: 'pollen_ragweed',
    displayName: 'Ragweed pollen',
    group: 'standard',
    profileFactorId: 'pollen_ragweed',
  },
  { id: 'pm25', displayName: 'PM2.5', group: 'standard', profileFactorId: 'pm25' },
  { id: 'pm10', displayName: 'PM10', group: 'standard', profileFactorId: 'pm10' },
  {
    id: 'nitrogenDioxide',
    displayName: 'Nitrogen dioxide',
    group: 'standard',
    profileFactorId: 'nitrogen_dioxide',
  },
  { id: 'ozone', displayName: 'Ozone', group: 'standard', profileFactorId: 'ozone' },
  {
    id: 'sulphurDioxide',
    displayName: 'Sulphur dioxide',
    group: 'standard',
    profileFactorId: 'sulphur_dioxide',
  },
  {
    id: 'carbonMonoxide',
    displayName: 'Carbon monoxide',
    group: 'standard',
    profileFactorId: 'carbon_monoxide',
  },
  {
    id: 'aerosolOpticalDepth',
    displayName: 'Atmospheric haze',
    group: 'standard',
    profileFactorId: 'aerosol_optical_depth',
  },
  { id: 'dust', displayName: 'Atmospheric dust', group: 'standard', profileFactorId: 'dust' },
  {
    id: 'wildfirePm10',
    displayName: 'Smoke-related particulate context',
    group: 'standard',
    profileFactorId: 'wildfire_pm10',
  },
  {
    id: 'moldPotential',
    displayName: 'Mold potential',
    group: 'extended',
    profileFactorId: 'mold',
  },
  { id: 'uvIndex', displayName: 'UV index', group: 'extended', profileFactorId: 'uv_index' },
  { id: 'carbonDioxide', displayName: 'CO₂', group: 'extended' },
  { id: 'ammonia', displayName: 'NH₃', group: 'extended' },
  { id: 'methane', displayName: 'CH₄', group: 'extended' },
  { id: 'nitrogenMonoxide', displayName: 'NO', group: 'extended' },
  { id: 'formaldehyde', displayName: 'Formaldehyde', group: 'extended' },
  {
    id: 'nonMethaneVolatileOrganicCompounds',
    displayName: 'NMVOC',
    group: 'extended',
  },
  { id: 'pressureMsl', displayName: 'Mean sea-level pressure', group: 'extended' },
  { id: 'surfacePressure', displayName: 'Surface pressure', group: 'extended' },
  { id: 'extendedVisibility', displayName: 'Visibility', group: 'extended' },
  { id: 'cloudCover', displayName: 'Cloud cover', group: 'extended' },
  { id: 'cloudCoverLow', displayName: 'Low cloud cover', group: 'extended' },
  { id: 'cloudCoverMid', displayName: 'Mid cloud cover', group: 'extended' },
  { id: 'cloudCoverHigh', displayName: 'High cloud cover', group: 'extended' },
  { id: 'extendedDewPoint', displayName: 'Dew point', group: 'extended' },
  { id: 'wetBulbTemperature', displayName: 'Wet-bulb temperature', group: 'extended' },
  { id: 'extendedWindGusts', displayName: 'Wind gusts', group: 'extended' },
  { id: 'shortwaveRadiation', displayName: 'Solar radiation', group: 'extended' },
  {
    id: 'directNormalIrradiance',
    displayName: 'Direct normal irradiance',
    group: 'extended',
  },
  { id: 'diffuseRadiation', displayName: 'Diffuse radiation', group: 'extended' },
  { id: 'sunshineDuration', displayName: 'Sunshine duration', group: 'extended' },
  { id: 'cape', displayName: 'CAPE', group: 'extended' },
] as const;

function availableGroups(capabilities: AppCapabilities): Set<string> {
  return new Set(capabilities.environmentalVariables.availableGroups);
}

export function isEnvironmentalVariableAvailable(
  capabilities: AppCapabilities,
  variableId: EnvironmentalVariableId,
): boolean {
  const variable = ENVIRONMENTAL_VARIABLES.find((item) => item.id === variableId);
  return variable ? availableGroups(capabilities).has(variable.group) : false;
}

export function availableEnvironmentalVariables(
  capabilities: AppCapabilities,
): EnvironmentalVariableDefinition[] {
  const groups = availableGroups(capabilities);
  return ENVIRONMENTAL_VARIABLES.filter((variable) => groups.has(variable.group));
}

export function availableProfileFactorOptions(
  capabilities: AppCapabilities,
  factorIds: readonly ProfileFactorId[],
): ProfileFactorId[] {
  const availableFactors = new Set(
    availableEnvironmentalVariables(capabilities)
      .map((variable) => variable.profileFactorId)
      .filter((factor): factor is ProfileFactorId => factor !== undefined),
  );

  return factorIds.filter((factor) => availableFactors.has(factor));
}

export function profileForCapabilities(
  capabilities: AppCapabilities,
  profile: PersonalAllergyProfile,
): PersonalAllergyProfile {
  const factorIds = Object.keys(profile.factors) as ProfileFactorId[];
  const availableFactors = new Set(availableProfileFactorOptions(capabilities, factorIds));

  return {
    ...profile,
    factors: Object.fromEntries(
      factorIds.map((factor) => [factor, availableFactors.has(factor) && profile.factors[factor]]),
    ) as PersonalAllergyProfile['factors'],
  };
}

export function pollenVariableId(type: keyof PollenReadings): EnvironmentalVariableId {
  return `pollen_${type}`;
}

export function pollutantVariableId(type: keyof RegulatedPollutants): EnvironmentalVariableId {
  return type;
}

export function irritantVariableId(type: keyof AtmosphericIrritants): EnvironmentalVariableId {
  return type;
}

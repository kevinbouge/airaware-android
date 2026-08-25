import type { EnvironmentalEventType } from '../../models/environmentalEvents';
import type { ProfileFactorId } from '../../models/profile';
import type { VegetationCategoryId, VegetationTaxonId } from '../../models/vegetation';
import type { EnvironmentalVariableId } from '../../capabilities/types';
import { environmentalIconAsset } from './environmentalIconMap';
import type {
  EnvironmentalIconDefinition,
  EnvironmentalIconName,
  WeatherIconCondition,
} from './environmentalIconTypes';

const VARIABLE_ICON_NAMES: Partial<Record<EnvironmentalVariableId, EnvironmentalIconName>> = {
  pollen_alder: 'tree-pollen',
  pollen_birch: 'tree-pollen',
  pollen_grass: 'grass-pollen',
  pollen_mugwort: 'weed-pollen',
  pollen_olive: 'tree-pollen',
  pollen_ragweed: 'weed-pollen',
  pm25: 'pm25',
  pm10: 'pm10',
  nitrogenDioxide: 'nitrogen-dioxide',
  ozone: 'ozone',
  sulphurDioxide: 'sulphur-dioxide',
  carbonMonoxide: 'carbon-monoxide',
  aerosolOpticalDepth: 'aerosol',
  dust: 'saharan-dust',
  wildfirePm10: 'wildfire-pollution',
  moldPotential: 'mold-potential',
  uvIndex: 'uv',
  temperature: 'temperature',
  apparentTemperature: 'apparent-temperature',
  relativeHumidity: 'humidity',
  dewPoint: 'dew-point',
  precipitation: 'precipitation',
  precipitationProbability: 'precipitation',
  windSpeed: 'wind',
  windGusts: 'wind',
  pressureMsl: 'pressure',
  surfacePressure: 'pressure',
  extendedVisibility: 'visibility',
  cloudCover: 'cloud-cover',
  cloudCoverLow: 'cloud-cover',
  cloudCoverMid: 'cloud-cover',
  cloudCoverHigh: 'cloud-cover',
  extendedDewPoint: 'dew-point',
  wetBulbTemperature: 'dew-point',
  extendedWindGusts: 'wind',
  shortwaveRadiation: 'solar-radiation',
  directNormalIrradiance: 'solar-radiation',
  diffuseRadiation: 'solar-radiation',
  sunshineDuration: 'weather-clear-day',
  soilMoisture0To1cm: 'soil-moisture',
  soilTemperature0cm: 'soil-temperature',
  et0FaoEvapotranspiration: 'precipitation',
  vapourPressureDeficit: 'humidity',
  carbonDioxide: 'air-pollution',
  ammonia: 'air-pollution',
  methane: 'air-pollution',
  nitrogenMonoxide: 'air-pollution',
  formaldehyde: 'air-pollution',
  nonMethaneVolatileOrganicCompounds: 'air-pollution',
};

const EVENT_ICON_NAMES: Record<EnvironmentalEventType, EnvironmentalIconName> = {
  pollen: 'pollen',
  pollution: 'air-pollution',
  'saharan-dust': 'saharan-dust',
  'wildfire-pollution': 'wildfire-pollution',
  aerosol: 'aerosol',
  uv: 'uv',
  mold: 'mold-potential',
  'headline-risk': 'environmental-risk',
};

const PROFILE_FACTOR_ICON_NAMES: Record<ProfileFactorId, EnvironmentalIconName> = {
  pollen_alder: 'tree-pollen',
  pollen_birch: 'tree-pollen',
  pollen_grass: 'grass-pollen',
  pollen_mugwort: 'weed-pollen',
  pollen_olive: 'tree-pollen',
  pollen_ragweed: 'weed-pollen',
  pm25: 'pm25',
  pm10: 'pm10',
  nitrogen_dioxide: 'nitrogen-dioxide',
  ozone: 'ozone',
  sulphur_dioxide: 'sulphur-dioxide',
  carbon_monoxide: 'carbon-monoxide',
  aerosol_optical_depth: 'aerosol',
  dust: 'saharan-dust',
  wildfire_pm10: 'wildfire-pollution',
  mold: 'mold-potential',
  uv_index: 'uv',
};

const WEATHER_ICON_NAMES: Record<WeatherIconCondition, EnvironmentalIconName> = {
  'clear-day': 'weather-clear-day',
  'clear-night': 'weather-clear-night',
  'partly-cloudy-day': 'weather-partly-cloudy-day',
  'partly-cloudy-night': 'weather-partly-cloudy-night',
  cloudy: 'weather-cloudy',
  overcast: 'weather-overcast',
  fog: 'weather-fog',
  drizzle: 'weather-drizzle',
  rain: 'weather-rain',
  'heavy-rain': 'weather-heavy-rain',
  thunderstorm: 'weather-thunderstorm',
  snow: 'weather-snow',
  wind: 'wind',
};

const VEGETATION_CATEGORY_ICON_NAMES: Record<VegetationCategoryId, EnvironmentalIconName> = {
  woodland: 'vegetation-woodland',
  grassland: 'vegetation-grassland',
  meadow: 'vegetation-meadow',
  orchard: 'vegetation-orchard',
  scrub: 'vegetation-scrub',
  parkland: 'vegetation-parkland',
  farmland: 'vegetation-farmland',
};

const VEGETATION_TAXON_ICON_NAMES: Record<VegetationTaxonId, EnvironmentalIconName> = {
  alder: 'vegetation-tree-taxon',
  birch: 'vegetation-tree-taxon',
  olive: 'vegetation-tree-taxon',
};

export function getVariableIconName(variableId: EnvironmentalVariableId): EnvironmentalIconName {
  return VARIABLE_ICON_NAMES[variableId] ?? 'generic-environment';
}

export function getEventIconName(eventType: EnvironmentalEventType): EnvironmentalIconName {
  return EVENT_ICON_NAMES[eventType] ?? 'environmental-event';
}

export function getProfileFactorIconName(factorId: ProfileFactorId): EnvironmentalIconName {
  return PROFILE_FACTOR_ICON_NAMES[factorId] ?? 'generic-environment';
}

export function getVegetationCategoryIconName(
  categoryId: VegetationCategoryId,
): EnvironmentalIconName {
  return VEGETATION_CATEGORY_ICON_NAMES[categoryId] ?? 'generic-environment';
}

export function getVegetationTaxonIconName(taxonId: VegetationTaxonId): EnvironmentalIconName {
  return VEGETATION_TAXON_ICON_NAMES[taxonId] ?? 'generic-environment';
}

function getWeatherIconName(condition: WeatherIconCondition): EnvironmentalIconName {
  return WEATHER_ICON_NAMES[condition] ?? 'generic-environment';
}

function getEnvironmentalIconDefinition(name: EnvironmentalIconName): EnvironmentalIconDefinition {
  const asset = environmentalIconAsset(name);
  return {
    assetSlug: asset.assetSlug,
    name: asset.name,
    source: asset.source,
  };
}

export function getVariableIconDefinition(
  variableId: EnvironmentalVariableId,
): EnvironmentalIconDefinition {
  return getEnvironmentalIconDefinition(getVariableIconName(variableId));
}

export function getEventIconDefinition(
  eventType: EnvironmentalEventType,
): EnvironmentalIconDefinition {
  return getEnvironmentalIconDefinition(getEventIconName(eventType));
}

export function getProfileFactorIconDefinition(
  factorId: ProfileFactorId,
): EnvironmentalIconDefinition {
  return getEnvironmentalIconDefinition(getProfileFactorIconName(factorId));
}

export function getVegetationCategoryIconDefinition(
  categoryId: VegetationCategoryId,
): EnvironmentalIconDefinition {
  return getEnvironmentalIconDefinition(getVegetationCategoryIconName(categoryId));
}

export function getVegetationTaxonIconDefinition(
  taxonId: VegetationTaxonId,
): EnvironmentalIconDefinition {
  return getEnvironmentalIconDefinition(getVegetationTaxonIconName(taxonId));
}

export function getWeatherIconDefinition(
  condition: WeatherIconCondition,
): EnvironmentalIconDefinition {
  return getEnvironmentalIconDefinition(getWeatherIconName(condition));
}

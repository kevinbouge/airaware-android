import type { EnvironmentalVariableId } from '../capabilities/types';
import type {
  CurrentEnvironmentalReadings,
  ExtendedAirQualityReadings,
  ExtendedWeatherReadings,
  PollenReadings,
  RegulatedPollutants,
  AtmosphericIrritants,
  RiskCategoryId,
} from '../models/environment';
import type {
  DataAggregationStrategy,
  DataDetailRangeDefinition,
  DataDetailVariableDefinition,
} from '../models/dataDetail';
import {
  formatDurationSeconds,
  formatMeasurement,
  formatNumber,
  formatVisibilityMeters,
} from '../utils/format';
import { POLLEN_THRESHOLDS, RAW_POLLUTANT_THRESHOLDS } from './constants';
import { categoryFromScore } from './categories';
import { calculateUvBurden } from './profileScoring';
import { isFiniteNumber, normalizeByThresholds } from '../utils/number';

export const DATA_DETAIL_RANGES: readonly DataDetailRangeDefinition[] = [
  {
    id: '24h',
    label: '24h',
    historyHours: 12,
    forecastHours: 12,
    granularity: 'hourly',
  },
  {
    id: 'week',
    label: 'Week',
    historyHours: 3 * 24,
    forecastHours: 3 * 24,
    granularity: 'daily',
  },
  {
    id: 'month',
    label: 'Month',
    historyHours: 14 * 24,
    forecastHours: 14 * 24,
    granularity: 'daily',
  },
  {
    id: 'year',
    label: 'Year',
    historyHours: 365 * 24,
    forecastHours: 14 * 24,
    granularity: 'weekly',
  },
] as const;

const POLLEN_VARIABLES = [
  ['pollen_alder', 'Alder pollen', 'alder_pollen'],
  ['pollen_birch', 'Birch pollen', 'birch_pollen'],
  ['pollen_grass', 'Grass pollen', 'grass_pollen'],
  ['pollen_mugwort', 'Mugwort pollen', 'mugwort_pollen'],
  ['pollen_olive', 'Olive pollen', 'olive_pollen'],
  ['pollen_ragweed', 'Ragweed pollen', 'ragweed_pollen'],
] as const;

const AIR_QUALITY_VARIABLES = [
  ['pm25', 'PM2.5', 'pm2_5', 'maximum', 'µg/m³', 0],
  ['pm10', 'PM10', 'pm10', 'maximum', 'µg/m³', 0],
  ['nitrogenDioxide', 'Nitrogen dioxide', 'nitrogen_dioxide', 'maximum', 'µg/m³', 0],
  ['ozone', 'Ozone', 'ozone', 'maximum', 'µg/m³', 0],
  ['sulphurDioxide', 'Sulphur dioxide', 'sulphur_dioxide', 'maximum', 'µg/m³', 0],
  ['carbonMonoxide', 'Carbon monoxide', 'carbon_monoxide', 'maximum', 'µg/m³', 0],
  ['aerosolOpticalDepth', 'Atmospheric haze', 'aerosol_optical_depth', 'average', '', 2],
  ['dust', 'Atmospheric dust', 'dust', 'maximum', 'µg/m³', 0],
  ['wildfirePm10', 'Smoke-related particulate context', 'pm10_wildfires', 'maximum', 'µg/m³', 0],
  ['carbonDioxide', 'CO₂', 'carbon_dioxide', 'average', 'ppm', 0],
  ['ammonia', 'NH₃', 'ammonia', 'average', 'µg/m³', 1],
  ['methane', 'CH₄', 'methane', 'average', 'µg/m³', 0],
  ['nitrogenMonoxide', 'NO', 'nitrogen_monoxide', 'maximum', 'µg/m³', 1],
  ['formaldehyde', 'Formaldehyde', 'formaldehyde', 'maximum', 'µg/m³', 1],
  [
    'nonMethaneVolatileOrganicCompounds',
    'NMVOC',
    'non_methane_volatile_organic_compounds',
    'average',
    'µg/m³',
    0,
  ],
] as const;

const WEATHER_VARIABLES = [
  ['uvIndex', 'UV index', 'uv_index', 'maximum', '', 1],
  ['pressureMsl', 'Mean sea-level pressure', 'pressure_msl', 'average', 'hPa', 0],
  ['surfacePressure', 'Surface pressure', 'surface_pressure', 'average', 'hPa', 0],
  ['extendedVisibility', 'Visibility', 'visibility', 'average', 'm', 0],
  ['cloudCover', 'Cloud cover', 'cloud_cover', 'average', '%', 0],
  ['cloudCoverLow', 'Low cloud cover', 'cloud_cover_low', 'average', '%', 0],
  ['cloudCoverMid', 'Mid cloud cover', 'cloud_cover_mid', 'average', '%', 0],
  ['cloudCoverHigh', 'High cloud cover', 'cloud_cover_high', 'average', '%', 0],
  ['extendedDewPoint', 'Dew point', 'dew_point_2m', 'average', '°C', 1],
  ['wetBulbTemperature', 'Wet-bulb temperature', 'wet_bulb_temperature_2m', 'average', '°C', 1],
  ['extendedWindGusts', 'Wind gusts', 'wind_gusts_10m', 'maximum', 'm/s', 1],
  ['shortwaveRadiation', 'Solar radiation', 'shortwave_radiation', 'maximum', 'W/m²', 0],
  [
    'directNormalIrradiance',
    'Direct normal irradiance',
    'direct_normal_irradiance',
    'maximum',
    'W/m²',
    0,
  ],
  ['diffuseRadiation', 'Diffuse radiation', 'diffuse_radiation', 'maximum', 'W/m²', 0],
  ['sunshineDuration', 'Sunshine duration', 'sunshine_duration', 'sum', 's', 0],
  ['cape', 'CAPE', 'cape', 'maximum', 'J/kg', 0],
] as const;

const MOLD_WEATHER_VARIABLES = [
  'temperature_2m',
  'relative_humidity_2m',
  'dew_point_2m',
  'precipitation',
  'wind_speed_10m',
] as const;

const DETAIL_POLLEN_THRESHOLD_KEYS: Partial<
  Record<EnvironmentalVariableId, keyof typeof POLLEN_THRESHOLDS>
> = {
  pollen_alder: 'alder',
  pollen_birch: 'birch',
  pollen_grass: 'grass',
  pollen_mugwort: 'mugwort',
  pollen_olive: 'olive',
  pollen_ragweed: 'ragweed',
};

const DETAIL_POLLUTANT_THRESHOLD_KEYS: Partial<
  Record<EnvironmentalVariableId, keyof typeof RAW_POLLUTANT_THRESHOLDS>
> = {
  pm25: 'pm25',
  pm10: 'pm10',
  nitrogenDioxide: 'nitrogenDioxide',
  ozone: 'ozone',
  sulphurDioxide: 'sulphurDioxide',
  carbonMonoxide: 'carbonMonoxide',
  aerosolOpticalDepth: 'aerosolOpticalDepth',
  dust: 'dust',
  wildfirePm10: 'wildfirePm10',
};

function airQualityDefinition(
  id: EnvironmentalVariableId,
  label: string,
  openMeteoVariable: string,
  aggregation: DataAggregationStrategy,
  unit: string,
  precision: number,
): DataDetailVariableDefinition {
  return {
    id,
    label,
    provider: 'airQuality',
    openMeteoVariable,
    historyVariables: [openMeteoVariable],
    forecastVariables: [openMeteoVariable],
    aggregation,
    unit,
    precision,
    lowerBound: 0,
    summaryStats: aggregation === 'sum' ? ['maximum'] : ['minimum', 'maximum', 'average'],
    supportsHistory: true,
  };
}

function weatherDefinition(
  id: EnvironmentalVariableId,
  label: string,
  openMeteoVariable: string,
  aggregation: DataAggregationStrategy,
  unit: string,
  precision: number,
): DataDetailVariableDefinition {
  const negativeCapable = id === 'extendedDewPoint' || id === 'wetBulbTemperature';
  const relativeScale = id === 'pressureMsl' || id === 'surfacePressure';

  return {
    id,
    label,
    provider: 'weather',
    openMeteoVariable,
    historyVariables: [openMeteoVariable],
    forecastVariables: [openMeteoVariable],
    aggregation,
    unit,
    precision,
    lowerBound: negativeCapable || relativeScale ? null : 0,
    summaryStats: aggregation === 'sum' ? ['maximum'] : ['minimum', 'maximum', 'average'],
    supportsHistory: true,
  };
}

const VARIABLE_DEFINITIONS: readonly DataDetailVariableDefinition[] = [
  ...POLLEN_VARIABLES.map(([id, label, variable]) =>
    airQualityDefinition(id, label, variable, 'maximum', 'grains/m³', 0),
  ),
  ...AIR_QUALITY_VARIABLES.map(([id, label, variable, aggregation, unit, precision]) =>
    airQualityDefinition(id, label, variable, aggregation, unit, precision),
  ),
  ...WEATHER_VARIABLES.map(([id, label, variable, aggregation, unit, precision]) =>
    weatherDefinition(id, label, variable, aggregation, unit, precision),
  ),
  {
    id: 'moldPotential',
    label: 'Mold potential',
    provider: 'mold',
    openMeteoVariable: null,
    historyVariables: MOLD_WEATHER_VARIABLES,
    forecastVariables: MOLD_WEATHER_VARIABLES,
    aggregation: 'moldPeak',
    unit: '%',
    precision: 0,
    lowerBound: 0,
    summaryStats: ['minimum', 'maximum', 'average'],
    supportsHistory: true,
  },
] as const;

export function dataDetailRange(id: string | undefined): DataDetailRangeDefinition {
  return DATA_DETAIL_RANGES.find((range) => range.id === id) ?? DATA_DETAIL_RANGES[0]!;
}

export function dataDetailVariable(
  id: EnvironmentalVariableId,
): DataDetailVariableDefinition | null {
  return VARIABLE_DEFINITIONS.find((variable) => variable.id === id) ?? null;
}

export function formatDataDetailValue(
  definition: DataDetailVariableDefinition,
  value: number | null,
): string {
  if (definition.id === 'extendedVisibility') {
    return formatVisibilityMeters(value);
  }
  if (definition.id === 'sunshineDuration') {
    return formatDurationSeconds(value);
  }
  if (definition.id === 'uvIndex') {
    return formatNumber(value, '', definition.precision);
  }

  return formatMeasurement(value, definition.unit, definition.precision);
}

export function dataDetailRiskCategory(
  definition: DataDetailVariableDefinition,
  value: number | null,
): RiskCategoryId | null {
  if (!isFiniteNumber(value)) return null;

  if (definition.id === 'moldPotential') {
    return categoryFromScore(value);
  }

  if (definition.id === 'uvIndex') {
    return categoryFromScore(calculateUvBurden(value));
  }

  const pollenKey = DETAIL_POLLEN_THRESHOLD_KEYS[definition.id];
  if (pollenKey) {
    return categoryFromScore(normalizeByThresholds(value, POLLEN_THRESHOLDS[pollenKey]));
  }

  const pollutantKey = DETAIL_POLLUTANT_THRESHOLD_KEYS[definition.id];
  if (pollutantKey) {
    return categoryFromScore(normalizeByThresholds(value, RAW_POLLUTANT_THRESHOLDS[pollutantKey]));
  }

  return null;
}

function pollenKey(id: EnvironmentalVariableId): keyof PollenReadings | null {
  return id.startsWith('pollen_') ? (id.replace('pollen_', '') as keyof PollenReadings) : null;
}

export function currentDataDetailValue(
  current: CurrentEnvironmentalReadings,
  definition: DataDetailVariableDefinition,
): number | null {
  const pollen = pollenKey(definition.id);
  if (pollen) return current.pollen[pollen] ?? null;

  if (definition.id === 'moldPotential') {
    return current.moldPotential.available ? current.moldPotential.score : null;
  }
  if (definition.id === 'uvIndex') return current.uvIndex;

  if (definition.id in current.regulatedPollutants) {
    return current.regulatedPollutants[definition.id as keyof RegulatedPollutants];
  }
  if (definition.id in current.atmosphericIrritants) {
    return current.atmosphericIrritants[definition.id as keyof AtmosphericIrritants];
  }

  const extendedAirQualityId = definition.id as keyof ExtendedAirQualityReadings;
  if (extendedAirQualityId in (current.extended?.airQuality ?? {})) {
    return current.extended?.airQuality[extendedAirQualityId] ?? null;
  }

  const weatherIdByVariable: Partial<
    Record<EnvironmentalVariableId, keyof ExtendedWeatherReadings>
  > = {
    pressureMsl: 'pressureMsl',
    surfacePressure: 'surfacePressure',
    extendedVisibility: 'visibility',
    cloudCover: 'cloudCover',
    cloudCoverLow: 'cloudCoverLow',
    cloudCoverMid: 'cloudCoverMid',
    cloudCoverHigh: 'cloudCoverHigh',
    extendedDewPoint: 'dewPoint',
    wetBulbTemperature: 'wetBulbTemperature',
    extendedWindGusts: 'windGusts',
    shortwaveRadiation: 'shortwaveRadiation',
    directNormalIrradiance: 'directNormalIrradiance',
    diffuseRadiation: 'diffuseRadiation',
    sunshineDuration: 'sunshineDuration',
    cape: 'cape',
  };
  const weatherId = weatherIdByVariable[definition.id];

  return weatherId ? (current.extended?.weather[weatherId] ?? null) : null;
}

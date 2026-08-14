import type { EnvironmentalVariableId } from '../capabilities/types';
import type {
  ActivityDomainId,
  ActivityProfileId,
  ActivitySemanticType,
  ActivitySettings,
  ActivitySuitabilityCategory,
} from '../models/activities';
import type { HourlyEnvironmentalReading } from '../models/environment';
import { isFiniteNumber } from '../utils/number';

export const ACTIVITY_IDS: readonly ActivityDomainId[] = [
  'agriculture',
  'drone_operations',
  'photography',
  'astronomy',
  'outdoor_work',
] as const;

export const DEFAULT_ACTIVITY_SETTINGS: ActivitySettings = {
  agriculture: false,
  drone_operations: false,
  photography: false,
  astronomy: false,
  outdoor_work: false,
};

type ActivityRuleKind = 'highAtLeast' | 'lowAtMost' | 'range' | 'outsideDaylight' | 'goldenHour';

export interface ActivityRuleDefinition {
  id: string;
  label: string;
  variableId?: EnvironmentalVariableId;
  required?: boolean;
  weight: number;
  kind: ActivityRuleKind;
  goodAt?: number;
  poorAt?: number;
  min?: number;
  max?: number;
  hardMaximum?: number;
  hardMinimum?: number;
  positiveText: string;
  negativeText: string;
}

export interface ActivityProfileDefinition {
  id: ActivityProfileId;
  domainId: ActivityDomainId;
  label: string;
  description: string;
  semanticType: ActivitySemanticType;
  requiredVariables: readonly EnvironmentalVariableId[];
  optionalVariables: readonly EnvironmentalVariableId[];
  detailVariables: readonly EnvironmentalVariableId[];
  weatherVariables: readonly string[];
  airQualityVariables: readonly string[];
  minimumUsefulWindowDuration: number;
  rules: readonly ActivityRuleDefinition[];
}

export interface ActivityDomainDefinition {
  id: ActivityDomainId;
  label: string;
  description: string;
  profileIds: readonly ActivityProfileId[];
}

function rule(input: ActivityRuleDefinition): ActivityRuleDefinition {
  return input;
}

const WIND_VARIABLES = ['wind_speed_10m', 'wind_gusts_10m'] as const;
const RAIN_VARIABLES = ['precipitation', 'precipitation_probability'] as const;
const CLOUD_VARIABLES = [
  'cloud_cover',
  'cloud_cover_low',
  'cloud_cover_mid',
  'cloud_cover_high',
] as const;
const LIGHT_VARIABLES = [
  'shortwave_radiation',
  'direct_normal_irradiance',
  'diffuse_radiation',
  'sunshine_duration',
] as const;
const profiles = [
  {
    id: 'agriculture_spraying',
    domainId: 'agriculture',
    label: 'Spraying',
    description: 'Environmental window for spraying-style operations.',
    semanticType: 'suitability',
    requiredVariables: ['windSpeed', 'windGusts', 'precipitation'],
    optionalVariables: ['precipitationProbability', 'temperature', 'relativeHumidity'],
    detailVariables: [
      'windSpeed',
      'windGusts',
      'precipitation',
      'precipitationProbability',
      'temperature',
      'relativeHumidity',
    ],
    weatherVariables: [
      ...WIND_VARIABLES,
      ...RAIN_VARIABLES,
      'temperature_2m',
      'relative_humidity_2m',
    ],
    airQualityVariables: [],
    minimumUsefulWindowDuration: 3,
    rules: [
      rule({
        id: 'wind',
        label: 'Wind',
        variableId: 'windSpeed',
        required: true,
        weight: 2.4,
        kind: 'lowAtMost',
        goodAt: 2.5,
        poorAt: 7,
        hardMaximum: 10,
        positiveText: 'Light wind',
        negativeText: 'Wind too strong',
      }),
      rule({
        id: 'gusts',
        label: 'Wind gusts',
        variableId: 'windGusts',
        required: true,
        weight: 2,
        kind: 'lowAtMost',
        goodAt: 4,
        poorAt: 10,
        hardMaximum: 14,
        positiveText: 'Manageable gusts',
        negativeText: 'Gusts too strong',
      }),
      rule({
        id: 'rain',
        label: 'Rain',
        variableId: 'precipitation',
        required: true,
        weight: 2.4,
        kind: 'lowAtMost',
        goodAt: 0,
        poorAt: 1,
        hardMaximum: 2,
        positiveText: 'No precipitation expected',
        negativeText: 'Rain expected',
      }),
      rule({
        id: 'rainRisk',
        label: 'Rain risk',
        variableId: 'precipitationProbability',
        weight: 1.2,
        kind: 'lowAtMost',
        goodAt: 20,
        poorAt: 75,
        hardMaximum: 90,
        positiveText: 'Low rain risk',
        negativeText: 'Rain risk increases',
      }),
      rule({
        id: 'humidity',
        label: 'Humidity',
        variableId: 'relativeHumidity',
        weight: 0.8,
        kind: 'range',
        min: 45,
        max: 85,
        positiveText: 'Suitable humidity',
        negativeText: 'Humidity less favorable',
      }),
    ],
  },
  {
    id: 'agriculture_irrigation',
    domainId: 'agriculture',
    label: 'Irrigation',
    description: 'Environmental irrigation timing context.',
    semanticType: 'suitability',
    requiredVariables: ['precipitation', 'temperature'],
    optionalVariables: [
      'soilMoisture0To1cm',
      'et0FaoEvapotranspiration',
      'vapourPressureDeficit',
      'relativeHumidity',
      'precipitationProbability',
    ],
    detailVariables: [
      'soilMoisture0To1cm',
      'et0FaoEvapotranspiration',
      'vapourPressureDeficit',
      'precipitation',
      'precipitationProbability',
      'temperature',
      'relativeHumidity',
    ],
    weatherVariables: [
      'precipitation',
      'precipitation_probability',
      'temperature_2m',
      'relative_humidity_2m',
      'soil_moisture_0_1cm',
      'et0_fao_evapotranspiration',
      'vapour_pressure_deficit',
    ],
    airQualityVariables: [],
    minimumUsefulWindowDuration: 2,
    rules: [
      rule({
        id: 'dry',
        label: 'Rain',
        variableId: 'precipitation',
        required: true,
        weight: 1.8,
        kind: 'lowAtMost',
        goodAt: 0,
        poorAt: 3,
        positiveText: 'Dry irrigation window',
        negativeText: 'Rain reduces irrigation need',
      }),
      rule({
        id: 'soilMoisture',
        label: 'Soil moisture',
        variableId: 'soilMoisture0To1cm',
        weight: 2,
        kind: 'lowAtMost',
        goodAt: 0.18,
        poorAt: 0.4,
        positiveText: 'Lower surface soil moisture',
        negativeText: 'Surface soil moisture is higher',
      }),
      rule({
        id: 'et0',
        label: 'ET0',
        variableId: 'et0FaoEvapotranspiration',
        weight: 1.4,
        kind: 'highAtLeast',
        goodAt: 0.22,
        poorAt: 0.02,
        positiveText: 'Higher evapotranspiration context',
        negativeText: 'Low evapotranspiration context',
      }),
      rule({
        id: 'temperature',
        label: 'Temperature',
        variableId: 'temperature',
        required: true,
        weight: 1,
        kind: 'range',
        min: 8,
        max: 32,
        positiveText: 'Temperature supports irrigation timing',
        negativeText: 'Temperature less favorable',
      }),
    ],
  },
  {
    id: 'agriculture_field_work',
    domainId: 'agriculture',
    label: 'Field Work',
    description: 'General field-work environmental suitability.',
    semanticType: 'suitability',
    requiredVariables: ['precipitation', 'temperature', 'windSpeed'],
    optionalVariables: ['soilMoisture0To1cm', 'soilTemperature0cm', 'windGusts'],
    detailVariables: [
      'precipitation',
      'soilMoisture0To1cm',
      'soilTemperature0cm',
      'temperature',
      'windSpeed',
      'windGusts',
    ],
    weatherVariables: [
      'precipitation',
      'temperature_2m',
      'wind_speed_10m',
      'wind_gusts_10m',
      'soil_moisture_0_1cm',
      'soil_temperature_0cm',
    ],
    airQualityVariables: [],
    minimumUsefulWindowDuration: 3,
    rules: [
      rule({
        id: 'rain',
        label: 'Rain',
        variableId: 'precipitation',
        required: true,
        weight: 2,
        kind: 'lowAtMost',
        goodAt: 0,
        poorAt: 4,
        hardMaximum: 10,
        positiveText: 'Dry field-work window',
        negativeText: 'Rain limits field work',
      }),
      rule({
        id: 'soil',
        label: 'Soil moisture',
        variableId: 'soilMoisture0To1cm',
        weight: 1.6,
        kind: 'range',
        min: 0.1,
        max: 0.36,
        positiveText: 'Soil moisture in useful range',
        negativeText: 'Soil moisture less favorable',
      }),
      rule({
        id: 'temperature',
        label: 'Temperature',
        variableId: 'temperature',
        required: true,
        weight: 1.2,
        kind: 'range',
        min: 4,
        max: 30,
        positiveText: 'Workable temperature',
        negativeText: 'Temperature outside preferred range',
      }),
      rule({
        id: 'wind',
        label: 'Wind',
        variableId: 'windSpeed',
        required: true,
        weight: 1,
        kind: 'lowAtMost',
        goodAt: 4,
        poorAt: 12,
        positiveText: 'Manageable wind',
        negativeText: 'High wind',
      }),
    ],
  },
  {
    id: 'agriculture_harvesting',
    domainId: 'agriculture',
    label: 'Harvesting',
    description: 'Dry and stable harvesting-window context.',
    semanticType: 'suitability',
    requiredVariables: ['precipitation', 'relativeHumidity'],
    optionalVariables: ['precipitationProbability', 'temperature', 'windSpeed'],
    detailVariables: [
      'precipitation',
      'precipitationProbability',
      'relativeHumidity',
      'temperature',
      'windSpeed',
    ],
    weatherVariables: [
      'precipitation',
      'precipitation_probability',
      'relative_humidity_2m',
      'temperature_2m',
      'wind_speed_10m',
    ],
    airQualityVariables: [],
    minimumUsefulWindowDuration: 4,
    rules: [
      rule({
        id: 'rain',
        label: 'Rain',
        variableId: 'precipitation',
        required: true,
        weight: 2.5,
        kind: 'lowAtMost',
        goodAt: 0,
        poorAt: 2,
        hardMaximum: 5,
        positiveText: 'Dry harvesting window',
        negativeText: 'Rain expected',
      }),
      rule({
        id: 'humidity',
        label: 'Humidity',
        variableId: 'relativeHumidity',
        required: true,
        weight: 1.8,
        kind: 'lowAtMost',
        goodAt: 55,
        poorAt: 90,
        positiveText: 'Lower humidity',
        negativeText: 'High humidity',
      }),
      rule({
        id: 'rainRisk',
        label: 'Rain risk',
        variableId: 'precipitationProbability',
        weight: 1.3,
        kind: 'lowAtMost',
        goodAt: 15,
        poorAt: 70,
        positiveText: 'Low rain risk',
        negativeText: 'Rain risk increases',
      }),
    ],
  },
  {
    id: 'agriculture_frost_risk',
    domainId: 'agriculture',
    label: 'Frost Risk',
    description: 'Frost-risk context from temperature, dew point, cloud, and wind.',
    semanticType: 'risk',
    requiredVariables: ['temperature'],
    optionalVariables: [
      'dewPoint',
      'wetBulbTemperature',
      'relativeHumidity',
      'cloudCover',
      'windSpeed',
    ],
    detailVariables: [
      'temperature',
      'dewPoint',
      'wetBulbTemperature',
      'relativeHumidity',
      'cloudCover',
      'windSpeed',
    ],
    weatherVariables: [
      'temperature_2m',
      'dew_point_2m',
      'wet_bulb_temperature_2m',
      'relative_humidity_2m',
      'cloud_cover',
      'wind_speed_10m',
    ],
    airQualityVariables: [],
    minimumUsefulWindowDuration: 2,
    rules: [
      rule({
        id: 'temperature',
        label: 'Temperature',
        variableId: 'temperature',
        required: true,
        weight: 3,
        kind: 'lowAtMost',
        goodAt: 0,
        poorAt: 8,
        positiveText: 'Temperature near frost range',
        negativeText: 'Temperature above frost range',
      }),
      rule({
        id: 'dewPoint',
        label: 'Dew point',
        variableId: 'dewPoint',
        weight: 1.4,
        kind: 'lowAtMost',
        goodAt: 0,
        poorAt: 7,
        positiveText: 'Dew point supports frost context',
        negativeText: 'Dew point less concerning',
      }),
      rule({
        id: 'cloud',
        label: 'Cloud cover',
        variableId: 'cloudCover',
        weight: 1,
        kind: 'lowAtMost',
        goodAt: 25,
        poorAt: 90,
        positiveText: 'Clearer sky increases frost context',
        negativeText: 'Cloud cover reduces frost context',
      }),
      rule({
        id: 'wind',
        label: 'Wind',
        variableId: 'windSpeed',
        weight: 0.8,
        kind: 'lowAtMost',
        goodAt: 2,
        poorAt: 8,
        positiveText: 'Light wind supports frost context',
        negativeText: 'Wind reduces frost context',
      }),
    ],
  },
  {
    id: 'drone_general_flight',
    domainId: 'drone_operations',
    label: 'General Flight Conditions',
    description: 'Environmental drone-flight condition guidance.',
    semanticType: 'suitability',
    requiredVariables: ['windSpeed', 'windGusts', 'precipitation', 'extendedVisibility'],
    optionalVariables: ['cloudCover', 'temperature'],
    detailVariables: [
      'windSpeed',
      'windGusts',
      'extendedVisibility',
      'precipitation',
      'cloudCover',
      'temperature',
    ],
    weatherVariables: [
      ...WIND_VARIABLES,
      'precipitation',
      'visibility',
      'cloud_cover',
      'temperature_2m',
    ],
    airQualityVariables: [],
    minimumUsefulWindowDuration: 2,
    rules: [
      rule({
        id: 'wind',
        label: 'Wind',
        variableId: 'windSpeed',
        required: true,
        weight: 2.2,
        kind: 'lowAtMost',
        goodAt: 3,
        poorAt: 9,
        hardMaximum: 14,
        positiveText: 'Low wind',
        negativeText: 'Wind too strong',
      }),
      rule({
        id: 'gusts',
        label: 'Wind gusts',
        variableId: 'windGusts',
        required: true,
        weight: 2.4,
        kind: 'lowAtMost',
        goodAt: 5,
        poorAt: 13,
        hardMaximum: 18,
        positiveText: 'Manageable gusts',
        negativeText: 'Gusts too strong',
      }),
      rule({
        id: 'rain',
        label: 'Rain',
        variableId: 'precipitation',
        required: true,
        weight: 2.4,
        kind: 'lowAtMost',
        goodAt: 0,
        poorAt: 1,
        hardMaximum: 2,
        positiveText: 'No rain expected',
        negativeText: 'Rain expected',
      }),
      rule({
        id: 'visibility',
        label: 'Visibility',
        variableId: 'extendedVisibility',
        required: true,
        weight: 1.4,
        kind: 'highAtLeast',
        goodAt: 10000,
        poorAt: 2000,
        positiveText: 'Good visibility',
        negativeText: 'Reduced visibility',
      }),
    ],
  },
  {
    id: 'drone_aerial_photography',
    domainId: 'drone_operations',
    label: 'Aerial Photography',
    description: 'Drone environmental conditions with outdoor image context.',
    semanticType: 'suitability',
    requiredVariables: ['windSpeed', 'windGusts', 'precipitation', 'extendedVisibility'],
    optionalVariables: ['cloudCover', 'shortwaveRadiation'],
    detailVariables: [
      'windSpeed',
      'windGusts',
      'extendedVisibility',
      'precipitation',
      'cloudCover',
      'shortwaveRadiation',
    ],
    weatherVariables: [
      ...WIND_VARIABLES,
      'precipitation',
      'visibility',
      'cloud_cover',
      'shortwave_radiation',
    ],
    airQualityVariables: [],
    minimumUsefulWindowDuration: 2,
    rules: [
      rule({
        id: 'wind',
        label: 'Wind',
        variableId: 'windSpeed',
        required: true,
        weight: 2,
        kind: 'lowAtMost',
        goodAt: 3,
        poorAt: 8,
        hardMaximum: 13,
        positiveText: 'Low wind',
        negativeText: 'Wind too strong',
      }),
      rule({
        id: 'gusts',
        label: 'Wind gusts',
        variableId: 'windGusts',
        required: true,
        weight: 2,
        kind: 'lowAtMost',
        goodAt: 5,
        poorAt: 12,
        hardMaximum: 17,
        positiveText: 'Manageable gusts',
        negativeText: 'Gusts too strong',
      }),
      rule({
        id: 'rain',
        label: 'Rain',
        variableId: 'precipitation',
        required: true,
        weight: 2,
        kind: 'lowAtMost',
        goodAt: 0,
        poorAt: 1,
        hardMaximum: 2,
        positiveText: 'No rain expected',
        negativeText: 'Rain expected',
      }),
      rule({
        id: 'visibility',
        label: 'Visibility',
        variableId: 'extendedVisibility',
        required: true,
        weight: 1.6,
        kind: 'highAtLeast',
        goodAt: 16000,
        poorAt: 4000,
        positiveText: 'Excellent visibility',
        negativeText: 'Reduced visibility',
      }),
      rule({
        id: 'light',
        label: 'Light window',
        weight: 1,
        kind: 'goldenHour',
        positiveText: 'Favorable outdoor light window',
        negativeText: 'Less favorable light timing',
      }),
    ],
  },
  {
    id: 'drone_survey_mapping',
    domainId: 'drone_operations',
    label: 'Survey / Mapping',
    description: 'Stable environmental window for repeatable drone survey work.',
    semanticType: 'suitability',
    requiredVariables: ['windSpeed', 'windGusts', 'precipitation', 'extendedVisibility'],
    optionalVariables: ['cloudCover'],
    detailVariables: [
      'windSpeed',
      'windGusts',
      'extendedVisibility',
      'precipitation',
      'cloudCover',
    ],
    weatherVariables: [...WIND_VARIABLES, 'precipitation', 'visibility', 'cloud_cover'],
    airQualityVariables: [],
    minimumUsefulWindowDuration: 3,
    rules: [
      rule({
        id: 'wind',
        label: 'Wind',
        variableId: 'windSpeed',
        required: true,
        weight: 2.4,
        kind: 'lowAtMost',
        goodAt: 2.5,
        poorAt: 8,
        hardMaximum: 12,
        positiveText: 'Stable wind',
        negativeText: 'Wind may affect repeatability',
      }),
      rule({
        id: 'gusts',
        label: 'Wind gusts',
        variableId: 'windGusts',
        required: true,
        weight: 2.6,
        kind: 'lowAtMost',
        goodAt: 4,
        poorAt: 11,
        hardMaximum: 16,
        positiveText: 'Stable gust conditions',
        negativeText: 'Gusts may affect repeatability',
      }),
      rule({
        id: 'rain',
        label: 'Rain',
        variableId: 'precipitation',
        required: true,
        weight: 2,
        kind: 'lowAtMost',
        goodAt: 0,
        poorAt: 1,
        hardMaximum: 2,
        positiveText: 'No rain expected',
        negativeText: 'Rain expected',
      }),
      rule({
        id: 'visibility',
        label: 'Visibility',
        variableId: 'extendedVisibility',
        required: true,
        weight: 1,
        kind: 'highAtLeast',
        goodAt: 10000,
        poorAt: 3000,
        positiveText: 'Good visibility',
        negativeText: 'Reduced visibility',
      }),
    ],
  },
  {
    id: 'photography_landscape',
    domainId: 'photography',
    label: 'Landscape',
    description: 'Outdoor landscape photography weather and light context.',
    semanticType: 'suitability',
    requiredVariables: ['extendedVisibility', 'precipitation', 'cloudCover'],
    optionalVariables: [
      'cloudCoverLow',
      'cloudCoverHigh',
      'relativeHumidity',
      'windSpeed',
      'windGusts',
      'shortwaveRadiation',
    ],
    detailVariables: [
      'extendedVisibility',
      'cloudCover',
      'cloudCoverLow',
      'cloudCoverHigh',
      'windSpeed',
      'windGusts',
      'precipitation',
      'relativeHumidity',
      'shortwaveRadiation',
    ],
    weatherVariables: [
      'visibility',
      ...CLOUD_VARIABLES,
      ...WIND_VARIABLES,
      'precipitation',
      'relative_humidity_2m',
      'shortwave_radiation',
    ],
    airQualityVariables: [],
    minimumUsefulWindowDuration: 2,
    rules: [
      rule({
        id: 'visibility',
        label: 'Visibility',
        variableId: 'extendedVisibility',
        required: true,
        weight: 2,
        kind: 'highAtLeast',
        goodAt: 20000,
        poorAt: 5000,
        positiveText: 'Excellent visibility',
        negativeText: 'Reduced visibility',
      }),
      rule({
        id: 'rain',
        label: 'Rain',
        variableId: 'precipitation',
        required: true,
        weight: 2,
        kind: 'lowAtMost',
        goodAt: 0,
        poorAt: 2,
        hardMaximum: 5,
        positiveText: 'No rain expected',
        negativeText: 'Rain expected',
      }),
      rule({
        id: 'cloud',
        label: 'Cloud structure',
        variableId: 'cloudCover',
        required: true,
        weight: 1.4,
        kind: 'range',
        min: 20,
        max: 75,
        positiveText: 'Useful cloud structure',
        negativeText: 'Less favorable cloud cover',
      }),
    ],
  },
  {
    id: 'photography_golden_hour',
    domainId: 'photography',
    label: 'Golden Hour',
    description: 'Promising golden-hour weather window.',
    semanticType: 'suitability',
    requiredVariables: ['extendedVisibility', 'precipitation', 'cloudCover'],
    optionalVariables: ['cloudCoverLow', 'cloudCoverHigh', 'shortwaveRadiation'],
    detailVariables: [
      'extendedVisibility',
      'cloudCover',
      'cloudCoverLow',
      'cloudCoverHigh',
      'precipitation',
      'shortwaveRadiation',
    ],
    weatherVariables: ['visibility', ...CLOUD_VARIABLES, 'precipitation', ...LIGHT_VARIABLES],
    airQualityVariables: [],
    minimumUsefulWindowDuration: 1,
    rules: [
      rule({
        id: 'light',
        label: 'Light window',
        weight: 2.4,
        kind: 'goldenHour',
        positiveText: 'Golden-hour timing',
        negativeText: 'Outside golden-hour window',
      }),
      rule({
        id: 'visibility',
        label: 'Visibility',
        variableId: 'extendedVisibility',
        required: true,
        weight: 1.8,
        kind: 'highAtLeast',
        goodAt: 16000,
        poorAt: 4000,
        positiveText: 'Good visibility',
        negativeText: 'Reduced visibility',
      }),
      rule({
        id: 'rain',
        label: 'Rain',
        variableId: 'precipitation',
        required: true,
        weight: 2,
        kind: 'lowAtMost',
        goodAt: 0,
        poorAt: 1,
        hardMaximum: 3,
        positiveText: 'No rain expected',
        negativeText: 'Rain expected',
      }),
      rule({
        id: 'cloud',
        label: 'Cloud structure',
        variableId: 'cloudCover',
        required: true,
        weight: 1.2,
        kind: 'range',
        min: 15,
        max: 70,
        positiveText: 'Useful cloud structure',
        negativeText: 'Less favorable cloud cover',
      }),
    ],
  },
  {
    id: 'photography_macro',
    domainId: 'photography',
    label: 'Macro',
    description: 'Small-subject outdoor photography conditions.',
    semanticType: 'suitability',
    requiredVariables: ['windSpeed', 'windGusts', 'precipitation'],
    optionalVariables: ['relativeHumidity', 'shortwaveRadiation'],
    detailVariables: [
      'windSpeed',
      'windGusts',
      'precipitation',
      'relativeHumidity',
      'shortwaveRadiation',
    ],
    weatherVariables: [
      ...WIND_VARIABLES,
      'precipitation',
      'relative_humidity_2m',
      'shortwave_radiation',
    ],
    airQualityVariables: [],
    minimumUsefulWindowDuration: 1,
    rules: [
      rule({
        id: 'wind',
        label: 'Wind',
        variableId: 'windSpeed',
        required: true,
        weight: 2.4,
        kind: 'lowAtMost',
        goodAt: 1.5,
        poorAt: 6,
        hardMaximum: 9,
        positiveText: 'Very light wind',
        negativeText: 'Wind may move small subjects',
      }),
      rule({
        id: 'gusts',
        label: 'Wind gusts',
        variableId: 'windGusts',
        required: true,
        weight: 2.2,
        kind: 'lowAtMost',
        goodAt: 3,
        poorAt: 8,
        hardMaximum: 12,
        positiveText: 'Low gusts',
        negativeText: 'Gusts may affect macro work',
      }),
      rule({
        id: 'rain',
        label: 'Rain',
        variableId: 'precipitation',
        required: true,
        weight: 2,
        kind: 'lowAtMost',
        goodAt: 0,
        poorAt: 1,
        hardMaximum: 3,
        positiveText: 'No rain expected',
        negativeText: 'Rain expected',
      }),
    ],
  },
  {
    id: 'astronomy_stargazing',
    domainId: 'astronomy',
    label: 'Stargazing',
    description: 'General stargazing weather and darkness context.',
    semanticType: 'suitability',
    requiredVariables: ['cloudCover', 'precipitation'],
    optionalVariables: [
      'relativeHumidity',
      'dewPoint',
      'extendedVisibility',
      'windSpeed',
      'cloudCoverLow',
      'cloudCoverHigh',
    ],
    detailVariables: [
      'cloudCover',
      'cloudCoverLow',
      'cloudCoverHigh',
      'relativeHumidity',
      'dewPoint',
      'extendedVisibility',
      'windSpeed',
      'precipitation',
    ],
    weatherVariables: [
      ...CLOUD_VARIABLES,
      'relative_humidity_2m',
      'dew_point_2m',
      'visibility',
      'wind_speed_10m',
      'precipitation',
    ],
    airQualityVariables: [],
    minimumUsefulWindowDuration: 2,
    rules: [
      rule({
        id: 'cloud',
        label: 'Cloud cover',
        variableId: 'cloudCover',
        required: true,
        weight: 3,
        kind: 'lowAtMost',
        goodAt: 10,
        poorAt: 70,
        hardMaximum: 95,
        positiveText: 'Clear sky',
        negativeText: 'Cloud cover limits sky visibility',
      }),
      rule({
        id: 'rain',
        label: 'Rain',
        variableId: 'precipitation',
        required: true,
        weight: 2,
        kind: 'lowAtMost',
        goodAt: 0,
        poorAt: 1,
        hardMaximum: 2,
        positiveText: 'No precipitation expected',
        negativeText: 'Precipitation expected',
      }),
      rule({
        id: 'humidity',
        label: 'Humidity',
        variableId: 'relativeHumidity',
        weight: 1,
        kind: 'lowAtMost',
        goodAt: 55,
        poorAt: 95,
        positiveText: 'Lower humidity',
        negativeText: 'High humidity',
      }),
      rule({
        id: 'darkness',
        label: 'Darkness',
        weight: 2,
        kind: 'outsideDaylight',
        positiveText: 'Nighttime window',
        negativeText: 'Daylight limits astronomy use',
      }),
    ],
  },
  {
    id: 'astronomy_astrophotography',
    domainId: 'astronomy',
    label: 'Astrophotography',
    description: 'Longer, stricter nighttime imaging-condition window.',
    semanticType: 'suitability',
    requiredVariables: ['cloudCover', 'precipitation'],
    optionalVariables: [
      'relativeHumidity',
      'dewPoint',
      'extendedVisibility',
      'windSpeed',
      'windGusts',
      'cloudCoverLow',
      'cloudCoverHigh',
    ],
    detailVariables: [
      'cloudCover',
      'cloudCoverLow',
      'cloudCoverHigh',
      'relativeHumidity',
      'dewPoint',
      'extendedVisibility',
      'windSpeed',
      'windGusts',
      'precipitation',
    ],
    weatherVariables: [
      ...CLOUD_VARIABLES,
      'relative_humidity_2m',
      'dew_point_2m',
      'visibility',
      ...WIND_VARIABLES,
      'precipitation',
    ],
    airQualityVariables: [],
    minimumUsefulWindowDuration: 4,
    rules: [
      rule({
        id: 'cloud',
        label: 'Cloud cover',
        variableId: 'cloudCover',
        required: true,
        weight: 3.2,
        kind: 'lowAtMost',
        goodAt: 5,
        poorAt: 50,
        hardMaximum: 85,
        positiveText: 'Very low cloud cover',
        negativeText: 'Cloud cover limits imaging',
      }),
      rule({
        id: 'rain',
        label: 'Rain',
        variableId: 'precipitation',
        required: true,
        weight: 2.6,
        kind: 'lowAtMost',
        goodAt: 0,
        poorAt: 0.5,
        hardMaximum: 1,
        positiveText: 'No precipitation expected',
        negativeText: 'Precipitation expected',
      }),
      rule({
        id: 'humidity',
        label: 'Humidity',
        variableId: 'relativeHumidity',
        weight: 1.4,
        kind: 'lowAtMost',
        goodAt: 50,
        poorAt: 90,
        positiveText: 'Lower humidity',
        negativeText: 'Dew risk increases',
      }),
      rule({
        id: 'darkness',
        label: 'Darkness',
        weight: 2.5,
        kind: 'outsideDaylight',
        positiveText: 'Nighttime window',
        negativeText: 'Daylight limits astrophotography',
      }),
    ],
  },
  {
    id: 'outdoor_work_construction',
    domainId: 'outdoor_work',
    label: 'Construction',
    description: 'General outdoor construction weather context.',
    semanticType: 'suitability',
    requiredVariables: ['temperature', 'precipitation', 'windSpeed'],
    optionalVariables: ['windGusts', 'apparentTemperature'],
    detailVariables: [
      'precipitation',
      'windSpeed',
      'windGusts',
      'temperature',
      'apparentTemperature',
    ],
    weatherVariables: [
      'precipitation',
      ...WIND_VARIABLES,
      'temperature_2m',
      'apparent_temperature',
    ],
    airQualityVariables: [],
    minimumUsefulWindowDuration: 3,
    rules: [
      rule({
        id: 'rain',
        label: 'Rain',
        variableId: 'precipitation',
        required: true,
        weight: 1.8,
        kind: 'lowAtMost',
        goodAt: 0,
        poorAt: 4,
        hardMaximum: 10,
        positiveText: 'Dry work window',
        negativeText: 'Rain expected',
      }),
      rule({
        id: 'wind',
        label: 'Wind',
        variableId: 'windSpeed',
        required: true,
        weight: 1.5,
        kind: 'lowAtMost',
        goodAt: 4,
        poorAt: 14,
        positiveText: 'Manageable wind',
        negativeText: 'Strong wind',
      }),
      rule({
        id: 'temperature',
        label: 'Temperature',
        variableId: 'temperature',
        required: true,
        weight: 1.4,
        kind: 'range',
        min: 3,
        max: 31,
        positiveText: 'Workable temperature',
        negativeText: 'Temperature stress possible',
      }),
    ],
  },
  {
    id: 'outdoor_work_at_height',
    domainId: 'outdoor_work',
    label: 'Work at Height',
    description: 'Stricter wind, gust, and precipitation context for elevated work.',
    semanticType: 'suitability',
    requiredVariables: ['windSpeed', 'windGusts', 'precipitation'],
    optionalVariables: ['temperature'],
    detailVariables: ['windSpeed', 'windGusts', 'precipitation', 'temperature'],
    weatherVariables: [...WIND_VARIABLES, 'precipitation', 'temperature_2m'],
    airQualityVariables: [],
    minimumUsefulWindowDuration: 2,
    rules: [
      rule({
        id: 'wind',
        label: 'Wind',
        variableId: 'windSpeed',
        required: true,
        weight: 2.4,
        kind: 'lowAtMost',
        goodAt: 3,
        poorAt: 9,
        hardMaximum: 12,
        positiveText: 'Lower wind',
        negativeText: 'Strong wind expected',
      }),
      rule({
        id: 'gusts',
        label: 'Wind gusts',
        variableId: 'windGusts',
        required: true,
        weight: 2.6,
        kind: 'lowAtMost',
        goodAt: 5,
        poorAt: 11,
        hardMaximum: 15,
        positiveText: 'Manageable gusts',
        negativeText: 'Strong gusts expected',
      }),
      rule({
        id: 'rain',
        label: 'Rain',
        variableId: 'precipitation',
        required: true,
        weight: 2,
        kind: 'lowAtMost',
        goodAt: 0,
        poorAt: 1,
        hardMaximum: 2,
        positiveText: 'No rain expected',
        negativeText: 'Rain expected',
      }),
    ],
  },
  {
    id: 'outdoor_work_painting',
    domainId: 'outdoor_work',
    label: 'Outdoor Painting',
    description: 'Dry, moderate outdoor painting weather context.',
    semanticType: 'suitability',
    requiredVariables: ['precipitation', 'relativeHumidity', 'temperature'],
    optionalVariables: ['precipitationProbability', 'dewPoint', 'windSpeed'],
    detailVariables: [
      'precipitation',
      'precipitationProbability',
      'relativeHumidity',
      'temperature',
      'dewPoint',
      'windSpeed',
    ],
    weatherVariables: [
      'precipitation',
      'precipitation_probability',
      'relative_humidity_2m',
      'temperature_2m',
      'dew_point_2m',
      'wind_speed_10m',
    ],
    airQualityVariables: [],
    minimumUsefulWindowDuration: 3,
    rules: [
      rule({
        id: 'rain',
        label: 'Rain',
        variableId: 'precipitation',
        required: true,
        weight: 2.4,
        kind: 'lowAtMost',
        goodAt: 0,
        poorAt: 1,
        hardMaximum: 3,
        positiveText: 'Dry painting window',
        negativeText: 'Rain expected',
      }),
      rule({
        id: 'humidity',
        label: 'Humidity',
        variableId: 'relativeHumidity',
        required: true,
        weight: 1.6,
        kind: 'lowAtMost',
        goodAt: 55,
        poorAt: 90,
        positiveText: 'Humidity in useful range',
        negativeText: 'High humidity',
      }),
      rule({
        id: 'temperature',
        label: 'Temperature',
        variableId: 'temperature',
        required: true,
        weight: 1.4,
        kind: 'range',
        min: 10,
        max: 28,
        positiveText: 'Temperature in useful range',
        negativeText: 'Temperature less favorable',
      }),
    ],
  },
  {
    id: 'outdoor_work_heat_exposure',
    domainId: 'outdoor_work',
    label: 'Heat Exposure',
    description: 'Environmental heat-exposure context for outdoor work.',
    semanticType: 'risk',
    requiredVariables: ['temperature'],
    optionalVariables: ['apparentTemperature', 'relativeHumidity', 'shortwaveRadiation', 'uvIndex'],
    detailVariables: [
      'temperature',
      'apparentTemperature',
      'relativeHumidity',
      'shortwaveRadiation',
      'uvIndex',
    ],
    weatherVariables: [
      'temperature_2m',
      'apparent_temperature',
      'relative_humidity_2m',
      'shortwave_radiation',
      'uv_index',
    ],
    airQualityVariables: [],
    minimumUsefulWindowDuration: 2,
    rules: [
      rule({
        id: 'temperature',
        label: 'Temperature',
        variableId: 'temperature',
        required: true,
        weight: 2,
        kind: 'highAtLeast',
        goodAt: 32,
        poorAt: 20,
        positiveText: 'Higher heat exposure',
        negativeText: 'Lower heat exposure',
      }),
      rule({
        id: 'apparentTemperature',
        label: 'Apparent temperature',
        variableId: 'apparentTemperature',
        weight: 2,
        kind: 'highAtLeast',
        goodAt: 35,
        poorAt: 22,
        positiveText: 'Apparent temperature is elevated',
        negativeText: 'Apparent temperature is lower',
      }),
      rule({
        id: 'humidity',
        label: 'Humidity',
        variableId: 'relativeHumidity',
        weight: 1.2,
        kind: 'highAtLeast',
        goodAt: 80,
        poorAt: 45,
        positiveText: 'Humidity increases heat burden',
        negativeText: 'Humidity less concerning',
      }),
      rule({
        id: 'radiation',
        label: 'Solar radiation',
        variableId: 'shortwaveRadiation',
        weight: 1.2,
        kind: 'highAtLeast',
        goodAt: 700,
        poorAt: 150,
        positiveText: 'Solar radiation is elevated',
        negativeText: 'Solar radiation is lower',
      }),
    ],
  },
] as const satisfies readonly ActivityProfileDefinition[];

const ACTIVITY_PROFILE_DEFINITIONS: readonly ActivityProfileDefinition[] = profiles;

export const ACTIVITY_DEFINITIONS: readonly ActivityProfileDefinition[] =
  ACTIVITY_PROFILE_DEFINITIONS;

export const ACTIVITY_DOMAINS: readonly ActivityDomainDefinition[] = [
  {
    id: 'agriculture',
    label: 'Agriculture',
    description: 'Environmental tools for field operations and frost-risk context.',
    profileIds: [
      'agriculture_spraying',
      'agriculture_irrigation',
      'agriculture_field_work',
      'agriculture_harvesting',
      'agriculture_frost_risk',
    ],
  },
  {
    id: 'drone_operations',
    label: 'Drone Operations',
    description: 'Environmental decision support for drone operation profiles.',
    profileIds: ['drone_general_flight', 'drone_aerial_photography', 'drone_survey_mapping'],
  },
  {
    id: 'photography',
    label: 'Photography',
    description: 'Outdoor photography weather and light profiles.',
    profileIds: ['photography_landscape', 'photography_golden_hour', 'photography_macro'],
  },
  {
    id: 'astronomy',
    label: 'Astronomy',
    description: 'Night-sky viewing and imaging condition profiles.',
    profileIds: ['astronomy_stargazing', 'astronomy_astrophotography'],
  },
  {
    id: 'outdoor_work',
    label: 'Outdoor Work',
    description: 'Outdoor work environmental profiles.',
    profileIds: [
      'outdoor_work_construction',
      'outdoor_work_at_height',
      'outdoor_work_painting',
      'outdoor_work_heat_exposure',
    ],
  },
] as const;

export function activityDomain(id: ActivityDomainId): ActivityDomainDefinition | null {
  return ACTIVITY_DOMAINS.find((definition) => definition.id === id) ?? null;
}

export function activityProfile(id: ActivityProfileId): ActivityProfileDefinition | null {
  return ACTIVITY_PROFILE_DEFINITIONS.find((definition) => definition.id === id) ?? null;
}

export function activityProfilesForDomain(domainId: ActivityDomainId): ActivityProfileDefinition[] {
  const domain = activityDomain(domainId);
  if (!domain) return [];

  return domain.profileIds.flatMap((profileId) => {
    const definition = activityProfile(profileId);
    return definition ? [definition] : [];
  });
}

export function enabledActivityIds(settings: ActivitySettings): ActivityDomainId[] {
  return ACTIVITY_IDS.filter((id) => settings[id]);
}

export function enabledActivityProfiles(settings: ActivitySettings): ActivityProfileDefinition[] {
  const enabled = new Set(enabledActivityIds(settings));
  return ACTIVITY_PROFILE_DEFINITIONS.filter((definition) => enabled.has(definition.domainId));
}

export function categoryForActivityScore(score: number | null): ActivitySuitabilityCategory {
  if (!isFiniteNumber(score)) return 'insufficientData';
  if (score >= 85) return 'excellent';
  if (score >= 70) return 'good';
  if (score >= 50) return 'fair';
  if (score >= 30) return 'poor';
  return 'unsuitable';
}

export function activityCategoryLabel(
  category: ActivitySuitabilityCategory,
  semanticType: ActivitySemanticType = 'suitability',
): string {
  if (semanticType === 'risk') {
    switch (category) {
      case 'excellent':
        return 'Very High';
      case 'good':
        return 'High';
      case 'fair':
        return 'Moderate';
      case 'poor':
        return 'Low';
      case 'unsuitable':
        return 'Very Low';
      case 'insufficientData':
        return 'Insufficient data';
    }
  }

  switch (category) {
    case 'excellent':
      return 'Excellent';
    case 'good':
      return 'Good';
    case 'fair':
      return 'Fair';
    case 'poor':
      return 'Poor';
    case 'unsuitable':
      return 'Unsuitable';
    case 'insufficientData':
      return 'Insufficient data';
  }
}

export function activityOpenMeteoVariables(activityIds: readonly ActivityDomainId[]): {
  weather: string[];
  airQuality: string[];
} {
  const definitions = activityIds.flatMap((id) => activityProfilesForDomain(id));

  return {
    weather: Array.from(new Set(definitions.flatMap((definition) => definition.weatherVariables))),
    airQuality: Array.from(
      new Set(definitions.flatMap((definition) => definition.airQualityVariables)),
    ),
  };
}

export function activityVariableValue(
  reading: HourlyEnvironmentalReading,
  variableId: EnvironmentalVariableId,
): number | null {
  switch (variableId) {
    case 'temperature':
      return reading.weather.temperature;
    case 'apparentTemperature':
      return reading.extended?.weather.apparentTemperature ?? null;
    case 'relativeHumidity':
      return reading.weather.relativeHumidity;
    case 'dewPoint':
    case 'extendedDewPoint':
      return reading.weather.dewPoint ?? reading.extended?.weather.dewPoint ?? null;
    case 'precipitation':
      return reading.weather.precipitation;
    case 'precipitationProbability':
      return reading.extended?.weather.precipitationProbability ?? null;
    case 'windSpeed':
      return reading.weather.windSpeed;
    case 'windGusts':
    case 'extendedWindGusts':
      return reading.weather.windGusts ?? reading.extended?.weather.windGusts ?? null;
    case 'extendedVisibility':
      return reading.weather.visibility ?? reading.extended?.weather.visibility ?? null;
    case 'cloudCover':
      return reading.extended?.weather.cloudCover ?? null;
    case 'cloudCoverLow':
      return reading.extended?.weather.cloudCoverLow ?? null;
    case 'cloudCoverMid':
      return reading.extended?.weather.cloudCoverMid ?? null;
    case 'cloudCoverHigh':
      return reading.extended?.weather.cloudCoverHigh ?? null;
    case 'shortwaveRadiation':
      return reading.extended?.weather.shortwaveRadiation ?? null;
    case 'soilMoisture0To1cm':
      return reading.extended?.weather.soilMoisture0To1cm ?? null;
    case 'soilTemperature0cm':
      return reading.extended?.weather.soilTemperature0cm ?? null;
    case 'et0FaoEvapotranspiration':
      return reading.extended?.weather.et0FaoEvapotranspiration ?? null;
    case 'vapourPressureDeficit':
      return reading.extended?.weather.vapourPressureDeficit ?? null;
    case 'wetBulbTemperature':
      return reading.extended?.weather.wetBulbTemperature ?? null;
    case 'uvIndex':
      return reading.uvIndex;
    case 'pm25':
      return reading.regulatedPollutants.pm25;
    case 'ozone':
      return reading.regulatedPollutants.ozone;
    default:
      return null;
  }
}

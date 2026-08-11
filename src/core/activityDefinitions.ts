import type { EnvironmentalVariableId } from '../capabilities/types';
import type {
  ActivityId,
  ActivitySettings,
  ActivitySuitabilityCategory,
} from '../models/activities';
import type { HourlyEnvironmentalReading } from '../models/environment';
import { isFiniteNumber } from '../utils/number';

export const ACTIVITY_IDS: readonly ActivityId[] = [
  'photography',
  'astronomy',
  'farming',
  'drone',
  'outdoor_sports',
  'outdoor_work',
] as const;

export const DEFAULT_ACTIVITY_SETTINGS: ActivitySettings = {
  photography: false,
  astronomy: false,
  farming: false,
  drone: false,
  outdoor_sports: false,
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

export interface ActivityDefinition {
  id: ActivityId;
  label: string;
  description: string;
  requiredVariables: readonly EnvironmentalVariableId[];
  optionalVariables: readonly EnvironmentalVariableId[];
  detailVariables: readonly EnvironmentalVariableId[];
  weatherVariables: readonly string[];
  airQualityVariables: readonly string[];
  windowHours: number;
  disclaimer?: string;
  rules: readonly ActivityRuleDefinition[];
}

function rule(
  input: Omit<ActivityRuleDefinition, 'required'> & { required?: boolean },
): ActivityRuleDefinition {
  return input;
}

export const ACTIVITY_DEFINITIONS: readonly ActivityDefinition[] = [
  {
    id: 'photography',
    label: 'Photography',
    description: 'Outdoor light, visibility, wind, rain, and cloud context.',
    requiredVariables: ['extendedVisibility', 'precipitation', 'cloudCover', 'windSpeed'],
    optionalVariables: [
      'cloudCoverLow',
      'cloudCoverHigh',
      'relativeHumidity',
      'shortwaveRadiation',
      'windGusts',
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
      'cloud_cover',
      'cloud_cover_low',
      'cloud_cover_high',
      'wind_speed_10m',
      'wind_gusts_10m',
      'precipitation',
      'relative_humidity_2m',
      'shortwave_radiation',
    ],
    airQualityVariables: [],
    windowHours: 2,
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
      rule({
        id: 'wind',
        label: 'Wind',
        variableId: 'windSpeed',
        required: true,
        weight: 1,
        kind: 'lowAtMost',
        goodAt: 3,
        poorAt: 10,
        positiveText: 'Light wind',
        negativeText: 'Wind may affect setup',
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
    id: 'astronomy',
    label: 'Astronomy',
    description: 'Cloud, precipitation, humidity, dew point, wind, and darkness context.',
    requiredVariables: ['cloudCover', 'precipitation'],
    optionalVariables: [
      'cloudCoverLow',
      'cloudCoverHigh',
      'relativeHumidity',
      'dewPoint',
      'extendedVisibility',
      'windSpeed',
      'windGusts',
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
      'cloud_cover',
      'cloud_cover_low',
      'cloud_cover_high',
      'relative_humidity_2m',
      'dew_point_2m',
      'visibility',
      'wind_speed_10m',
      'wind_gusts_10m',
      'precipitation',
    ],
    airQualityVariables: [],
    windowHours: 3,
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
    disclaimer: 'Environmental guidance only. This is not an observatory-grade seeing forecast.',
  },
  {
    id: 'farming',
    label: 'Farming',
    description: 'General field-work weather, soil moisture, radiation, wind, and rain context.',
    requiredVariables: ['precipitation', 'windSpeed', 'temperature'],
    optionalVariables: [
      'soilMoisture0To1cm',
      'soilTemperature0cm',
      'et0FaoEvapotranspiration',
      'vapourPressureDeficit',
      'relativeHumidity',
      'shortwaveRadiation',
      'windGusts',
    ],
    detailVariables: [
      'precipitation',
      'soilMoisture0To1cm',
      'soilTemperature0cm',
      'et0FaoEvapotranspiration',
      'vapourPressureDeficit',
      'temperature',
      'relativeHumidity',
      'windSpeed',
      'windGusts',
      'shortwaveRadiation',
    ],
    weatherVariables: [
      'precipitation',
      'wind_speed_10m',
      'wind_gusts_10m',
      'temperature_2m',
      'relative_humidity_2m',
      'soil_moisture_0_1cm',
      'soil_temperature_0cm',
      'et0_fao_evapotranspiration',
      'vapour_pressure_deficit',
      'shortwave_radiation',
    ],
    airQualityVariables: [],
    windowHours: 3,
    disclaimer:
      'General field-work context only. This does not provide pesticide, chemical, or crop-specific safety guidance.',
    rules: [
      rule({
        id: 'rain',
        label: 'Rain',
        variableId: 'precipitation',
        required: true,
        weight: 2,
        kind: 'lowAtMost',
        goodAt: 0,
        poorAt: 3,
        hardMaximum: 8,
        positiveText: 'Dry field-work window',
        negativeText: 'Rain limits field work',
      }),
      rule({
        id: 'wind',
        label: 'Wind',
        variableId: 'windSpeed',
        required: true,
        weight: 1.4,
        kind: 'lowAtMost',
        goodAt: 3,
        poorAt: 10,
        positiveText: 'Low wind',
        negativeText: 'High wind',
      }),
      rule({
        id: 'temperature',
        label: 'Temperature',
        variableId: 'temperature',
        required: true,
        weight: 1,
        kind: 'range',
        min: 5,
        max: 30,
        positiveText: 'Workable temperature',
        negativeText: 'Temperature outside preferred range',
      }),
      rule({
        id: 'soil',
        label: 'Soil moisture',
        variableId: 'soilMoisture0To1cm',
        weight: 1,
        kind: 'range',
        min: 0.12,
        max: 0.38,
        positiveText: 'Soil moisture in useful range',
        negativeText: 'Soil moisture less favorable',
      }),
    ],
  },
  {
    id: 'drone',
    label: 'Drone Flying',
    description: 'Wind, gusts, precipitation, visibility, cloud, and temperature context.',
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
      'wind_speed_10m',
      'wind_gusts_10m',
      'precipitation',
      'visibility',
      'cloud_cover',
      'temperature_2m',
    ],
    airQualityVariables: [],
    windowHours: 2,
    disclaimer:
      'Environmental guidance only. Follow local aviation rules, manufacturer limits, and operator judgment.',
    rules: [
      rule({
        id: 'wind',
        label: 'Wind',
        variableId: 'windSpeed',
        required: true,
        weight: 2,
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
        weight: 2,
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
    id: 'outdoor_sports',
    label: 'Outdoor Sports',
    description: 'Training conditions from temperature, rain, wind, UV, and air quality.',
    requiredVariables: ['temperature', 'precipitation', 'windSpeed'],
    optionalVariables: [
      'apparentTemperature',
      'relativeHumidity',
      'windGusts',
      'uvIndex',
      'pm25',
      'ozone',
    ],
    detailVariables: [
      'temperature',
      'apparentTemperature',
      'relativeHumidity',
      'windSpeed',
      'windGusts',
      'precipitation',
      'uvIndex',
      'pm25',
      'ozone',
    ],
    weatherVariables: [
      'temperature_2m',
      'apparent_temperature',
      'relative_humidity_2m',
      'wind_speed_10m',
      'wind_gusts_10m',
      'precipitation',
      'uv_index',
    ],
    airQualityVariables: ['pm2_5', 'ozone'],
    windowHours: 2,
    rules: [
      rule({
        id: 'temperature',
        label: 'Temperature',
        variableId: 'temperature',
        required: true,
        weight: 1.4,
        kind: 'range',
        min: 8,
        max: 26,
        positiveText: 'Comfortable temperature',
        negativeText: 'Temperature less favorable',
      }),
      rule({
        id: 'rain',
        label: 'Rain',
        variableId: 'precipitation',
        required: true,
        weight: 1.6,
        kind: 'lowAtMost',
        goodAt: 0,
        poorAt: 3,
        positiveText: 'Dry conditions',
        negativeText: 'Rain expected',
      }),
      rule({
        id: 'wind',
        label: 'Wind',
        variableId: 'windSpeed',
        required: true,
        weight: 1,
        kind: 'lowAtMost',
        goodAt: 3,
        poorAt: 12,
        positiveText: 'Manageable wind',
        negativeText: 'Wind may affect activity',
      }),
      rule({
        id: 'uv',
        label: 'UV',
        variableId: 'uvIndex',
        weight: 1,
        kind: 'lowAtMost',
        goodAt: 2,
        poorAt: 9,
        positiveText: 'Lower UV',
        negativeText: 'High UV',
      }),
      rule({
        id: 'pm25',
        label: 'PM2.5',
        variableId: 'pm25',
        weight: 1,
        kind: 'lowAtMost',
        goodAt: 10,
        poorAt: 35,
        positiveText: 'Lower PM2.5',
        negativeText: 'Elevated PM2.5',
      }),
    ],
  },
  {
    id: 'outdoor_work',
    label: 'Outdoor Work',
    description: 'General outdoor work context from rain, wind, heat, humidity, and radiation.',
    requiredVariables: ['temperature', 'precipitation', 'windSpeed'],
    optionalVariables: [
      'apparentTemperature',
      'relativeHumidity',
      'windGusts',
      'uvIndex',
      'shortwaveRadiation',
    ],
    detailVariables: [
      'precipitation',
      'windSpeed',
      'windGusts',
      'temperature',
      'apparentTemperature',
      'relativeHumidity',
      'uvIndex',
      'shortwaveRadiation',
    ],
    weatherVariables: [
      'precipitation',
      'wind_speed_10m',
      'wind_gusts_10m',
      'temperature_2m',
      'apparent_temperature',
      'relative_humidity_2m',
      'uv_index',
      'shortwave_radiation',
    ],
    airQualityVariables: [],
    windowHours: 2,
    disclaimer: 'Environmental guidance only. This is not occupational safety certification.',
    rules: [
      rule({
        id: 'rain',
        label: 'Rain',
        variableId: 'precipitation',
        required: true,
        weight: 1.6,
        kind: 'lowAtMost',
        goodAt: 0,
        poorAt: 3,
        positiveText: 'Dry work window',
        negativeText: 'Rain expected',
      }),
      rule({
        id: 'wind',
        label: 'Wind',
        variableId: 'windSpeed',
        required: true,
        weight: 1.4,
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
        min: 4,
        max: 30,
        positiveText: 'Workable temperature',
        negativeText: 'Temperature stress possible',
      }),
      rule({
        id: 'uv',
        label: 'UV',
        variableId: 'uvIndex',
        weight: 1,
        kind: 'lowAtMost',
        goodAt: 2,
        poorAt: 9,
        positiveText: 'Lower UV',
        negativeText: 'High UV',
      }),
    ],
  },
] as const;

export function activityDefinition(id: ActivityId): ActivityDefinition | null {
  return ACTIVITY_DEFINITIONS.find((definition) => definition.id === id) ?? null;
}

export function enabledActivityIds(settings: ActivitySettings): ActivityId[] {
  return ACTIVITY_IDS.filter((id) => settings[id]);
}

export function categoryForActivityScore(score: number | null): ActivitySuitabilityCategory {
  if (!isFiniteNumber(score)) return 'insufficientData';
  if (score >= 85) return 'excellent';
  if (score >= 70) return 'good';
  if (score >= 50) return 'fair';
  if (score >= 30) return 'poor';
  return 'unsuitable';
}

export function activityCategoryLabel(category: ActivitySuitabilityCategory): string {
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

export function activityOpenMeteoVariables(activityIds: readonly ActivityId[]): {
  weather: string[];
  airQuality: string[];
} {
  const definitions = activityIds.flatMap((id) => {
    const definition = activityDefinition(id);
    return definition ? [definition] : [];
  });

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

import { FORECAST_DAY_LIMITS } from '../capabilities/config';
import { activityOpenMeteoVariables } from '../core/activityDefinitions';
import type { ActivityDomainId } from '../models/activities';
import type { Coordinates, ExtendedWeatherReadings, WeatherContext } from '../models/environment';
import { fetchJson } from './http';
import { coordinateNumber, isFiniteNumber, nullableNumber } from '../utils/number';
import { timestampWithUtcOffset } from '../utils/time';

const WEATHER_URL = 'https://api.open-meteo.com/v1/forecast';
const BASE_VARIABLES = [
  'temperature_2m',
  'relative_humidity_2m',
  'dew_point_2m',
  'precipitation',
  'wind_speed_10m',
  'wind_direction_10m',
  'wind_gusts_10m',
  'visibility',
  'uv_index',
] as const;
const DEFAULT_EXTENDED_VARIABLES = [
  'pressure_msl',
  'surface_pressure',
  'cloud_cover',
  'cloud_cover_low',
  'cloud_cover_mid',
  'cloud_cover_high',
  'wet_bulb_temperature_2m',
  'shortwave_radiation',
  'direct_normal_irradiance',
  'diffuse_radiation',
  'sunshine_duration',
  'cape',
] as const;
const DAILY_VARIABLES = [
  'leaf_wetness_probability_mean',
  'temperature_2m_mean',
  'relative_humidity_2m_mean',
  'precipitation_sum',
  'wind_speed_10m_mean',
];

type OpenMeteoWeatherPayload = Record<string, unknown> & {
  latitude?: unknown;
  longitude?: unknown;
  timezone?: unknown;
  utc_offset_seconds?: unknown;
  current?: Record<string, unknown>;
  hourly?: Record<string, unknown>;
  daily?: Record<string, unknown>;
};

export interface NormalizedWeather {
  coordinates: Coordinates;
  fetchedAt: string;
  timezone: string | null;
  current: WeatherContext & {
    timestamp: string | null;
    uvIndex: number | null;
    extended: ExtendedWeatherReadings;
  };
  hourly: (WeatherContext & {
    timestamp: string;
    uvIndex: number | null;
    extended: ExtendedWeatherReadings;
  })[];
  daily: {
    date: string;
    leafWetnessProbability: number | null;
    temperature: number | null;
    relativeHumidity: number | null;
    precipitation: number | null;
    windSpeed: number | null;
  }[];
  partial: boolean;
}

function value(source: Record<string, unknown> | undefined, key: string): number | null {
  return nullableNumber(source?.[key]);
}

function signedValue(source: Record<string, unknown> | undefined, key: string): number | null {
  const candidate = source?.[key];
  return isFiniteNumber(candidate) ? candidate : null;
}

function arrayValue(
  source: Record<string, unknown> | undefined,
  key: string,
  index: number,
): number | null {
  const values = source?.[key];
  return Array.isArray(values) ? nullableNumber(values[index]) : null;
}

function signedArrayValue(
  source: Record<string, unknown> | undefined,
  key: string,
  index: number,
): number | null {
  const values = source?.[key];
  const candidate = Array.isArray(values) ? values[index] : null;
  return isFiniteNumber(candidate) ? candidate : null;
}

function uvValue(source: Record<string, unknown> | undefined, index?: number): number | null {
  const uv =
    index === undefined ? value(source, 'uv_index') : arrayValue(source, 'uv_index', index);
  return uv !== null && uv >= 0 ? uv : null;
}

function contextFrom(
  source: Record<string, unknown> | undefined,
  index?: number,
): WeatherContext & {
  uvIndex: number | null;
} {
  const from = (key: string) =>
    index === undefined ? value(source, key) : arrayValue(source, key, index);
  const signedFrom = (key: string) =>
    index === undefined ? signedValue(source, key) : signedArrayValue(source, key, index);

  return {
    temperature: signedFrom('temperature_2m'),
    relativeHumidity: from('relative_humidity_2m'),
    dewPoint: signedFrom('dew_point_2m'),
    precipitation: from('precipitation'),
    windSpeed: from('wind_speed_10m'),
    windDirection: from('wind_direction_10m'),
    windGusts: from('wind_gusts_10m'),
    visibility: from('visibility'),
    leafWetnessProbability: null,
    uvIndex: uvValue(source, index),
  };
}

function extendedFrom(
  source: Record<string, unknown> | undefined,
  index?: number,
): ExtendedWeatherReadings {
  const from = (key: string) =>
    index === undefined ? value(source, key) : arrayValue(source, key, index);
  const signedFrom = (key: string) =>
    index === undefined ? signedValue(source, key) : signedArrayValue(source, key, index);

  return {
    apparentTemperature: signedFrom('apparent_temperature'),
    precipitationProbability: from('precipitation_probability'),
    pressureMsl: from('pressure_msl'),
    surfacePressure: from('surface_pressure'),
    visibility: from('visibility'),
    cloudCover: from('cloud_cover'),
    cloudCoverLow: from('cloud_cover_low'),
    cloudCoverMid: from('cloud_cover_mid'),
    cloudCoverHigh: from('cloud_cover_high'),
    dewPoint: signedFrom('dew_point_2m'),
    wetBulbTemperature: signedFrom('wet_bulb_temperature_2m'),
    windGusts: from('wind_gusts_10m'),
    shortwaveRadiation: from('shortwave_radiation'),
    directNormalIrradiance: from('direct_normal_irradiance'),
    diffuseRadiation: from('diffuse_radiation'),
    sunshineDuration: from('sunshine_duration'),
    cape: from('cape'),
    soilMoisture0To1cm: from('soil_moisture_0_1cm'),
    soilTemperature0cm: signedFrom('soil_temperature_0cm'),
    et0FaoEvapotranspiration: from('et0_fao_evapotranspiration'),
    vapourPressureDeficit: from('vapour_pressure_deficit'),
  };
}

function dailyAt(source: Record<string, unknown> | undefined, index: number) {
  return {
    leafWetnessProbability: arrayValue(source, 'leaf_wetness_probability_mean', index),
    temperature: signedArrayValue(source, 'temperature_2m_mean', index),
    relativeHumidity: arrayValue(source, 'relative_humidity_2m_mean', index),
    precipitation: arrayValue(source, 'precipitation_sum', index),
    windSpeed: arrayValue(source, 'wind_speed_10m_mean', index),
  };
}

function hasAnyNumeric(values: object): boolean {
  return Object.values(values).some((item) => typeof item === 'number' && Number.isFinite(item));
}

function weatherVariablesFor(activityIds: readonly ActivityDomainId[] = []): string[] {
  const activityVariables = activityOpenMeteoVariables(activityIds).weather;
  return Array.from(
    new Set([
      ...BASE_VARIABLES,
      ...DEFAULT_EXTENDED_VARIABLES.filter((variable) => activityVariables.includes(variable)),
      ...activityVariables,
    ]),
  );
}

function currentWeatherVariablesFor(hourlyVariables: readonly string[]): string[] {
  const allowed = new Set([
    ...BASE_VARIABLES,
    'apparent_temperature',
    'pressure_msl',
    'surface_pressure',
    'cloud_cover',
    'wind_gusts_10m',
  ]);

  return hourlyVariables.filter((variable) => allowed.has(variable));
}

export function buildWeatherUrl(
  coordinates: Coordinates,
  options: { enabledActivities?: readonly ActivityDomainId[] } = {},
): string {
  const variables = weatherVariablesFor(options.enabledActivities ?? []);
  const params = new URLSearchParams({
    latitude: String(coordinates.latitude),
    longitude: String(coordinates.longitude),
    current: currentWeatherVariablesFor(variables).join(','),
    hourly: variables.join(','),
    daily: DAILY_VARIABLES.join(','),
    forecast_days: String(FORECAST_DAY_LIMITS.providerRequest),
    timezone: 'auto',
    wind_speed_unit: 'ms',
  });

  return `${WEATHER_URL}?${params.toString()}`;
}

export function normalizeWeather(payload: OpenMeteoWeatherPayload): NormalizedWeather {
  const latitude = coordinateNumber(payload.latitude);
  const longitude = coordinateNumber(payload.longitude);

  if (latitude === null || longitude === null) {
    throw new Error('Invalid Open-Meteo weather coordinates');
  }

  const timezone = typeof payload.timezone === 'string' ? payload.timezone : null;
  const utcOffsetSeconds = payload.utc_offset_seconds;
  const current = contextFrom(payload.current);
  const currentExtended = extendedFrom(payload.current);
  const currentTimestamp = timestampWithUtcOffset(payload.current?.time, utcOffsetSeconds);
  const dailyTime = Array.isArray(payload.daily?.time) ? payload.daily.time : [];
  const daily = dailyTime
    .map((date, index) => {
      if (typeof date !== 'string') return null;
      return { date, ...dailyAt(payload.daily, index) };
    })
    .filter((item): item is NormalizedWeather['daily'][number] => item !== null);
  const today = daily[0] ?? null;
  const hourlyTime = Array.isArray(payload.hourly?.time) ? payload.hourly.time : [];
  const hourly = hourlyTime
    .map((rawTimestamp, index) => {
      const timestamp = timestampWithUtcOffset(rawTimestamp, utcOffsetSeconds);
      if (!timestamp) return null;
      const values = contextFrom(payload.hourly, index);
      const date = timestamp.slice(0, 10);
      const matchingDaily = daily.find((day) => day.date === date) ?? today;

      return {
        timestamp,
        ...values,
        leafWetnessProbability: matchingDaily?.leafWetnessProbability ?? null,
        extended: extendedFrom(payload.hourly, index),
      };
    })
    .filter((item): item is NormalizedWeather['hourly'][number] => item !== null);

  const hasUsableWeatherData =
    hasAnyNumeric(current) ||
    hasAnyNumeric(currentExtended) ||
    hourly.some((hour) => hasAnyNumeric(hour) || hasAnyNumeric(hour.extended)) ||
    daily.some(hasAnyNumeric);

  if (!hasUsableWeatherData) {
    throw new Error('Open-Meteo weather response has no usable readings');
  }

  return {
    coordinates: { latitude, longitude },
    fetchedAt: new Date().toISOString(),
    timezone,
    current: {
      timestamp: currentTimestamp,
      ...current,
      leafWetnessProbability: today?.leafWetnessProbability ?? null,
      extended: currentExtended,
    },
    hourly,
    daily,
    partial: hourly.length === 0,
  };
}

export async function fetchWeather(
  coordinates: Coordinates,
  options: { enabledActivities?: readonly ActivityDomainId[] } = {},
): Promise<NormalizedWeather> {
  const payload = await fetchJson<OpenMeteoWeatherPayload>(buildWeatherUrl(coordinates, options));
  return normalizeWeather(payload);
}

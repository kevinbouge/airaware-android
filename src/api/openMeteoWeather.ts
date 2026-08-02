import type { Coordinates, WeatherContext } from '../models/environment';
import { fetchJson } from './http';
import { coordinateNumber, nullableNumber } from '../utils/number';

const WEATHER_URL = 'https://api.open-meteo.com/v1/forecast';
const VARIABLES = [
  'temperature_2m',
  'relative_humidity_2m',
  'dew_point_2m',
  'precipitation',
  'wind_speed_10m',
  'wind_direction_10m',
  'wind_gusts_10m',
  'visibility',
  'uv_index',
];
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
  current?: Record<string, unknown>;
  hourly?: Record<string, unknown>;
  daily?: Record<string, unknown>;
};

export interface NormalizedWeather {
  coordinates: Coordinates;
  fetchedAt: string;
  timezone: string | null;
  current: WeatherContext & { timestamp: string | null; uvIndex: number | null };
  hourly: (WeatherContext & { timestamp: string; uvIndex: number | null })[];
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

function arrayValue(
  source: Record<string, unknown> | undefined,
  key: string,
  index: number,
): number | null {
  const values = source?.[key];
  return Array.isArray(values) ? nullableNumber(values[index]) : null;
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

  return {
    temperature: from('temperature_2m'),
    relativeHumidity: from('relative_humidity_2m'),
    dewPoint: from('dew_point_2m'),
    precipitation: from('precipitation'),
    windSpeed: from('wind_speed_10m'),
    windDirection: from('wind_direction_10m'),
    windGusts: from('wind_gusts_10m'),
    visibility: from('visibility'),
    leafWetnessProbability: null,
    uvIndex: uvValue(source, index),
  };
}

function dailyAt(source: Record<string, unknown> | undefined, index: number) {
  return {
    leafWetnessProbability: arrayValue(source, 'leaf_wetness_probability_mean', index),
    temperature: arrayValue(source, 'temperature_2m_mean', index),
    relativeHumidity: arrayValue(source, 'relative_humidity_2m_mean', index),
    precipitation: arrayValue(source, 'precipitation_sum', index),
    windSpeed: arrayValue(source, 'wind_speed_10m_mean', index),
  };
}

function hasAnyNumeric(values: object): boolean {
  return Object.values(values).some((item) => typeof item === 'number' && Number.isFinite(item));
}

export function buildWeatherUrl(coordinates: Coordinates): string {
  const params = new URLSearchParams({
    latitude: String(coordinates.latitude),
    longitude: String(coordinates.longitude),
    current: VARIABLES.join(','),
    hourly: VARIABLES.join(','),
    daily: DAILY_VARIABLES.join(','),
    forecast_days: '4',
    timezone: 'auto',
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
  const current = contextFrom(payload.current);
  const currentTimestamp = typeof payload.current?.time === 'string' ? payload.current.time : null;
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
    .map((timestamp, index) => {
      if (typeof timestamp !== 'string' || timestamp.length === 0) return null;
      const values = contextFrom(payload.hourly, index);
      const date = timestamp.slice(0, 10);
      const matchingDaily = daily.find((day) => day.date === date) ?? today;

      return {
        timestamp,
        ...values,
        leafWetnessProbability: matchingDaily?.leafWetnessProbability ?? null,
      };
    })
    .filter((item): item is NormalizedWeather['hourly'][number] => item !== null);

  const hasUsableWeatherData =
    hasAnyNumeric(current) || hourly.some(hasAnyNumeric) || daily.some(hasAnyNumeric);

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
    },
    hourly,
    daily,
    partial: hourly.length === 0,
  };
}

export async function fetchWeather(coordinates: Coordinates): Promise<NormalizedWeather> {
  const payload = await fetchJson<OpenMeteoWeatherPayload>(buildWeatherUrl(coordinates));
  return normalizeWeather(payload);
}

import type { Coordinates } from '../models/environment';
import type {
  DataDetailSource,
  DataDetailVariableDefinition,
  RawTimelinePoint,
} from '../models/dataDetail';
import { calculateMoldPotential } from '../core/moldPotential';
import { fetchJson } from './http';
import { coordinateNumber, isFiniteNumber, nullableNumber } from '../utils/number';
import { timestampWithUtcOffset } from '../utils/time';

const AIR_QUALITY_URL = 'https://air-quality-api.open-meteo.com/v1/air-quality';
const WEATHER_FORECAST_URL = 'https://api.open-meteo.com/v1/forecast';
const WEATHER_HISTORY_URL = 'https://historical-forecast-api.open-meteo.com/v1/forecast';

type OpenMeteoTimelinePayload = Record<string, unknown> & {
  latitude?: unknown;
  longitude?: unknown;
  timezone?: unknown;
  utc_offset_seconds?: unknown;
  hourly?: Record<string, unknown>;
  daily?: Record<string, unknown>;
};

const MOLD_DAILY_VARIABLES = ['leaf_wetness_probability_mean'] as const;

function validateCoordinates(coordinates: Coordinates): void {
  const latitude = coordinateNumber(coordinates.latitude);
  const longitude = coordinateNumber(coordinates.longitude);

  if (
    latitude === null ||
    longitude === null ||
    latitude < -90 ||
    latitude > 90 ||
    longitude < -180 ||
    longitude > 180
  ) {
    throw new Error('Invalid Open-Meteo detail coordinates');
  }
}

function endpointFor(variable: DataDetailVariableDefinition, source: DataDetailSource): string {
  if (variable.provider === 'airQuality') return AIR_QUALITY_URL;
  return source === 'history' ? WEATHER_HISTORY_URL : WEATHER_FORECAST_URL;
}

function variableList(variable: DataDetailVariableDefinition, source: DataDetailSource): string {
  return (source === 'history' ? variable.historyVariables : variable.forecastVariables).join(',');
}

export function buildDataDetailUrl(input: {
  coordinates: Coordinates;
  variable: DataDetailVariableDefinition;
  source: DataDetailSource;
  startDate?: string | undefined;
  endDate?: string | undefined;
  forecastHours?: number | undefined;
}): string {
  validateCoordinates(input.coordinates);
  const params = new URLSearchParams({
    latitude: String(input.coordinates.latitude),
    longitude: String(input.coordinates.longitude),
    hourly: variableList(input.variable, input.source),
    timezone: 'auto',
  });

  if (input.variable.provider !== 'airQuality') {
    params.set('wind_speed_unit', 'ms');
  }

  if (input.variable.provider === 'mold') {
    params.set('daily', MOLD_DAILY_VARIABLES.join(','));
  }

  if (input.source === 'history') {
    if (!input.startDate || !input.endDate) {
      throw new Error('Open-Meteo detail history requests require start and end dates');
    }
    params.set('start_date', input.startDate);
    params.set('end_date', input.endDate);
  } else {
    params.set('forecast_hours', String(input.forecastHours ?? 24));
  }

  return `${endpointFor(input.variable, input.source)}?${params.toString()}`;
}

function arrayValue(
  source: Record<string, unknown> | undefined,
  key: string,
  index: number,
): number | null {
  const values = source?.[key];
  if (!Array.isArray(values)) return null;
  const raw = values[index];

  if (key === 'temperature_2m' || key === 'dew_point_2m' || key === 'wet_bulb_temperature_2m') {
    return isFiniteNumber(raw) ? raw : null;
  }

  return nullableNumber(raw);
}

function dailyLeafWetnessByDate(
  daily: Record<string, unknown> | undefined,
): Map<string, number | null> {
  const times = Array.isArray(daily?.time) ? daily.time : [];
  const values = Array.isArray(daily?.leaf_wetness_probability_mean)
    ? daily.leaf_wetness_probability_mean
    : [];

  return new Map(
    times.flatMap((date, index) => {
      if (typeof date !== 'string') return [];
      return [[date, nullableNumber(values[index])]];
    }),
  );
}

function moldValue(
  source: Record<string, unknown> | undefined,
  index: number,
  leafWetnessProbability: number | null,
): number | null {
  const mold = calculateMoldPotential({
    temperature: arrayValue(source, 'temperature_2m', index),
    relativeHumidity: arrayValue(source, 'relative_humidity_2m', index),
    dewPoint: arrayValue(source, 'dew_point_2m', index),
    precipitation: arrayValue(source, 'precipitation', index),
    windSpeed: arrayValue(source, 'wind_speed_10m', index),
    leafWetnessProbability,
  });

  return mold.available ? mold.score : null;
}

export interface NormalizedDataDetailSource {
  coordinates: Coordinates;
  timezone: string | null;
  points: RawTimelinePoint[];
}

export function normalizeDataDetailSource(
  payload: OpenMeteoTimelinePayload,
  variable: DataDetailVariableDefinition,
  source: DataDetailSource,
): NormalizedDataDetailSource {
  const latitude = coordinateNumber(payload.latitude);
  const longitude = coordinateNumber(payload.longitude);

  if (latitude === null || longitude === null) {
    throw new Error('Invalid Open-Meteo detail response coordinates');
  }

  const hourly = payload.hourly;
  const times = Array.isArray(hourly?.time) ? hourly.time : null;
  if (!times) {
    throw new Error('Open-Meteo detail response has no hourly timestamps');
  }

  const timezone = typeof payload.timezone === 'string' ? payload.timezone : null;
  const leafWetnessByDate = dailyLeafWetnessByDate(payload.daily);
  const points = times
    .map((rawTimestamp, index) => {
      const timestamp = timestampWithUtcOffset(rawTimestamp, payload.utc_offset_seconds);
      if (!timestamp) return null;
      const date = timestamp.slice(0, 10);

      return {
        timestamp,
        source,
        value:
          variable.provider === 'mold'
            ? moldValue(hourly, index, leafWetnessByDate.get(date) ?? null)
            : arrayValue(hourly, variable.openMeteoVariable ?? '', index),
      };
    })
    .filter((point): point is RawTimelinePoint => point !== null);

  return {
    coordinates: { latitude, longitude },
    timezone,
    points,
  };
}

export async function fetchDataDetailSource(input: {
  coordinates: Coordinates;
  variable: DataDetailVariableDefinition;
  source: DataDetailSource;
  startDate?: string | undefined;
  endDate?: string | undefined;
  forecastHours?: number | undefined;
}): Promise<NormalizedDataDetailSource> {
  const url = buildDataDetailUrl(input);
  const payload = await fetchJson<OpenMeteoTimelinePayload>(url);
  return normalizeDataDetailSource(payload, input.variable, input.source);
}

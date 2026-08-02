import type { NormalizedAirQuality } from '../api/openMeteoAirQuality';
import type { NormalizedWeather } from '../api/openMeteoWeather';
import { calculateMoldPotential } from '../core/moldPotential';
import { calculateEnvironmentalScore } from '../core/scoring';
import type {
  Coordinates,
  CurrentEnvironmentalReadings,
  ForecastDay,
  HourlyEnvironmentalReading,
  NormalizedEnvironment,
  WeatherContext,
} from '../models/environment';

const EMPTY_WEATHER: WeatherContext = {
  temperature: null,
  relativeHumidity: null,
  dewPoint: null,
  precipitation: null,
  windSpeed: null,
  windDirection: null,
  windGusts: null,
  visibility: null,
  leafWetnessProbability: null,
};

function dayLabel(date: string, index: number): string {
  if (index === 0) return 'Today';
  if (index === 1) return 'Tomorrow';
  return new Intl.DateTimeFormat(undefined, { weekday: 'long' }).format(
    new Date(`${date}T12:00:00`),
  );
}

function chooseCurrentTimestamp(
  airQuality: NormalizedAirQuality | null,
  weather: NormalizedWeather | null,
) {
  return airQuality?.current.timestamp ?? weather?.current.timestamp ?? null;
}

function mergeCurrent(
  airQuality: NormalizedAirQuality | null,
  weather: NormalizedWeather | null,
  fallback: NormalizedEnvironment | null = null,
): CurrentEnvironmentalReadings {
  const weatherContext = weather?.current ?? fallback?.current.weather ?? EMPTY_WEATHER;

  return {
    timestamp: chooseCurrentTimestamp(airQuality, weather),
    pollen: airQuality?.current.pollen ??
      fallback?.current.pollen ?? {
        alder: null,
        birch: null,
        grass: null,
        mugwort: null,
        olive: null,
        ragweed: null,
      },
    regulatedPollutants: airQuality?.current.regulatedPollutants ??
      fallback?.current.regulatedPollutants ?? {
        pm25: null,
        pm10: null,
        nitrogenDioxide: null,
        ozone: null,
        sulphurDioxide: null,
      },
    pollutantAqi: airQuality?.current.pollutantAqi ??
      fallback?.current.pollutantAqi ?? {
        pm25: null,
        pm10: null,
        nitrogenDioxide: null,
        ozone: null,
        sulphurDioxide: null,
      },
    aqiLabel: airQuality?.current.aqiLabel ?? fallback?.current.aqiLabel ?? 'EU AQI',
    atmosphericIrritants: airQuality?.current.atmosphericIrritants ??
      fallback?.current.atmosphericIrritants ?? {
        carbonMonoxide: null,
        aerosolOpticalDepth: null,
        dust: null,
        wildfirePm10: null,
      },
    weather: weatherContext,
    moldPotential: calculateMoldPotential(weatherContext),
    uvIndex: weather?.current.uvIndex ?? fallback?.current.uvIndex ?? null,
  };
}

function sourceForProvider<T>(fresh: T | null, fallbackFetchedAt: string | null | undefined) {
  if (fresh) return 'fresh';
  return fallbackFetchedAt ? 'cached' : 'unavailable';
}

function mergeHourly(
  airQuality: NormalizedAirQuality | null,
  weather: NormalizedWeather | null,
  fallback: NormalizedEnvironment | null = null,
): HourlyEnvironmentalReading[] {
  const weatherByTime = new Map((weather?.hourly ?? []).map((item) => [item.timestamp, item]));
  const airByTime = new Map((airQuality?.hourly ?? []).map((item) => [item.timestamp, item]));
  const fallbackByTime = new Map((fallback?.hourly ?? []).map((item) => [item.timestamp, item]));
  const timestamps = Array.from(
    new Set([...airByTime.keys(), ...weatherByTime.keys(), ...fallbackByTime.keys()]),
  ).sort((left, right) => Date.parse(left) - Date.parse(right));

  return timestamps.map((timestamp) => {
    const air = airByTime.get(timestamp);
    const weatherHour = weatherByTime.get(timestamp);
    const fallbackHour = fallbackByTime.get(timestamp);
    const weatherContext = weatherHour ?? fallbackHour?.weather ?? EMPTY_WEATHER;

    return {
      timestamp,
      pollen: air?.pollen ??
        fallbackHour?.pollen ?? {
          alder: null,
          birch: null,
          grass: null,
          mugwort: null,
          olive: null,
          ragweed: null,
        },
      regulatedPollutants: air?.regulatedPollutants ??
        fallbackHour?.regulatedPollutants ?? {
          pm25: null,
          pm10: null,
          nitrogenDioxide: null,
          ozone: null,
          sulphurDioxide: null,
        },
      pollutantAqi: air?.pollutantAqi ??
        fallbackHour?.pollutantAqi ?? {
          pm25: null,
          pm10: null,
          nitrogenDioxide: null,
          ozone: null,
          sulphurDioxide: null,
        },
      aqiLabel: air?.aqiLabel ?? fallbackHour?.aqiLabel ?? airQuality?.current.aqiLabel ?? 'EU AQI',
      atmosphericIrritants: air?.atmosphericIrritants ??
        fallbackHour?.atmosphericIrritants ?? {
          carbonMonoxide: null,
          aerosolOpticalDepth: null,
          dust: null,
          wildfirePm10: null,
        },
      weather: weatherContext,
      moldPotential: calculateMoldPotential(weatherContext),
      uvIndex: weatherHour?.uvIndex ?? fallbackHour?.uvIndex ?? null,
    };
  });
}

function buildForecastDays(hourly: HourlyEnvironmentalReading[]): ForecastDay[] {
  const grouped = new Map<string, HourlyEnvironmentalReading[]>();

  for (const hour of hourly) {
    const date = hour.timestamp.slice(0, 10);
    if (!date) continue;
    grouped.set(date, [...(grouped.get(date) ?? []), hour]);
  }

  return Array.from(grouped.entries())
    .slice(0, 3)
    .map(([date, hours], index) => {
      const peak = hours
        .map((hour) => calculateEnvironmentalScore(hour))
        .filter((score) => score.available)
        .sort((left, right) => (right.score ?? 0) - (left.score ?? 0))[0];

      return {
        date,
        label: dayLabel(date, index),
        score: peak ?? null,
      };
    });
}

export function assembleEnvironment(input: {
  coordinates: Coordinates;
  placeName: string | null;
  airQuality: NormalizedAirQuality | null;
  weather: NormalizedWeather | null;
  fallback?: NormalizedEnvironment | null;
}): NormalizedEnvironment {
  const current = mergeCurrent(input.airQuality, input.weather, input.fallback ?? null);
  const hourly = mergeHourly(input.airQuality, input.weather, input.fallback ?? null);

  return {
    provider: 'open-meteo',
    coordinates: input.coordinates,
    placeName: input.placeName ?? input.fallback?.placeName ?? null,
    fetchedAt: new Date().toISOString(),
    current,
    hourly,
    forecastDays: buildForecastDays(hourly),
    metadata: {
      timezone: input.airQuality?.timezone ?? input.weather?.timezone ?? null,
      airQualityFetchedAt:
        input.airQuality?.fetchedAt ?? input.fallback?.metadata.airQualityFetchedAt ?? null,
      weatherFetchedAt:
        input.weather?.fetchedAt ?? input.fallback?.metadata.weatherFetchedAt ?? null,
      airQualitySource: sourceForProvider(
        input.airQuality,
        input.fallback?.metadata.airQualityFetchedAt,
      ),
      weatherSource: sourceForProvider(input.weather, input.fallback?.metadata.weatherFetchedAt),
      partial: input.airQuality?.partial === true || input.weather?.partial === true,
    },
  };
}

import type { NormalizedAirQuality } from '../api/openMeteoAirQuality';
import type { NormalizedWeather } from '../api/openMeteoWeather';
import { calculateMoldPotential } from '../core/moldPotential';
import { calculateEnvironmentalScore } from '../core/scoring';
import type {
  Coordinates,
  CurrentEnvironmentalReadings,
  ExtendedAirQualityReadings,
  ExtendedEnvironmentalReadings,
  ExtendedWeatherReadings,
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

const EMPTY_EXTENDED_AIR_QUALITY: ExtendedAirQualityReadings = {
  carbonDioxide: null,
  ammonia: null,
  methane: null,
  nitrogenMonoxide: null,
  formaldehyde: null,
  nonMethaneVolatileOrganicCompounds: null,
};

const EMPTY_EXTENDED_WEATHER: ExtendedWeatherReadings = {
  pressureMsl: null,
  surfacePressure: null,
  visibility: null,
  cloudCover: null,
  cloudCoverLow: null,
  cloudCoverMid: null,
  cloudCoverHigh: null,
  dewPoint: null,
  wetBulbTemperature: null,
  windGusts: null,
  shortwaveRadiation: null,
  directNormalIrradiance: null,
  diffuseRadiation: null,
  sunshineDuration: null,
  cape: null,
};

const EMPTY_EXTENDED: ExtendedEnvironmentalReadings = {
  airQuality: EMPTY_EXTENDED_AIR_QUALITY,
  weather: EMPTY_EXTENDED_WEATHER,
};

function addDays(date: string, days: number): string | null {
  const match = date.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;

  const [, year, month, day] = match;
  const time = Date.UTC(Number(year), Number(month) - 1, Number(day) + days);

  return new Date(time).toISOString().slice(0, 10);
}

function dayLabel(date: string, currentDate: string | null, index: number): string {
  if (currentDate && date === currentDate) return 'Today';
  if (currentDate && date === addDays(currentDate, 1)) return 'Tomorrow';
  if (!currentDate && index === 0) return 'Today';
  if (!currentDate && index === 1) return 'Tomorrow';

  return new Intl.DateTimeFormat(undefined, { weekday: 'long' }).format(
    new Date(`${date}T12:00:00`),
  );
}

function chooseCurrentTimestamp(
  airQuality: NormalizedAirQuality | null,
  weather: NormalizedWeather | null,
  fallback: NormalizedEnvironment | null,
) {
  return (
    airQuality?.current.timestamp ??
    weather?.current.timestamp ??
    fallback?.current.timestamp ??
    null
  );
}

function mergeCurrent(
  airQuality: NormalizedAirQuality | null,
  weather: NormalizedWeather | null,
  fallback: NormalizedEnvironment | null = null,
): CurrentEnvironmentalReadings {
  const weatherContext = weather?.current ?? fallback?.current.weather ?? EMPTY_WEATHER;
  const extended: ExtendedEnvironmentalReadings = {
    airQuality:
      airQuality?.current.extended ??
      fallback?.current.extended?.airQuality ??
      EMPTY_EXTENDED.airQuality,
    weather:
      weather?.current.extended ?? fallback?.current.extended?.weather ?? EMPTY_EXTENDED.weather,
  };

  return {
    timestamp: chooseCurrentTimestamp(airQuality, weather, fallback),
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
    extended,
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
  const freshTimestamps = new Set([...airByTime.keys(), ...weatherByTime.keys()]);
  const timestampSource = freshTimestamps.size > 0 ? freshTimestamps : fallbackByTime.keys();
  const timestamps = Array.from(new Set(timestampSource)).sort(
    (left, right) => Date.parse(left) - Date.parse(right),
  );

  return timestamps.map((timestamp) => {
    const air = airByTime.get(timestamp);
    const weatherHour = weatherByTime.get(timestamp);
    const fallbackHour = fallbackByTime.get(timestamp);
    const weatherContext = weatherHour ?? fallbackHour?.weather ?? EMPTY_WEATHER;
    const extended: ExtendedEnvironmentalReadings = {
      airQuality: air?.extended ?? fallbackHour?.extended?.airQuality ?? EMPTY_EXTENDED.airQuality,
      weather: weatherHour?.extended ?? fallbackHour?.extended?.weather ?? EMPTY_EXTENDED.weather,
    };

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
      extended,
      moldPotential: calculateMoldPotential(weatherContext),
      uvIndex: weatherHour?.uvIndex ?? fallbackHour?.uvIndex ?? null,
    };
  });
}

function buildForecastDays(
  hourly: HourlyEnvironmentalReading[],
  currentTimestamp: string | null,
): ForecastDay[] {
  const grouped = new Map<string, HourlyEnvironmentalReading[]>();
  const currentDate = currentTimestamp?.slice(0, 10) ?? hourly[0]?.timestamp.slice(0, 10) ?? null;
  const currentTime = currentTimestamp ? Date.parse(currentTimestamp) : null;

  for (const hour of hourly) {
    const date = hour.timestamp.slice(0, 10);
    if (!date) continue;
    const hourTime = Date.parse(hour.timestamp);
    if (
      currentDate &&
      date === currentDate &&
      currentTime !== null &&
      Number.isFinite(currentTime) &&
      Number.isFinite(hourTime) &&
      hourTime < currentTime
    ) {
      continue;
    }
    grouped.set(date, [...(grouped.get(date) ?? []), hour]);
  }

  return Array.from(grouped.entries()).map(([date, hours], index) => {
    const peak = hours
      .map((hour) => calculateEnvironmentalScore(hour))
      .filter((score) => score.available)
      .sort((left, right) => (right.score ?? 0) - (left.score ?? 0))[0];

    return {
      date,
      label: dayLabel(date, currentDate, index),
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
    forecastDays: buildForecastDays(hourly, current.timestamp),
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

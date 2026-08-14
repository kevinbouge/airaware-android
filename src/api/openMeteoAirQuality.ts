import { FORECAST_DAY_LIMITS } from '../capabilities/config';
import { activityOpenMeteoVariables } from '../core/activityDefinitions';
import type { ActivityDomainId } from '../models/activities';
import type {
  AtmosphericIrritants,
  Coordinates,
  ExtendedAirQualityReadings,
  PollenReadings,
  PollutantAqi,
  RegulatedPollutants,
} from '../models/environment';
import { fetchJson } from './http';
import { coordinateNumber, nullableNumber } from '../utils/number';
import { timestampWithUtcOffset } from '../utils/time';

const AIR_QUALITY_URL = 'https://air-quality-api.open-meteo.com/v1/air-quality';

const BASE_VARIABLES = [
  'pm10',
  'pm2_5',
  'nitrogen_dioxide',
  'ozone',
  'sulphur_dioxide',
  'carbon_monoxide',
  'aerosol_optical_depth',
  'dust',
  'european_aqi',
  'european_aqi_pm2_5',
  'european_aqi_pm10',
  'european_aqi_nitrogen_dioxide',
  'european_aqi_ozone',
  'european_aqi_sulphur_dioxide',
  'us_aqi',
  'us_aqi_pm2_5',
  'us_aqi_pm10',
  'us_aqi_nitrogen_dioxide',
  'us_aqi_ozone',
  'us_aqi_sulphur_dioxide',
  'alder_pollen',
  'birch_pollen',
  'grass_pollen',
  'mugwort_pollen',
  'olive_pollen',
  'ragweed_pollen',
  'pm10_wildfires',
] as const;

const EXTENDED_AIR_QUALITY_VARIABLES = [
  'carbon_dioxide',
  'ammonia',
  'methane',
  'nitrogen_monoxide',
  'formaldehyde',
  'non_methane_volatile_organic_compounds',
] as const;

export interface NormalizedAirQuality {
  coordinates: Coordinates;
  fetchedAt: string;
  timezone: string | null;
  current: {
    timestamp: string | null;
    pollen: PollenReadings;
    regulatedPollutants: RegulatedPollutants;
    pollutantAqi: PollutantAqi;
    aqiLabel: 'US AQI' | 'EU AQI';
    atmosphericIrritants: AtmosphericIrritants;
    extended: ExtendedAirQualityReadings;
  };
  hourly: {
    timestamp: string;
    pollen: PollenReadings;
    regulatedPollutants: RegulatedPollutants;
    pollutantAqi: PollutantAqi;
    aqiLabel: 'US AQI' | 'EU AQI';
    atmosphericIrritants: AtmosphericIrritants;
    extended: ExtendedAirQualityReadings;
  }[];
  partial: boolean;
}

type OpenMeteoPayload = Record<string, unknown> & {
  latitude?: unknown;
  longitude?: unknown;
  timezone?: unknown;
  utc_offset_seconds?: unknown;
  current?: Record<string, unknown>;
  hourly?: Record<string, unknown>;
};

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

const US_AQI_TIMEZONES = new Set([
  'America/New_York',
  'America/Detroit',
  'America/Kentucky/Louisville',
  'America/Kentucky/Monticello',
  'America/Indiana/Indianapolis',
  'America/Indiana/Vincennes',
  'America/Indiana/Winamac',
  'America/Indiana/Marengo',
  'America/Indiana/Petersburg',
  'America/Indiana/Vevay',
  'America/Chicago',
  'America/Indiana/Tell_City',
  'America/Indiana/Knox',
  'America/Menominee',
  'America/North_Dakota/Center',
  'America/North_Dakota/New_Salem',
  'America/North_Dakota/Beulah',
  'America/Denver',
  'America/Boise',
  'America/Phoenix',
  'America/Los_Angeles',
  'America/Anchorage',
  'America/Juneau',
  'America/Sitka',
  'America/Metlakatla',
  'America/Yakutat',
  'America/Nome',
  'America/Adak',
  'Pacific/Honolulu',
]);

function sourceForTimezone(timezone: string | null): 'us' | 'eu' {
  return timezone !== null && US_AQI_TIMEZONES.has(timezone) ? 'us' : 'eu';
}

function aqiLabel(source: 'us' | 'eu'): 'US AQI' | 'EU AQI' {
  return source === 'us' ? 'US AQI' : 'EU AQI';
}

function pollenFrom(source: Record<string, unknown> | undefined, index?: number): PollenReadings {
  const from = (key: string) =>
    index === undefined ? value(source, key) : arrayValue(source, key, index);

  return {
    alder: from('alder_pollen'),
    birch: from('birch_pollen'),
    grass: from('grass_pollen'),
    mugwort: from('mugwort_pollen'),
    olive: from('olive_pollen'),
    ragweed: from('ragweed_pollen'),
  };
}

function pollutantsFrom(
  source: Record<string, unknown> | undefined,
  index?: number,
): RegulatedPollutants {
  const from = (key: string) =>
    index === undefined ? value(source, key) : arrayValue(source, key, index);

  return {
    pm25: from('pm2_5'),
    pm10: from('pm10'),
    nitrogenDioxide: from('nitrogen_dioxide'),
    ozone: from('ozone'),
    sulphurDioxide: from('sulphur_dioxide'),
  };
}

function aqiFrom(
  source: Record<string, unknown> | undefined,
  selectedSource: 'us' | 'eu',
  index?: number,
): PollutantAqi {
  const prefix = selectedSource === 'us' ? 'us_aqi' : 'european_aqi';
  const from = (key: string) =>
    index === undefined ? value(source, key) : arrayValue(source, key, index);

  return {
    pm25: from(`${prefix}_pm2_5`),
    pm10: from(`${prefix}_pm10`),
    nitrogenDioxide: from(`${prefix}_nitrogen_dioxide`),
    ozone: from(`${prefix}_ozone`),
    sulphurDioxide: from(`${prefix}_sulphur_dioxide`),
  };
}

function irritantsFrom(
  source: Record<string, unknown> | undefined,
  index?: number,
): AtmosphericIrritants {
  const from = (key: string) =>
    index === undefined ? value(source, key) : arrayValue(source, key, index);

  return {
    carbonMonoxide: from('carbon_monoxide'),
    aerosolOpticalDepth: from('aerosol_optical_depth'),
    dust: from('dust'),
    wildfirePm10: from('pm10_wildfires'),
  };
}

function extendedFrom(
  source: Record<string, unknown> | undefined,
  index?: number,
): ExtendedAirQualityReadings {
  const from = (key: string) =>
    index === undefined ? value(source, key) : arrayValue(source, key, index);

  return {
    carbonDioxide: from('carbon_dioxide'),
    ammonia: from('ammonia'),
    methane: from('methane'),
    nitrogenMonoxide: from('nitrogen_monoxide'),
    formaldehyde: from('formaldehyde'),
    nonMethaneVolatileOrganicCompounds: from('non_methane_volatile_organic_compounds'),
  };
}

function hasAnyNumeric(values: object): boolean {
  return Object.values(values).some((item) => typeof item === 'number' && Number.isFinite(item));
}

function airQualityVariablesFor(activityIds: readonly ActivityDomainId[] = []): string[] {
  const activityVariables = activityOpenMeteoVariables(activityIds).airQuality;
  return Array.from(
    new Set([
      ...BASE_VARIABLES,
      ...EXTENDED_AIR_QUALITY_VARIABLES.filter((variable) => activityVariables.includes(variable)),
      ...activityVariables,
    ]),
  );
}

export function buildAirQualityUrl(
  coordinates: Coordinates,
  options: { enabledActivities?: readonly ActivityDomainId[] } = {},
): string {
  const variables = airQualityVariablesFor(options.enabledActivities ?? []);
  const params = new URLSearchParams({
    latitude: String(coordinates.latitude),
    longitude: String(coordinates.longitude),
    current: variables.join(','),
    hourly: variables.join(','),
    forecast_days: String(FORECAST_DAY_LIMITS.providerRequest),
    timezone: 'auto',
  });

  return `${AIR_QUALITY_URL}?${params.toString()}`;
}

export function normalizeAirQuality(payload: OpenMeteoPayload): NormalizedAirQuality {
  const latitude = coordinateNumber(payload.latitude);
  const longitude = coordinateNumber(payload.longitude);

  if (latitude === null || longitude === null) {
    throw new Error('Invalid Open-Meteo air-quality coordinates');
  }

  const timezone = typeof payload.timezone === 'string' ? payload.timezone : null;
  const utcOffsetSeconds = payload.utc_offset_seconds;
  const selectedSource = sourceForTimezone(timezone);
  const current = payload.current;
  const time = timestampWithUtcOffset(current?.time, utcOffsetSeconds);
  const currentPollen = pollenFrom(current);
  const currentPollutants = pollutantsFrom(current);
  const currentAqi = aqiFrom(current, selectedSource);
  const currentIrritants = irritantsFrom(current);
  const currentExtended = extendedFrom(current);
  const hourlyTime = Array.isArray(payload.hourly?.time) ? payload.hourly.time : [];
  const hourly = hourlyTime
    .map((rawTimestamp, index) => {
      const timestamp = timestampWithUtcOffset(rawTimestamp, utcOffsetSeconds);
      if (!timestamp) {
        return null;
      }

      return {
        timestamp,
        pollen: pollenFrom(payload.hourly, index),
        regulatedPollutants: pollutantsFrom(payload.hourly, index),
        pollutantAqi: aqiFrom(payload.hourly, selectedSource, index),
        aqiLabel: aqiLabel(selectedSource),
        atmosphericIrritants: irritantsFrom(payload.hourly, index),
        extended: extendedFrom(payload.hourly, index),
      };
    })
    .filter((item): item is NormalizedAirQuality['hourly'][number] => item !== null);

  if (
    !hasAnyNumeric(currentPollen) &&
    !hasAnyNumeric(currentPollutants) &&
    !hasAnyNumeric(currentAqi) &&
    !hasAnyNumeric(currentIrritants) &&
    !hasAnyNumeric(currentExtended)
  ) {
    throw new Error('Open-Meteo air-quality response has no usable current readings');
  }

  return {
    coordinates: { latitude, longitude },
    fetchedAt: new Date().toISOString(),
    timezone,
    current: {
      timestamp: time,
      pollen: currentPollen,
      regulatedPollutants: currentPollutants,
      pollutantAqi: currentAqi,
      aqiLabel: aqiLabel(selectedSource),
      atmosphericIrritants: currentIrritants,
      extended: currentExtended,
    },
    hourly,
    partial: hourly.length === 0,
  };
}

export async function fetchAirQuality(
  coordinates: Coordinates,
  options: { enabledActivities?: readonly ActivityDomainId[] } = {},
): Promise<NormalizedAirQuality> {
  const payload = await fetchJson<OpenMeteoPayload>(buildAirQualityUrl(coordinates, options));
  return normalizeAirQuality(payload);
}

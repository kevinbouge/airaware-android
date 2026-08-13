import { FREE_CAPABILITIES, PRO_LIFETIME_CAPABILITIES } from '../src/capabilities/config';
import { featureDefinitions, isFeatureAvailable } from '../src/capabilities/features';
import { isEnvironmentalVariableAvailable } from '../src/capabilities/variables';
import {
  ACTIVITY_DEFINITIONS,
  ACTIVITY_IDS,
  DEFAULT_ACTIVITY_SETTINGS,
  activityOpenMeteoVariables,
} from '../src/core/activityDefinitions';
import { buildActivityTimelineRows } from '../src/core/activityTimeline';
import {
  bestActivityWindowForRange,
  bestActivityWindowForDate,
  evaluateActivities,
  evaluateActivity,
  formatActivityWindow,
} from '../src/core/activityEvaluator';
import { calculateMoldPotential } from '../src/core/moldPotential';
import { dataDetailVariable } from '../src/core/dataVariableMetadata';
import type { ActivitySettings } from '../src/models/activities';
import type { HourlyEnvironmentalReading } from '../src/models/environment';

function hour(
  timestamp: string,
  overrides: Partial<HourlyEnvironmentalReading> = {},
): HourlyEnvironmentalReading {
  const weather = {
    temperature: 20,
    relativeHumidity: 55,
    dewPoint: 10,
    precipitation: 0,
    windSpeed: 2,
    windDirection: 180,
    windGusts: 4,
    visibility: 22000,
    leafWetnessProbability: 20,
  };

  return {
    timestamp,
    pollen: { alder: null, birch: null, grass: null, mugwort: null, olive: null, ragweed: null },
    regulatedPollutants: {
      pm25: 8,
      pm10: 12,
      nitrogenDioxide: 10,
      ozone: 50,
      sulphurDioxide: 2,
    },
    pollutantAqi: { pm25: 18, pm10: 20, nitrogenDioxide: 10, ozone: 35, sulphurDioxide: 2 },
    aqiLabel: 'EU AQI',
    atmosphericIrritants: {
      carbonMonoxide: 300,
      aerosolOpticalDepth: 0.12,
      dust: 4,
      wildfirePm10: null,
    },
    weather,
    extended: {
      airQuality: {
        carbonDioxide: null,
        ammonia: null,
        methane: null,
        nitrogenMonoxide: null,
        formaldehyde: null,
        nonMethaneVolatileOrganicCompounds: null,
      },
      weather: {
        apparentTemperature: 21,
        precipitationProbability: 5,
        pressureMsl: null,
        surfacePressure: null,
        visibility: 22000,
        cloudCover: 35,
        cloudCoverLow: 10,
        cloudCoverMid: 20,
        cloudCoverHigh: 45,
        dewPoint: 10,
        wetBulbTemperature: null,
        windGusts: 4,
        shortwaveRadiation: 350,
        directNormalIrradiance: null,
        diffuseRadiation: null,
        sunshineDuration: null,
        cape: null,
        soilMoisture0To1cm: 0.22,
        soilTemperature0cm: 16,
        et0FaoEvapotranspiration: 0.18,
        vapourPressureDeficit: 1.2,
      },
    },
    moldPotential: calculateMoldPotential(weather),
    uvIndex: 4,
    ...overrides,
  };
}

function settings(enabled: Partial<ActivitySettings>): ActivitySettings {
  return { ...DEFAULT_ACTIVITY_SETTINGS, ...enabled };
}

describe('Activities capability and model', () => {
  it('replaces generic Advanced Environmental Data with Pro Activities', () => {
    const freeFeatures = featureDefinitions(FREE_CAPABILITIES);
    const proFeatures = featureDefinitions(PRO_LIFETIME_CAPABILITIES);

    expect(freeFeatures.map((feature) => feature.id)).not.toContain('extended_environmental_data');
    expect(proFeatures.map((feature) => feature.id)).toContain('activities');
    expect(isFeatureAvailable(FREE_CAPABILITIES, 'activities')).toBe(false);
    expect(isFeatureAvailable(PRO_LIFETIME_CAPABILITIES, 'activities')).toBe(true);
    expect(PRO_LIFETIME_CAPABILITIES.environmentalVariables.availableGroups).toEqual(['standard']);
  });

  it('keeps Mold and UV in the Free standard variable set', () => {
    expect(isEnvironmentalVariableAvailable(FREE_CAPABILITIES, 'moldPotential')).toBe(true);
    expect(isEnvironmentalVariableAvailable(FREE_CAPABILITIES, 'uvIndex')).toBe(true);
  });

  it('defines all initial activities disabled by default', () => {
    expect(ACTIVITY_IDS).toEqual([
      'photography',
      'astronomy',
      'farming',
      'drone',
      'outdoor_sports',
      'outdoor_work',
    ]);
    expect(Object.values(DEFAULT_ACTIVITY_SETTINGS).every((value) => value === false)).toBe(true);
    expect(ACTIVITY_DEFINITIONS.every((definition) => definition.rules.length > 0)).toBe(true);
  });

  it('evaluates only enabled activities and finds a best contiguous window', () => {
    const result = evaluateActivities({
      coordinates: { latitude: 50, longitude: 14 },
      now: '2026-08-01T12:00:00+02:00',
      hourly: [
        hour('2026-08-01T12:00:00+02:00'),
        hour('2026-08-01T13:00:00+02:00'),
        hour('2026-08-01T14:00:00+02:00', {
          weather: { ...hour('2026-08-01T14:00:00+02:00').weather, windSpeed: 14 },
        }),
      ],
      enabledActivities: settings({ photography: true }),
    });

    expect(result).toHaveLength(1);
    expect(result[0]?.id).toBe('photography');
    expect(result[0]?.bestWindow.available).toBe(true);
    expect(result[0]?.reasons.length).toBeGreaterThan(0);
  });

  it('keeps Activity best-window end times in provider-local time and expands the best run', () => {
    const result = evaluateActivities({
      coordinates: { latitude: 50, longitude: 14 },
      now: '2026-08-01T19:00:00+02:00',
      hourly: [
        hour('2026-08-01T19:00:00+02:00'),
        hour('2026-08-01T20:00:00+02:00'),
        hour('2026-08-01T21:00:00+02:00'),
      ],
      enabledActivities: settings({ photography: true }),
    });

    expect(formatActivityWindow(result[0]!.bestWindow)).toBe('19:00–22:00');
  });

  it('selects the longest contiguous run in the best available Activity category', () => {
    const photography = ACTIVITY_DEFINITIONS.find((definition) => definition.id === 'photography')!;
    const result = evaluateActivity(photography, {
      coordinates: { latitude: 50, longitude: 14 },
      now: '2026-08-01T18:00:00+02:00',
      hourly: [
        hour('2026-08-01T18:00:00+02:00'),
        hour('2026-08-01T19:00:00+02:00'),
        hour('2026-08-01T20:00:00+02:00'),
        hour('2026-08-01T21:00:00+02:00'),
        hour('2026-08-01T22:00:00+02:00', {
          extended: {
            ...hour('2026-08-01T22:00:00+02:00').extended!,
            weather: {
              ...hour('2026-08-01T22:00:00+02:00').extended!.weather,
              cloudCover: 100,
            },
          },
        }),
      ],
      enabledActivities: settings({ photography: true }),
    });

    expect(result.bestWindow.startTime).toBe('2026-08-01T18:00:00+02:00');
    expect(formatActivityWindow(result.bestWindow)).toBe('18:00–22:00');
  });

  it('does not mark a whole broad Activity category as the best window', () => {
    const drone = ACTIVITY_DEFINITIONS.find((definition) => definition.id === 'drone')!;
    const hourly = Array.from({ length: 24 }, (_, index) => {
      const timestamp = `2026-08-01T${String(index).padStart(2, '0')}:00:00+02:00`;
      const windSpeed = index === 8 || index === 9 ? 2 : 6;

      return hour(timestamp, {
        weather: {
          ...hour(timestamp).weather,
          windSpeed,
        },
      });
    });
    const result = evaluateActivity(drone, {
      coordinates: { latitude: 50, longitude: 14 },
      now: '2026-08-01T00:00:00+02:00',
      hourly,
      enabledActivities: settings({ drone: true }),
      forecastDates: ['2026-08-01'],
    });

    expect(result.bestWindow.startTime).toBe('2026-08-01T08:00:00+02:00');
    expect(formatActivityWindow(result.bestWindow)).toBe('08:00–10:00');
  });

  it('uses best-window factors for Activity explanations when a later window is better', () => {
    const result = evaluateActivities({
      coordinates: { latitude: 50, longitude: 14 },
      now: '2026-08-01T12:00:00+02:00',
      hourly: [
        hour('2026-08-01T12:00:00+02:00', {
          weather: {
            ...hour('2026-08-01T12:00:00+02:00').weather,
            precipitation: 1.5,
            windSpeed: 8,
            windGusts: 12,
          },
        }),
        hour('2026-08-01T13:00:00+02:00'),
        hour('2026-08-01T14:00:00+02:00'),
      ],
      enabledActivities: settings({ drone: true }),
    });

    expect(result[0]?.bestWindow.startTime).toBe('2026-08-01T13:00:00+02:00');
    expect(result[0]?.reasons).toContain('No rain expected');
    expect(result[0]?.reasons).not.toContain('Rain expected');
  });

  it('uses the best contiguous activity window for daily forecasts instead of one isolated hour', () => {
    const drone = ACTIVITY_DEFINITIONS.find((definition) => definition.id === 'drone')!;
    const result = evaluateActivity(drone, {
      coordinates: { latitude: 50, longitude: 14 },
      now: '2026-08-01T12:00:00+02:00',
      hourly: [
        hour('2026-08-01T12:00:00+02:00'),
        hour('2026-08-01T13:00:00+02:00', {
          weather: {
            ...hour('2026-08-01T13:00:00+02:00').weather,
            windSpeed: 14,
            windGusts: 18,
            precipitation: 1.8,
          },
        }),
        hour('2026-08-01T14:00:00+02:00'),
        hour('2026-08-01T15:00:00+02:00'),
      ],
      enabledActivities: settings({ drone: true }),
    });

    const dailyWindow = bestActivityWindowForDate(result.hours, '2026-08-01');

    expect(dailyWindow.available).toBe(true);
    expect(dailyWindow.startTime).toBe('2026-08-01T14:00:00+02:00');
    expect(formatActivityWindow(dailyWindow)).toBe('14:00–16:00');
  });

  it('can evaluate Activity forecast days beyond the default short-term horizon when requested', () => {
    const drone = ACTIVITY_DEFINITIONS.find((definition) => definition.id === 'drone')!;
    const result = evaluateActivity(drone, {
      coordinates: { latitude: 50, longitude: 14 },
      now: '2026-08-01T12:00:00+02:00',
      hourly: [
        hour('2026-08-01T12:00:00+02:00'),
        hour('2026-08-01T13:00:00+02:00'),
        hour('2026-08-04T12:00:00+02:00'),
        hour('2026-08-04T13:00:00+02:00'),
        hour('2026-08-07T12:00:00+02:00'),
        hour('2026-08-07T13:00:00+02:00'),
      ],
      enabledActivities: settings({ drone: true }),
      forecastDates: ['2026-08-01', '2026-08-04', '2026-08-07'],
    });

    expect(result.hours.map((item) => item.timestamp)).toContain('2026-08-07T12:00:00+02:00');
    expect(bestActivityWindowForDate(result.hours, '2026-08-07').available).toBe(true);
  });

  it('builds a 24-hour Activity timeline and marks best-window rows', () => {
    const drone = ACTIVITY_DEFINITIONS.find((definition) => definition.id === 'drone')!;
    const result = evaluateActivity(drone, {
      coordinates: { latitude: 50, longitude: 14 },
      now: '2026-08-01T12:00:00+02:00',
      hourly: [
        hour('2026-08-01T12:00:00+02:00'),
        hour('2026-08-01T13:00:00+02:00'),
        hour('2026-08-01T14:00:00+02:00', {
          weather: {
            ...hour('2026-08-01T14:00:00+02:00').weather,
            precipitation: 3,
          },
        }),
        hour('2026-08-02T12:00:00+02:00'),
        hour('2026-08-02T13:00:00+02:00'),
      ],
      enabledActivities: settings({ drone: true }),
      forecastDates: ['2026-08-01', '2026-08-02'],
    });

    const rows = buildActivityTimelineRows(
      result.hours,
      '2026-08-01T12:00:00+02:00',
      result.bestWindow,
    );

    expect(rows.map((row) => row.timestamp)).toContain('2026-08-02T12:00:00+02:00');
    expect(rows.map((row) => row.timestamp)).not.toContain('2026-08-02T13:00:00+02:00');
    expect(rows[0]?.now).toBe(true);
    expect(rows.some((row) => row.markerLabel === 'Best')).toBe(true);
    expect(rows.every((row) => row.score > 0)).toBe(true);
  });

  it('can mark the best 24-hour Activity timeline window even when the overall best is later', () => {
    const photography = ACTIVITY_DEFINITIONS.find((definition) => definition.id === 'photography')!;
    const result = evaluateActivity(photography, {
      coordinates: { latitude: 50, longitude: 14 },
      now: '2026-08-01T12:00:00+02:00',
      hourly: [
        hour('2026-08-01T12:00:00+02:00'),
        hour('2026-08-01T13:00:00+02:00'),
        hour('2026-08-02T18:00:00+02:00'),
        hour('2026-08-02T19:00:00+02:00'),
        hour('2026-08-02T20:00:00+02:00'),
        hour('2026-08-02T21:00:00+02:00'),
      ],
      enabledActivities: settings({ photography: true }),
      forecastDates: ['2026-08-01', '2026-08-02'],
    });
    const timelineBestWindow = bestActivityWindowForRange(
      result.hours,
      '2026-08-01T12:00:00+02:00',
      24,
    );
    const rows = buildActivityTimelineRows(
      result.hours,
      '2026-08-01T12:00:00+02:00',
      timelineBestWindow,
    );

    expect(result.bestWindow.startTime).toBe('2026-08-02T18:00:00+02:00');
    expect(timelineBestWindow.startTime).toBe('2026-08-01T12:00:00+02:00');
    expect(formatActivityWindow(timelineBestWindow, '2026-08-01T12:00:00+02:00')).toBe(
      '12:00–14:00',
    );
    expect(rows.some((row) => row.markerLabel === 'Best')).toBe(true);
  });

  it('labels activity best windows that start tomorrow', () => {
    expect(
      formatActivityWindow(
        {
          available: true,
          startTime: '2026-08-02T18:00:00+02:00',
          endTime: '2026-08-02T20:00:00+02:00',
          averageScore: 88,
          minimumScore: 88,
          category: 'excellent',
        },
        '2026-08-01T12:00:00+02:00',
      ),
    ).toBe('18:00–20:00 (tomorrow)');
  });

  it('does not label activity best windows as tomorrow when only the end crosses midnight', () => {
    expect(
      formatActivityWindow(
        {
          available: true,
          startTime: '2026-08-01T23:00:00+02:00',
          endTime: '2026-08-02T01:00:00+02:00',
          averageScore: 82,
          minimumScore: 82,
          category: 'good',
        },
        '2026-08-01T12:00:00+02:00',
      ),
    ).toBe('23:00–01:00');
  });

  it('marks missing required variables as insufficient data without fabricating zeroes', () => {
    const photography = ACTIVITY_DEFINITIONS.find((definition) => definition.id === 'photography')!;
    const result = evaluateActivity(photography, {
      coordinates: { latitude: 50, longitude: 14 },
      now: '2026-08-01T12:00:00+02:00',
      hourly: [
        hour('2026-08-01T12:00:00+02:00', {
          weather: { ...hour('2026-08-01T12:00:00+02:00').weather, visibility: null },
          extended: {
            ...hour('2026-08-01T12:00:00+02:00').extended!,
            weather: {
              ...hour('2026-08-01T12:00:00+02:00').extended!.weather,
              visibility: null,
            },
          },
        }),
      ],
      enabledActivities: settings({ photography: true }),
    });

    expect(result.current?.available).toBe(false);
    expect(result.current?.missingRequiredVariables).toContain('extendedVisibility');
    expect(result.current?.score).toBeNull();
  });

  it('deduplicates Open-Meteo variables required by enabled activities', () => {
    const variables = activityOpenMeteoVariables(['photography', 'drone', 'outdoor_sports']);

    expect(variables.weather.filter((variable) => variable === 'wind_gusts_10m')).toHaveLength(1);
    expect(variables.weather).toContain('visibility');
    expect(variables.weather).toContain('apparent_temperature');
    expect(variables.airQuality).toContain('pm2_5');
    expect(variables.airQuality).toContain('ozone');
  });

  it('gives every Activity detail variable a shared data-detail definition', () => {
    const unsupported = ACTIVITY_DEFINITIONS.flatMap((definition) =>
      definition.detailVariables.filter((variableId) => dataDetailVariable(variableId) === null),
    );

    expect(unsupported).toEqual([]);
  });
});

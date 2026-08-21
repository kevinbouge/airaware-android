import {
  detectEnvironmentalEvents,
  environmentalEventNeedsNotification,
  environmentalEventNotificationStateAfterDelivery,
  freshEnvironmentalEventNotificationState,
} from '../src/core/environmentalEvents';
import type {
  CurrentEnvironmentalReadings,
  HourlyEnvironmentalReading,
  NormalizedEnvironment,
  RiskCategoryId,
} from '../src/models/environment';
import { DEFAULT_PROFILE, DEFAULT_SETTINGS } from '../src/models/profile';

const locationId = 'manual-prague';
const coordinates = { latitude: 50.0755, longitude: 14.4378 };
const baseTime = '2026-08-01T12:00:00Z';

type ReadingOverrides = Omit<
  Partial<CurrentEnvironmentalReadings>,
  | 'pollen'
  | 'regulatedPollutants'
  | 'pollutantAqi'
  | 'atmosphericIrritants'
  | 'weather'
  | 'extended'
> & {
  pollen?: Partial<CurrentEnvironmentalReadings['pollen']>;
  regulatedPollutants?: Partial<CurrentEnvironmentalReadings['regulatedPollutants']>;
  pollutantAqi?: Partial<CurrentEnvironmentalReadings['pollutantAqi']>;
  atmosphericIrritants?: Partial<CurrentEnvironmentalReadings['atmosphericIrritants']>;
  weather?: Partial<CurrentEnvironmentalReadings['weather']>;
  extended?: {
    airQuality?: Partial<NonNullable<CurrentEnvironmentalReadings['extended']>['airQuality']>;
    weather?: Partial<NonNullable<CurrentEnvironmentalReadings['extended']>['weather']>;
  };
};

function mold(score: number | null, category: RiskCategoryId) {
  return {
    available: score !== null,
    score,
    displayScore: score,
    category,
    completeness: score !== null ? 1 : 0,
    confidence: score !== null ? 1 : 0,
    components: {},
    missingComponents: score === null ? ['mold'] : [],
  };
}

function reading(overrides: ReadingOverrides = {}): CurrentEnvironmentalReadings {
  return {
    timestamp: baseTime,
    pollen: {
      alder: 1,
      birch: 1,
      grass: 1,
      mugwort: 1,
      olive: 1,
      ragweed: 1,
      ...overrides.pollen,
    },
    regulatedPollutants: {
      pm25: 5,
      pm10: 8,
      nitrogenDioxide: 4,
      ozone: 40,
      sulphurDioxide: 1,
      ...overrides.regulatedPollutants,
    },
    pollutantAqi: {
      pm25: 10,
      pm10: 12,
      nitrogenDioxide: 8,
      ozone: 20,
      sulphurDioxide: 2,
      ...overrides.pollutantAqi,
    },
    aqiLabel: 'EU AQI',
    atmosphericIrritants: {
      carbonMonoxide: 120,
      aerosolOpticalDepth: 0.05,
      dust: 2,
      wildfirePm10: 0,
      ...overrides.atmosphericIrritants,
    },
    weather: {
      temperature: 20,
      relativeHumidity: 45,
      dewPoint: 10,
      precipitation: 0,
      windSpeed: 2,
      windDirection: 90,
      windGusts: 4,
      visibility: 20_000,
      leafWetnessProbability: 0,
      ...overrides.weather,
    },
    extended: {
      airQuality: {
        carbonDioxide: null,
        ammonia: null,
        methane: null,
        nitrogenMonoxide: null,
        formaldehyde: null,
        glyoxal: null,
        nonMethaneVolatileOrganicCompounds: null,
        peroxyacylNitrates: null,
        secondaryInorganicAerosol: null,
        residentialElementaryCarbon: null,
        totalElementaryCarbon: null,
        pm25TotalOrganicMatter: null,
        seaSaltAerosol: null,
        uvIndexClearSky: null,
        ...overrides.extended?.airQuality,
      },
      weather: {
        apparentTemperature: null,
        precipitationProbability: null,
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
        soilMoisture0To1cm: null,
        soilTemperature0cm: null,
        et0FaoEvapotranspiration: null,
        vapourPressureDeficit: null,
        ...overrides.extended?.weather,
      },
    },
    moldPotential: overrides.moldPotential ?? mold(10, 'low'),
    uvIndex: overrides.uvIndex ?? 2,
  };
}

function hour(offsetHours: number, overrides: ReadingOverrides) {
  return {
    ...reading(overrides),
    timestamp: new Date(Date.parse(baseTime) + offsetHours * 60 * 60 * 1000).toISOString(),
  } satisfies HourlyEnvironmentalReading;
}

function environment(
  hourly: HourlyEnvironmentalReading[],
  current: CurrentEnvironmentalReadings = reading(),
): NormalizedEnvironment {
  return {
    provider: 'open-meteo',
    coordinates,
    placeName: 'Prague',
    fetchedAt: baseTime,
    current,
    hourly,
    forecastDays: [],
    metadata: {
      timezone: 'Europe/Prague',
      airQualityFetchedAt: baseTime,
      weatherFetchedAt: baseTime,
      airQualityModel: 'auto',
      airQualitySource: 'fresh',
      weatherSource: 'fresh',
      partial: false,
    },
  };
}

function detect(
  hourly: HourlyEnvironmentalReading[],
  current: CurrentEnvironmentalReadings = reading(),
) {
  return detectEnvironmentalEvents(environment(hourly, current), {
    locationId,
    profile: DEFAULT_PROFILE,
    settings: DEFAULT_SETTINGS,
  });
}

describe('environmental event detection', () => {
  it('groups multi-hour pollen episodes and selects the peak', () => {
    const events = detect(
      [
        hour(1, { pollen: { grass: 100 } }),
        hour(2, { pollen: { grass: 140 } }),
        hour(3, { pollen: { grass: 260 } }),
        hour(4, { pollen: { grass: 120 } }),
      ],
      reading({ pollen: { grass: 20 } }),
    );

    expect(events[0]).toMatchObject({
      type: 'pollen',
      factor: 'grass',
      severity: 'very-high',
      startTime: '2026-08-01T13:00:00.000Z',
      endTime: '2026-08-01T16:00:00.000Z',
      peakTime: '2026-08-01T15:00:00.000Z',
    });
  });

  it('ignores low to moderate pollen changes and stable high pollen', () => {
    expect(detect([hour(1, { pollen: { grass: 20 } })])).toEqual([]);

    const stableHigh = detect(
      [hour(1, { pollen: { grass: 120 } }), hour(2, { pollen: { grass: 140 } })],
      reading({ pollen: { grass: 110 } }),
    );
    expect(stableHigh.find((event) => event.type === 'pollen')).toBeUndefined();
  });

  it('chooses the dominant pollen factor when several species worsen together', () => {
    const events = detect(
      [
        hour(1, { pollen: { grass: 100, birch: 260 } }),
        hour(2, { pollen: { grass: 120, birch: 520 } }),
      ],
      reading({ pollen: { grass: 20, birch: 50 } }),
    );

    expect(events.find((event) => event.type === 'pollen')).toMatchObject({
      factor: 'birch',
      severity: 'very-high',
    });
  });

  it('detects dominant pollutant episodes without duplicating simultaneous pollutants', () => {
    const events = detect([
      hour(1, {
        regulatedPollutants: { pm25: 40, pm10: 130 },
        pollutantAqi: { pm25: 82, pm10: 72 },
      }),
      hour(2, {
        regulatedPollutants: { pm25: 45, pm10: 140 },
        pollutantAqi: { pm25: 86, pm10: 75 },
      }),
    ]);

    const pollution = events.filter((event) => event.type === 'pollution');
    expect(pollution).toHaveLength(1);
    expect(pollution[0]).toMatchObject({ factor: 'pm25', severity: 'very-high' });
  });

  it('keeps an independent ozone episode alongside Saharan dust', () => {
    const events = detect([
      hour(1, {
        atmosphericIrritants: { dust: 260, aerosolOpticalDepth: 0.8 },
        regulatedPollutants: { pm10: 150, ozone: 250 },
        pollutantAqi: { pm10: 80, ozone: 90 },
      }),
      hour(2, {
        atmosphericIrritants: { dust: 300, aerosolOpticalDepth: 0.9 },
        regulatedPollutants: { pm10: 160, ozone: 260 },
        pollutantAqi: { pm10: 82, ozone: 94 },
      }),
    ]);

    expect(events.map((event) => [event.type, event.factor])).toEqual(
      expect.arrayContaining([
        ['saharan-dust', 'dust'],
        ['pollution', 'ozone'],
      ]),
    );
    expect(events.find((event) => event.type === 'aerosol')).toBeUndefined();
    expect(
      events.find((event) => event.type === 'pollution' && event.factor === 'pm10'),
    ).toBeUndefined();
  });

  it('orders same-severity source-attributed events ahead of generic pollen events', () => {
    const events = detect(
      [
        hour(1, {
          pollen: { grass: 260 },
          atmosphericIrritants: { dust: 260, aerosolOpticalDepth: 0.8 },
          regulatedPollutants: { pm10: 150 },
          pollutantAqi: { pm10: 82 },
        }),
        hour(2, {
          pollen: { grass: 280 },
          atmosphericIrritants: { dust: 300, aerosolOpticalDepth: 0.9 },
          regulatedPollutants: { pm10: 160 },
          pollutantAqi: { pm10: 84 },
        }),
      ],
      reading({ pollen: { grass: 20 } }),
    );

    expect(events[0]).toMatchObject({ type: 'saharan-dust', severity: 'very-high' });
  });

  it('does not infer Saharan dust from AOD or PM10 without the dust variable', () => {
    const events = detect([
      hour(1, {
        atmosphericIrritants: { dust: null, aerosolOpticalDepth: 0.9 },
        regulatedPollutants: { pm10: 150 },
        pollutantAqi: { pm10: 90 },
      }),
      hour(2, {
        atmosphericIrritants: { dust: null, aerosolOpticalDepth: 1.0 },
        regulatedPollutants: { pm10: 160 },
        pollutantAqi: { pm10: 92 },
      }),
    ]);

    expect(events.find((event) => event.type === 'saharan-dust')).toBeUndefined();
  });

  it('requires wildfire-attributed PM10 for wildfire-pollution events', () => {
    const wildfire = detect([
      hour(1, {
        atmosphericIrritants: { wildfirePm10: 60, aerosolOpticalDepth: 0.7 },
        regulatedPollutants: { pm25: 40, pm10: 80 },
        extended: { airQuality: { pm25TotalOrganicMatter: 12, totalElementaryCarbon: 3 } },
      }),
      hour(2, {
        atmosphericIrritants: { wildfirePm10: 70, aerosolOpticalDepth: 0.8 },
        regulatedPollutants: { pm25: 45, pm10: 90 },
        extended: { airQuality: { pm25TotalOrganicMatter: 14, totalElementaryCarbon: 4 } },
      }),
    ]);
    expect(wildfire.find((event) => event.type === 'wildfire-pollution')).toMatchObject({
      factor: 'pm10_wildfires',
    });

    const genericPm = detect([
      hour(1, { atmosphericIrritants: { wildfirePm10: null }, regulatedPollutants: { pm25: 40 } }),
      hour(2, { atmosphericIrritants: { wildfirePm10: null }, regulatedPollutants: { pm25: 45 } }),
    ]);
    expect(genericPm.find((event) => event.type === 'wildfire-pollution')).toBeUndefined();
  });

  it('detects UV, mold, and headline risk worsening episodes from existing models', () => {
    const events = detect(
      [
        hour(1, { uvIndex: 8, moldPotential: mold(82, 'veryHigh'), pollen: { grass: 260 } }),
        hour(2, { uvIndex: 9, moldPotential: mold(88, 'veryHigh'), pollen: { grass: 280 } }),
      ],
      reading({ uvIndex: 2, moldPotential: mold(20, 'low'), pollen: { grass: 1 } }),
    );

    expect(events.map((event) => event.type)).toEqual(
      expect.arrayContaining(['uv', 'mold', 'headline-risk']),
    );
  });
});

describe('environmental event notification deduplication', () => {
  const event = detect([
    hour(1, { atmosphericIrritants: { dust: 260 } }),
    hour(2, { atmosphericIrritants: { dust: 300 } }),
  ])[0]!;
  const settings = {
    ...DEFAULT_SETTINGS,
    environmentalEventNotifications: {
      ...DEFAULT_SETTINGS.environmentalEventNotifications,
      saharanDust: true,
    },
  };

  it('notifies once for a new event fingerprint and suppresses identical refreshes', () => {
    expect(environmentalEventNeedsNotification({ event, settings, state: null })).toBe(true);

    const state = environmentalEventNotificationStateAfterDelivery({
      event,
      state: null,
      deliveredAt: '2026-08-01T12:10:00Z',
    });

    expect(
      environmentalEventNeedsNotification({
        event,
        settings,
        state,
        now: new Date('2026-08-01T12:15:00Z'),
      }),
    ).toBe(false);
  });

  it('expires old fingerprints and honors disabled categories', () => {
    const state = environmentalEventNotificationStateAfterDelivery({
      event,
      state: null,
      deliveredAt: '2026-07-29T12:00:00Z',
    });

    expect(
      freshEnvironmentalEventNotificationState(state, new Date('2026-08-01T12:00:00Z')).records,
    ).toHaveLength(0);
    expect(
      environmentalEventNeedsNotification({
        event,
        settings: DEFAULT_SETTINGS,
        state: null,
      }),
    ).toBe(false);
  });
});

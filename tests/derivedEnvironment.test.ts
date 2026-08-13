import { deriveEnvironmentState } from '../src/state/derivedEnvironment';
import { calculateMoldPotential } from '../src/core/moldPotential';
import { calculatePersonalizedScore } from '../src/core/profileScoring';
import { calculateEnvironmentalScore } from '../src/core/scoring';
import type { HourlyEnvironmentalReading, NormalizedEnvironment } from '../src/models/environment';
import { DEFAULT_PROFILE, type PersonalAllergyProfile } from '../src/models/profile';

function hour(timestamp: string, grass: number): HourlyEnvironmentalReading {
  const weather = {
    temperature: 20,
    relativeHumidity: 65,
    dewPoint: 12,
    precipitation: 0,
    windSpeed: 3,
    windDirection: null,
    windGusts: null,
    visibility: null,
    leafWetnessProbability: 30,
  };

  return {
    timestamp,
    pollen: { alder: null, birch: null, grass, mugwort: null, olive: null, ragweed: null },
    regulatedPollutants: {
      pm25: 5,
      pm10: 8,
      nitrogenDioxide: 5,
      ozone: 20,
      sulphurDioxide: 1,
    },
    pollutantAqi: { pm25: 12, pm10: 10, nitrogenDioxide: 6, ozone: 18, sulphurDioxide: 2 },
    aqiLabel: 'EU AQI',
    atmosphericIrritants: {
      carbonMonoxide: 100,
      aerosolOpticalDepth: 0.05,
      dust: 10,
      wildfirePm10: null,
    },
    weather,
    moldPotential: calculateMoldPotential(weather),
    uvIndex: null,
  };
}

function profile(): PersonalAllergyProfile {
  return {
    enabled: true,
    factors: {
      ...DEFAULT_PROFILE.factors,
      pollen_grass: true,
      pollen_alder: false,
      pollen_birch: false,
      pollen_mugwort: false,
      pollen_olive: false,
      pollen_ragweed: false,
      mold: false,
      pm25: false,
      pm10: false,
      nitrogen_dioxide: false,
      ozone: false,
      sulphur_dioxide: false,
      carbon_monoxide: false,
      aerosol_optical_depth: false,
      dust: false,
      wildfire_pm10: false,
      uv_index: false,
    },
  };
}

describe('derived environment forecast state', () => {
  it('exposes personalized daily forecasts alongside environmental daily forecasts', () => {
    const hourly = [hour('2026-08-01T12:00:00Z', 20), hour('2026-08-02T12:00:00Z', 120)];
    const environment: NormalizedEnvironment = {
      provider: 'open-meteo',
      coordinates: { latitude: 50, longitude: 14 },
      placeName: 'Prague',
      fetchedAt: '2026-08-01T12:00:00Z',
      current: {
        timestamp: hourly[0]?.timestamp ?? null,
        pollen: hourly[0]?.pollen ?? {
          alder: null,
          birch: null,
          grass: null,
          mugwort: null,
          olive: null,
          ragweed: null,
        },
        regulatedPollutants: hourly[0]?.regulatedPollutants ?? {
          pm25: null,
          pm10: null,
          nitrogenDioxide: null,
          ozone: null,
          sulphurDioxide: null,
        },
        pollutantAqi: hourly[0]?.pollutantAqi ?? {
          pm25: null,
          pm10: null,
          nitrogenDioxide: null,
          ozone: null,
          sulphurDioxide: null,
        },
        aqiLabel: 'EU AQI',
        atmosphericIrritants: hourly[0]?.atmosphericIrritants ?? {
          carbonMonoxide: null,
          aerosolOpticalDepth: null,
          dust: null,
          wildfirePm10: null,
        },
        weather: hourly[0]?.weather ?? {
          temperature: null,
          relativeHumidity: null,
          dewPoint: null,
          precipitation: null,
          windSpeed: null,
          windDirection: null,
          windGusts: null,
          visibility: null,
          leafWetnessProbability: null,
        },
        moldPotential:
          hourly[0]?.moldPotential ??
          calculateMoldPotential({
            temperature: null,
            relativeHumidity: null,
            dewPoint: null,
            precipitation: null,
            windSpeed: null,
            leafWetnessProbability: null,
          }),
        uvIndex: null,
      },
      hourly,
      forecastDays: [
        {
          date: '2026-08-01',
          label: 'Today',
          score: calculateEnvironmentalScore(hourly[0]!),
        },
        {
          date: '2026-08-02',
          label: 'Tomorrow',
          score: calculateEnvironmentalScore(hourly[1]!),
        },
      ],
      metadata: {
        timezone: 'UTC',
        airQualityFetchedAt: '2026-08-01T12:00:00Z',
        weatherFetchedAt: '2026-08-01T12:00:00Z',
        airQualitySource: 'fresh',
        weatherSource: 'fresh',
        partial: false,
      },
    };

    const derived = deriveEnvironmentState(environment, profile());

    expect(derived.personalizedForecastDays).toHaveLength(2);
    expect(derived.personalizedForecastDays[0]?.score?.available).toBe(true);
    expect(derived.personalizedForecastDays[1]?.score?.score).toBeGreaterThan(
      derived.personalizedForecastDays[0]?.score?.score ?? 0,
    );
    expect(environment.forecastDays[0]?.score?.available).toBe(true);
  });

  it('does not use past current-day hours for personalized daily forecasts', () => {
    const hourly = [
      hour('2026-08-01T06:00:00Z', 180),
      hour('2026-08-01T13:00:00Z', 20),
      hour('2026-08-02T12:00:00Z', 120),
    ];
    const current = hourly[1]!;
    const environment: NormalizedEnvironment = {
      provider: 'open-meteo',
      coordinates: { latitude: 50, longitude: 14 },
      placeName: 'Prague',
      fetchedAt: '2026-08-01T12:00:00Z',
      current: {
        timestamp: '2026-08-01T12:00:00Z',
        pollen: current.pollen,
        regulatedPollutants: current.regulatedPollutants,
        pollutantAqi: current.pollutantAqi,
        aqiLabel: current.aqiLabel,
        atmosphericIrritants: current.atmosphericIrritants,
        weather: current.weather,
        moldPotential: current.moldPotential,
        uvIndex: current.uvIndex,
      },
      hourly,
      forecastDays: [
        {
          date: '2026-08-01',
          label: 'Today',
          score: calculateEnvironmentalScore(current),
        },
        {
          date: '2026-08-02',
          label: 'Tomorrow',
          score: calculateEnvironmentalScore(hourly[2]!),
        },
      ],
      metadata: {
        timezone: 'UTC',
        airQualityFetchedAt: '2026-08-01T12:00:00Z',
        weatherFetchedAt: '2026-08-01T12:00:00Z',
        airQualitySource: 'fresh',
        weatherSource: 'fresh',
        partial: false,
      },
    };
    const testProfile = profile();
    const derived = deriveEnvironmentState(environment, testProfile);

    expect(derived.personalizedForecastDays[0]?.score?.score).toBe(
      calculatePersonalizedScore(current, testProfile).score,
    );
    expect(derived.personalizedForecastDays[0]?.score?.score).toBeLessThan(
      derived.personalizedForecastDays[1]?.score?.score ?? 0,
    );
  });
});

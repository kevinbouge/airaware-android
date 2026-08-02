import { calculateMoldPotential } from '../src/core/moldPotential';
import { calculateUvBurden } from '../src/core/profileScoring';
import {
  calculateAtmosphericIrritantsComponent,
  calculateEnvironmentalScore,
  calculatePollenComponent,
  calculateRegulatedPollutionComponent,
} from '../src/core/scoring';
import type { CurrentEnvironmentalReadings } from '../src/models/environment';

function reading(
  overrides: Partial<CurrentEnvironmentalReadings> = {},
): CurrentEnvironmentalReadings {
  const moldPotential = calculateMoldPotential({
    temperature: 20,
    relativeHumidity: 75,
    dewPoint: 16,
    precipitation: 3,
    windSpeed: 1,
    leafWetnessProbability: 70,
  });

  return {
    timestamp: '2026-08-01T12:00',
    pollen: { alder: 0, birch: 20, grass: 120, mugwort: null, olive: null, ragweed: null },
    regulatedPollutants: {
      pm25: 10,
      pm10: 20,
      nitrogenDioxide: 10,
      ozone: 80,
      sulphurDioxide: 4,
    },
    pollutantAqi: { pm25: 20, pm10: 30, nitrogenDioxide: 10, ozone: 55, sulphurDioxide: 5 },
    aqiLabel: 'EU AQI',
    atmosphericIrritants: {
      carbonMonoxide: 300,
      aerosolOpticalDepth: 0.2,
      dust: 40,
      wildfirePm10: null,
    },
    weather: {
      temperature: 20,
      relativeHumidity: 75,
      dewPoint: 16,
      precipitation: 3,
      windSpeed: 1,
      windDirection: 180,
      windGusts: 5,
      visibility: 10000,
      leafWetnessProbability: 70,
    },
    moldPotential,
    uvIndex: 7,
    ...overrides,
  };
}

describe('environmental scoring', () => {
  it('uses the highest available pollen burden', () => {
    const component = calculatePollenComponent({
      alder: 1,
      birch: 5,
      grass: 120,
      mugwort: null,
      olive: null,
      ragweed: null,
    });

    expect(component.available).toBe(true);
    expect(component.dominantId).toBe('pollen_grass');
    expect(component.score).toBeGreaterThan(75);
  });

  it('uses the highest pollutant-specific AQI when available', () => {
    const component = calculateRegulatedPollutionComponent(
      { pm25: 10, pm10: 12, nitrogenDioxide: 20, ozone: 70, sulphurDioxide: 3 },
      { pm25: 99, pm10: 99, nitrogenDioxide: 99, ozone: 99, sulphurDioxide: 99 },
    );

    expect(component.dominantId).toBe('ozone');
    expect(component.score).toBe(70);
  });

  it('renormalizes atmospheric irritants when optional values are missing', () => {
    const component = calculateAtmosphericIrritantsComponent({
      carbonMonoxide: 1000,
      aerosolOpticalDepth: null,
      dust: 80,
      wildfirePm10: null,
    });

    expect(component.available).toBe(true);
    expect(component.completeness).toBeLessThan(1);
    expect(component.score).toBeGreaterThan(0);
  });

  it('keeps the overall score bounded from 0 to 100', () => {
    const score = calculateEnvironmentalScore(reading());

    expect(score.available).toBe(true);
    expect(score.score).toBeGreaterThanOrEqual(0);
    expect(score.score).toBeLessThanOrEqual(100);
    expect(
      Object.values(score.effectiveWeights).reduce((sum, value) => sum + value, 0),
    ).toBeCloseTo(1);
  });

  it('omits unavailable mold instead of treating it as zero', () => {
    const score = calculateEnvironmentalScore(
      reading({
        moldPotential: {
          available: false,
          score: null,
          displayScore: null,
          category: 'unavailable',
          completeness: 0,
          confidence: 0,
          components: {},
          missingComponents: ['relativeHumidity'],
        },
      }),
    );

    expect(score.effectiveWeights.mold).toBeUndefined();
    expect(
      Object.values(score.effectiveWeights).reduce((sum, value) => sum + value, 0),
    ).toBeCloseTo(1);
  });
});

describe('mold and UV burden', () => {
  it('returns unavailable mold when humidity is missing', () => {
    const mold = calculateMoldPotential({
      temperature: 20,
      relativeHumidity: null,
      dewPoint: 18,
      precipitation: 2,
      windSpeed: 2,
      leafWetnessProbability: 50,
    });

    expect(mold.available).toBe(false);
  });

  it('raises mold potential for humid and wet conditions', () => {
    const mold = calculateMoldPotential({
      temperature: 22,
      relativeHumidity: 88,
      dewPoint: 21,
      precipitation: 12,
      windSpeed: 1,
      leafWetnessProbability: 90,
    });

    expect(mold.available).toBe(true);
    expect(mold.score).toBeGreaterThan(80);
  });

  it('maps UV continuously and rejects invalid UV', () => {
    expect(calculateUvBurden(0)).toBe(0);
    expect(calculateUvBurden(7)).toBeGreaterThan(calculateUvBurden(3) ?? 0);
    expect(calculateUvBurden(12)).toBeLessThanOrEqual(100);
    expect(calculateUvBurden(-1)).toBeNull();
  });
});

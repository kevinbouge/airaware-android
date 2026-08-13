import { calculateMoldPotential } from '../src/core/moldPotential';
import { calculatePersonalizedScore } from '../src/core/profileScoring';
import type { CurrentEnvironmentalReadings } from '../src/models/environment';
import { DEFAULT_PROFILE, type PersonalAllergyProfile } from '../src/models/profile';

const baseReading: CurrentEnvironmentalReadings = {
  timestamp: '2026-08-01T12:00',
  pollen: { alder: null, birch: null, grass: 120, mugwort: null, olive: null, ragweed: null },
  regulatedPollutants: {
    pm25: 8,
    pm10: 12,
    nitrogenDioxide: 8,
    ozone: 45,
    sulphurDioxide: 2,
  },
  pollutantAqi: { pm25: 22, pm10: 18, nitrogenDioxide: 10, ozone: 50, sulphurDioxide: 3 },
  aqiLabel: 'EU AQI',
  atmosphericIrritants: {
    carbonMonoxide: 200,
    aerosolOpticalDepth: 0.1,
    dust: 20,
    wildfirePm10: null,
  },
  weather: {
    temperature: 20,
    relativeHumidity: 70,
    dewPoint: 15,
    precipitation: 1,
    windSpeed: 3,
    windDirection: null,
    windGusts: null,
    visibility: null,
    leafWetnessProbability: 50,
  },
  moldPotential: calculateMoldPotential({
    temperature: 20,
    relativeHumidity: 70,
    dewPoint: 15,
    precipitation: 1,
    windSpeed: 3,
    leafWetnessProbability: 50,
  }),
  uvIndex: 9,
};

function profile(): PersonalAllergyProfile {
  return {
    enabled: true,
    factors: Object.fromEntries(
      Object.keys(DEFAULT_PROFILE.factors).map((key) => [key, false]),
    ) as PersonalAllergyProfile['factors'],
  };
}

describe('personalized risk', () => {
  it('is unavailable when personalization is disabled', () => {
    const result = calculatePersonalizedScore(baseReading, { ...DEFAULT_PROFILE, enabled: false });
    expect(result.available).toBe(false);
    expect(result.reason).toBe('disabled');
  });

  it('uses only enabled selected groups', () => {
    const selected = profile();
    selected.factors.pollen_grass = true;
    const result = calculatePersonalizedScore(baseReading, selected);

    expect(result.available).toBe(true);
    expect(Object.keys(result.components)).toEqual(['pollen']);
    expect(result.dominantComponent).toBe('pollen');
  });

  it('does not let disabled high UV affect the score', () => {
    const selected = profile();
    selected.factors.pm25 = true;
    const withoutUv = calculatePersonalizedScore(baseReading, selected);
    selected.factors.uv_index = true;
    const withUv = calculatePersonalizedScore(baseReading, selected);

    expect(withUv.score).toBeGreaterThan(withoutUv.score ?? 0);
  });

  it('omits unavailable selected values and renormalizes', () => {
    const selected = profile();
    selected.factors.pollen_birch = true;
    selected.factors.pm25 = true;
    const result = calculatePersonalizedScore(baseReading, selected);

    expect(result.available).toBe(true);
    expect(result.missingComponents).toContain('pollen');
    expect(result.availableGroupCount).toBe(1);
  });
});

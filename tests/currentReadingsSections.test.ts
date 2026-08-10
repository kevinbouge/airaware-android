import { FREE_CAPABILITIES } from '../src/capabilities/config';
import {
  NO_DATA_AVAILABLE_LABEL,
  pollenReadingRows,
} from '../src/components/CurrentReadingsSections';
import {
  currentDataDetailValue,
  dataDetailRiskCategory,
  dataDetailVariable,
} from '../src/core/dataVariableMetadata';
import { calculateMoldPotential } from '../src/core/moldPotential';
import type { CurrentEnvironmentalReadings } from '../src/models/environment';

function currentReading(
  overrides: Partial<CurrentEnvironmentalReadings> = {},
): CurrentEnvironmentalReadings {
  const weather = {
    temperature: 20,
    relativeHumidity: 70,
    dewPoint: 14,
    precipitation: 0,
    windSpeed: 5,
    windDirection: 180,
    windGusts: 28,
    visibility: 14000,
    leafWetnessProbability: 40,
  };

  return {
    timestamp: '2026-08-01T12:00',
    pollen: { alder: null, birch: null, grass: null, mugwort: null, olive: null, ragweed: null },
    regulatedPollutants: {
      pm25: 8,
      pm10: 12,
      nitrogenDioxide: 10,
      ozone: 40,
      sulphurDioxide: 2,
    },
    pollutantAqi: { pm25: 18, pm10: 20, nitrogenDioxide: 10, ozone: 40, sulphurDioxide: 2 },
    aqiLabel: 'EU AQI',
    atmosphericIrritants: {
      carbonMonoxide: 300,
      aerosolOpticalDepth: 0.15,
      dust: 12,
      wildfirePm10: null,
    },
    weather,
    moldPotential: calculateMoldPotential(weather),
    uvIndex: 7,
    ...overrides,
  };
}

describe('Current readings sections', () => {
  it('uses a clear empty state when pollen data is unavailable', () => {
    expect(pollenReadingRows(currentReading(), FREE_CAPABILITIES)).toEqual([]);
    expect(NO_DATA_AVAILABLE_LABEL).toBe('No data available');
  });

  it('resolves current detail values from the current environmental model', () => {
    const current = currentReading({
      pollen: {
        alder: null,
        birch: null,
        grass: 42,
        mugwort: null,
        olive: null,
        ragweed: null,
      },
    });
    const grass = dataDetailVariable('pollen_grass');
    const mold = dataDetailVariable('moldPotential');
    const uv = dataDetailVariable('uvIndex');

    expect(grass && currentDataDetailValue(current, grass)).toBe(42);
    expect(mold && currentDataDetailValue(current, mold)).toBe(current.moldPotential.score);
    expect(uv && currentDataDetailValue(current, uv)).toBe(7);
  });

  it('maps scored detail values to existing risk categories without scoring advanced data', () => {
    const grass = dataDetailVariable('pollen_grass');
    const pm25 = dataDetailVariable('pm25');
    const mold = dataDetailVariable('moldPotential');
    const uv = dataDetailVariable('uvIndex');
    const pressure = dataDetailVariable('pressureMsl');

    expect(grass && dataDetailRiskCategory(grass, 80)).toBe('high');
    expect(pm25 && dataDetailRiskCategory(pm25, 30)).toBe('high');
    expect(mold && dataDetailRiskCategory(mold, 82)).toBe('veryHigh');
    expect(uv && dataDetailRiskCategory(uv, 7)).toBe('high');
    expect(pressure && dataDetailRiskCategory(pressure, 1018)).toBeNull();
  });
});

import {
  calculateEnvironmentalOutdoorWindow,
  calculatePersonalizedForecast,
} from '../src/core/outdoorWindow';
import { calculateMoldPotential } from '../src/core/moldPotential';
import type { HourlyEnvironmentalReading } from '../src/models/environment';
import { DEFAULT_PROFILE } from '../src/models/profile';

function hour(offset: number, grass: number, uv: number): HourlyEnvironmentalReading {
  const timestamp = new Date(Date.UTC(2026, 7, 1, offset, 0, 0)).toISOString();
  const weather = {
    temperature: 20,
    relativeHumidity: 60,
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
      pm25: null,
      pm10: null,
      nitrogenDioxide: null,
      ozone: null,
      sulphurDioxide: null,
    },
    pollutantAqi: {
      pm25: null,
      pm10: null,
      nitrogenDioxide: null,
      ozone: null,
      sulphurDioxide: null,
    },
    aqiLabel: 'EU AQI',
    atmosphericIrritants: {
      carbonMonoxide: null,
      aerosolOpticalDepth: null,
      dust: null,
      wildfirePm10: null,
    },
    weather,
    moldPotential: calculateMoldPotential(weather),
    uvIndex: uv,
  };
}

describe('personalized forecast and outdoor window', () => {
  it('selects the lowest average two-hour window', () => {
    const profile = {
      enabled: true,
      factors: { ...DEFAULT_PROFILE.factors, uv_index: true },
    };
    const forecast = calculatePersonalizedForecast(
      [hour(0, 120, 9), hour(1, 80, 8), hour(2, 10, 1), hour(3, 12, 1), hour(4, 100, 8)],
      profile,
      2,
      new Date(Date.UTC(2026, 7, 1, 0, 0, 0)),
    );

    expect(forecast.bestWindow.available).toBe(true);
    expect(forecast.bestWindow.startTime).toBe(hour(2, 10, 1).timestamp);
    expect(forecast.peak?.result.score).toBeGreaterThan(forecast.bestWindow.averageScore ?? 0);
  });

  it('does not recommend a non-contiguous window', () => {
    const profile = { enabled: true, factors: { ...DEFAULT_PROFILE.factors, uv_index: true } };
    const first = hour(0, 10, 1);
    const later = { ...hour(3, 10, 1), timestamp: hour(3, 10, 1).timestamp };
    const forecast = calculatePersonalizedForecast([first, later], profile, 2);

    expect(forecast.bestWindow.available).toBe(false);
  });

  it('ignores past hours when calculating the next 24-hour forecast', () => {
    const profile = { enabled: true, factors: { ...DEFAULT_PROFILE.factors, uv_index: true } };
    const forecast = calculatePersonalizedForecast(
      [hour(0, 5, 1), hour(1, 100, 8), hour(2, 10, 1), hour(3, 12, 1)],
      profile,
      2,
      new Date(Date.UTC(2026, 7, 1, 2, 0, 0)),
    );

    expect(forecast.hours).toHaveLength(2);
    expect(forecast.hours[0]?.timestamp).toBe(hour(2, 10, 1).timestamp);
    expect(forecast.bestWindow.available).toBe(true);
    expect(forecast.bestWindow.startTime).toBe(hour(2, 10, 1).timestamp);
  });

  it('can recommend an environmental outdoor window when personalization is disabled', () => {
    const window = calculateEnvironmentalOutdoorWindow(
      [hour(0, 120, 9), hour(1, 80, 8), hour(2, 10, 1), hour(3, 12, 1)],
      2,
      new Date(Date.UTC(2026, 7, 1, 0, 0, 0)),
    );

    expect(window.available).toBe(true);
    expect(window.startTime).toBe(hour(2, 10, 1).timestamp);
  });

  it('preserves provider-local timestamp style for outdoor-window end times', () => {
    const localHour = {
      ...hour(0, 10, 1),
      timestamp: '2026-08-01T23:00:00+02:00',
    };
    const window = calculateEnvironmentalOutdoorWindow(
      [localHour],
      1,
      new Date('2026-08-01T21:00:00Z'),
    );

    expect(window.available).toBe(true);
    expect(window.startTime).toBe('2026-08-01T23:00:00+02:00');
    expect(window.endTime).toBe('2026-08-02T00:00:00+02:00');
  });
});

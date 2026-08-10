import { buildDataDetailUrl, normalizeDataDetailSource } from '../src/api/openMeteoDataDetail';
import { calculateMoldPotential } from '../src/core/moldPotential';
import { dataDetailVariable } from '../src/core/dataVariableMetadata';

const coordinates = { latitude: 50.0755, longitude: 14.4378 };

function variable(id: Parameters<typeof dataDetailVariable>[0]) {
  const definition = dataDetailVariable(id);
  if (!definition) throw new Error(`Missing test variable ${id}`);
  return definition;
}

describe('Open-Meteo data detail provider', () => {
  it('builds air-quality history URLs with variable-scoped hourly requests', () => {
    const url = buildDataDetailUrl({
      coordinates,
      variable: variable('pollen_grass'),
      source: 'history',
      startDate: '2026-08-01',
      endDate: '2026-08-10',
    });

    expect(url).toContain('https://air-quality-api.open-meteo.com/v1/air-quality?');
    expect(url).toContain('hourly=grass_pollen');
    expect(url).toContain('start_date=2026-08-01');
    expect(url).toContain('end_date=2026-08-10');
    expect(url).toContain('timezone=auto');
    expect(url).not.toContain('geometry');
  });

  it('builds weather forecast URLs with supported forecast hours and wind units', () => {
    const url = buildDataDetailUrl({
      coordinates,
      variable: variable('extendedWindGusts'),
      source: 'forecast',
      forecastHours: 72,
    });

    expect(url).toContain('https://api.open-meteo.com/v1/forecast?');
    expect(url).toContain('hourly=wind_gusts_10m');
    expect(url).toContain('forecast_hours=72');
    expect(url).toContain('wind_speed_unit=ms');
  });

  it('builds historical weather URLs through the historical forecast host', () => {
    const url = buildDataDetailUrl({
      coordinates,
      variable: variable('uvIndex'),
      source: 'history',
      startDate: '2026-08-01',
      endDate: '2026-08-10',
    });

    expect(url).toContain('https://historical-forecast-api.open-meteo.com/v1/forecast?');
    expect(url).toContain('hourly=uv_index');
  });

  it('requests daily leaf wetness for mold timelines', () => {
    const url = buildDataDetailUrl({
      coordinates,
      variable: variable('moldPotential'),
      source: 'forecast',
      forecastHours: 24,
    });

    expect(url).toContain('hourly=temperature_2m');
    expect(url).toContain('daily=leaf_wetness_probability_mean');
  });

  it('normalizes selected numeric values and keeps missing values null', () => {
    const result = normalizeDataDetailSource(
      {
        latitude: 50,
        longitude: 14,
        timezone: 'Europe/Prague',
        utc_offset_seconds: 7200,
        hourly: {
          time: ['2026-08-10T10:00', 'bad', '2026-08-10T12:00'],
          pm2_5: [8, 10, Number.NaN],
        },
      },
      variable('pm25'),
      'history',
    );

    expect(result.timezone).toBe('Europe/Prague');
    expect(result.points).toEqual([
      { timestamp: '2026-08-10T10:00+02:00', source: 'history', value: 8 },
      { timestamp: '2026-08-10T12:00+02:00', source: 'history', value: null },
    ]);
  });

  it('normalizes mold potential from Open-Meteo weather variables without provider-specific UI data', () => {
    const expected = calculateMoldPotential({
      temperature: 22,
      relativeHumidity: 86,
      dewPoint: 20,
      precipitation: 3,
      windSpeed: 1,
      leafWetnessProbability: 90,
    });
    const result = normalizeDataDetailSource(
      {
        latitude: 50,
        longitude: 14,
        hourly: {
          time: ['2026-08-10T12:00'],
          temperature_2m: [22],
          relative_humidity_2m: [86],
          dew_point_2m: [20],
          precipitation: [3],
          wind_speed_10m: [1],
        },
        daily: {
          time: ['2026-08-10'],
          leaf_wetness_probability_mean: [90],
        },
      },
      variable('moldPotential'),
      'forecast',
    );

    expect(result.points[0]?.value).toBe(expected.score);
    expect(result.points[0]?.source).toBe('forecast');
  });

  it('rejects invalid coordinates and missing hourly data', () => {
    expect(() =>
      buildDataDetailUrl({
        coordinates: { latitude: 200, longitude: 14 },
        variable: variable('uvIndex'),
        source: 'forecast',
      }),
    ).toThrow('Invalid Open-Meteo detail coordinates');

    expect(() =>
      normalizeDataDetailSource({ latitude: 50, longitude: 14 }, variable('uvIndex'), 'history'),
    ).toThrow('no hourly timestamps');
  });
});

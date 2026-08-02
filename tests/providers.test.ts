import { buildAirQualityUrl, normalizeAirQuality } from '../src/api/openMeteoAirQuality';
import { buildWeatherUrl, normalizeWeather } from '../src/api/openMeteoWeather';

describe('Open-Meteo providers', () => {
  it('requests current and hourly air quality with timezone auto', () => {
    const url = buildAirQualityUrl({ latitude: 40.7, longitude: -74 });

    expect(url).toContain('current=');
    expect(url).toContain('hourly=');
    expect(url).toContain('timezone=auto');
    expect(url).toContain('us_aqi_pm2_5');
    expect(url).toContain('ragweed_pollen');
  });

  it('normalizes US AQI only for United States timezones', () => {
    const response = normalizeAirQuality({
      latitude: 40.7,
      longitude: -74,
      timezone: 'America/New_York',
      current: {
        time: '2026-08-01T12:00',
        grass_pollen: 10,
        pm2_5: 8,
        us_aqi_pm2_5: 32,
        european_aqi_pm2_5: 18,
      },
      hourly: { time: ['2026-08-01T12:00'], grass_pollen: [10], us_aqi_pm2_5: [32] },
    });

    expect(response.current.aqiLabel).toBe('US AQI');
    expect(response.current.pollutantAqi.pm25).toBe(32);
  });

  it('does not use US AQI for non-US America timezones', () => {
    const response = normalizeAirQuality({
      latitude: 45.5,
      longitude: -73.5,
      timezone: 'America/Toronto',
      current: {
        time: '2026-08-01T12:00',
        pm2_5: 8,
        us_aqi_pm2_5: 50,
        european_aqi_pm2_5: 20,
      },
    });

    expect(response.current.aqiLabel).toBe('EU AQI');
    expect(response.current.pollutantAqi.pm25).toBe(20);
  });

  it('requests and normalizes UV without invalidating weather when UV is missing or invalid', () => {
    const url = buildWeatherUrl({ latitude: 50, longitude: 14 });
    expect(url).toContain('uv_index');
    expect(url).toContain('timezone=auto');

    const response = normalizeWeather({
      latitude: 50,
      longitude: 14,
      timezone: 'Europe/Prague',
      current: {
        time: '2026-08-01T12:00',
        temperature_2m: 20,
        relative_humidity_2m: 70,
        uv_index: -1,
      },
      hourly: {
        time: ['2026-08-01T12:00', 'bad'],
        temperature_2m: [20, 21],
        relative_humidity_2m: [70, 72],
        uv_index: [7.2, -3],
      },
      daily: { time: ['2026-08-01'], leaf_wetness_probability_mean: [40] },
    });

    expect(response.current.uvIndex).toBeNull();
    expect(response.hourly[0]?.uvIndex).toBe(7.2);
    expect(response.hourly[1]?.uvIndex).toBeNull();
  });

  it('rejects weather responses with no usable numeric readings', () => {
    expect(() =>
      normalizeWeather({
        latitude: 50,
        longitude: 14,
        timezone: 'Europe/Prague',
        current: {
          time: '2026-08-01T12:00',
        },
        hourly: {
          time: ['2026-08-01T12:00'],
        },
        daily: {
          time: ['2026-08-01'],
        },
      }),
    ).toThrow('no usable readings');
  });
});

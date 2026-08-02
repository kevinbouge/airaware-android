import { FORECAST_DAY_LIMITS } from '../src/capabilities/config';
import { buildAirQualityUrl, normalizeAirQuality } from '../src/api/openMeteoAirQuality';
import { buildWeatherUrl, normalizeWeather } from '../src/api/openMeteoWeather';

describe('Open-Meteo providers', () => {
  it('requests current and hourly air quality with timezone auto', () => {
    const url = buildAirQualityUrl({ latitude: 40.7, longitude: -74 });

    expect(url).toContain('current=');
    expect(url).toContain('hourly=');
    expect(url).toContain('timezone=auto');
    expect(url).toContain(`forecast_days=${FORECAST_DAY_LIMITS.providerRequest}`);
    expect(url).toContain('us_aqi_pm2_5');
    expect(url).toContain('ragweed_pollen');
    expect(url).toContain('carbon_dioxide');
    expect(url).toContain('ammonia');
    expect(url).toContain('methane');
    expect(url).toContain('nitrogen_monoxide');
    expect(url).toContain('formaldehyde');
    expect(url).toContain('non_methane_volatile_organic_compounds');
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
    expect(url).toContain('pressure_msl');
    expect(url).toContain('wet_bulb_temperature_2m');
    expect(url).toContain('shortwave_radiation');
    expect(url).toContain('cape');
    expect(url).toContain('timezone=auto');
    expect(url).toContain(`forecast_days=${FORECAST_DAY_LIMITS.providerRequest}`);

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

  it('normalizes supported extended air-quality variables without requiring every value', () => {
    const response = normalizeAirQuality({
      latitude: 50,
      longitude: 14,
      timezone: 'Europe/Prague',
      current: {
        time: '2026-08-01T12:00',
        pm2_5: 8,
        european_aqi_pm2_5: 20,
        carbon_dioxide: 418,
        ammonia: 'bad',
        nitrogen_monoxide: 3.2,
        formaldehyde: Number.NaN,
      },
      hourly: {
        time: ['2026-08-01T12:00'],
        pm2_5: [8],
        european_aqi_pm2_5: [20],
        carbon_dioxide: [420],
        ammonia: [1.8],
        methane: [1900],
        nitrogen_monoxide: [3],
        formaldehyde: [0.7],
        non_methane_volatile_organic_compounds: [14],
      },
    });

    expect(response.current.extended).toEqual({
      carbonDioxide: 418,
      ammonia: null,
      methane: null,
      nitrogenMonoxide: 3.2,
      formaldehyde: null,
      nonMethaneVolatileOrganicCompounds: null,
    });
    expect(response.hourly[0]?.extended).toEqual({
      carbonDioxide: 420,
      ammonia: 1.8,
      methane: 1900,
      nitrogenMonoxide: 3,
      formaldehyde: 0.7,
      nonMethaneVolatileOrganicCompounds: 14,
    });
  });

  it('normalizes supported extended weather variables and rejects malformed numbers', () => {
    const response = normalizeWeather({
      latitude: 50,
      longitude: 14,
      timezone: 'Europe/Prague',
      current: {
        time: '2026-08-01T12:00',
        temperature_2m: 20,
        relative_humidity_2m: 70,
        pressure_msl: 1018,
        surface_pressure: 985,
        visibility: 14000,
        cloud_cover: 62,
        cloud_cover_low: 20,
        cloud_cover_mid: 30,
        cloud_cover_high: 12,
        dew_point_2m: 14.2,
        wet_bulb_temperature_2m: 17.3,
        wind_gusts_10m: 28,
        shortwave_radiation: 520,
        direct_normal_irradiance: 430,
        diffuse_radiation: 90,
        sunshine_duration: 3600,
        cape: Number.POSITIVE_INFINITY,
      },
      hourly: {
        time: ['2026-08-01T12:00'],
        temperature_2m: [20],
        relative_humidity_2m: [70],
        pressure_msl: [1019],
        sunshine_duration: [1800],
      },
      daily: { time: ['2026-08-01'], leaf_wetness_probability_mean: [40] },
    });

    expect(response.current.extended).toMatchObject({
      pressureMsl: 1018,
      surfacePressure: 985,
      visibility: 14000,
      cloudCover: 62,
      cloudCoverLow: 20,
      cloudCoverMid: 30,
      cloudCoverHigh: 12,
      dewPoint: 14.2,
      wetBulbTemperature: 17.3,
      windGusts: 28,
      shortwaveRadiation: 520,
      directNormalIrradiance: 430,
      diffuseRadiation: 90,
      sunshineDuration: 3600,
      cape: null,
    });
    expect(response.hourly[0]?.extended.pressureMsl).toBe(1019);
    expect(response.hourly[0]?.extended.sunshineDuration).toBe(1800);
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

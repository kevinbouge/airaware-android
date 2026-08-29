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
    expect(url).toContain('domains=auto');
    expect(url).not.toContain('past_hours=');
    expect(url).toContain('us_aqi_pm2_5');
    expect(url).toContain('ragweed_pollen');
    expect(url).toContain('aerosol_optical_depth');
    expect(url).toContain('dust');
    expect(url).toContain('pm10_wildfires');
    expect(url).toContain('secondary_inorganic_aerosol');
    expect(url).toContain('pm2_5_total_organic_matter');
    expect(url).not.toContain('carbon_dioxide');
    expect(url).not.toContain('ammonia');
  });

  it('requests professional air-quality variables only when enabled activities need them', () => {
    const url = buildAirQualityUrl(
      { latitude: 40.7, longitude: -74 },
      { enabledActivities: ['drone_operations'] },
    );

    expect(url).toContain('pm2_5');
    expect(url).toContain('ozone');
    expect(url).not.toContain('methane');
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
    expect(url).toContain('apparent_temperature');
    expect(url).not.toContain('pressure_msl');
    expect(url).not.toContain('wet_bulb_temperature_2m');
    expect(url).not.toContain('shortwave_radiation');
    expect(url).not.toContain('cape');
    expect(url).toContain('timezone=auto');
    expect(url).toContain('wind_speed_unit=ms');
    expect(url).toContain(`forecast_days=${FORECAST_DAY_LIMITS.providerRequest}`);
    expect(url).not.toContain('past_hours=');

    const response = normalizeWeather({
      latitude: 50,
      longitude: 14,
      timezone: 'Europe/Prague',
      utc_offset_seconds: 7200,
      current: {
        time: '2026-08-01T12:00',
        temperature_2m: 20,
        relative_humidity_2m: 70,
        uv_index: -1,
      },
      hourly: {
        time: ['2026-08-01T12:00', '2026-08-01T13:00'],
        temperature_2m: [20, 21],
        relative_humidity_2m: [70, 72],
        uv_index: [7.2, -3],
      },
      daily: { time: ['2026-08-01'], leaf_wetness_probability_mean: [40] },
    });

    expect(response.current.uvIndex).toBeNull();
    expect(response.hourly[0]?.uvIndex).toBeCloseTo(7.2);
    expect(response.hourly[1]?.uvIndex).toBeNull();
  });

  it('requests professional weather variables only when enabled activities need them', () => {
    const url = buildWeatherUrl(
      { latitude: 50, longitude: 14 },
      { enabledActivities: ['photography', 'agriculture'] },
    );

    expect(url).toContain('cloud_cover');
    expect(url).toContain('shortwave_radiation');
    expect(url).toContain('soil_moisture_0_1cm');
    expect(url).toContain('et0_fao_evapotranspiration');
    expect(url).not.toContain('cape');
  });

  it('keeps valid negative weather temperatures and applies provider UTC offsets', () => {
    const response = normalizeWeather({
      latitude: 64.1,
      longitude: -21.9,
      timezone: 'Atlantic/Reykjavik',
      utc_offset_seconds: -3600,
      current: {
        time: '2026-01-10T07:00',
        temperature_2m: -6,
        dew_point_2m: -8.5,
        wet_bulb_temperature_2m: -7,
        relative_humidity_2m: 82,
      },
      hourly: {
        time: ['2026-01-10T07:00'],
        temperature_2m: [-6],
        dew_point_2m: [-8.5],
        wet_bulb_temperature_2m: [-7],
        relative_humidity_2m: [82],
      },
      daily: {
        time: ['2026-01-10'],
        temperature_2m_mean: [-5],
        relative_humidity_2m_mean: [82],
      },
    });

    expect(response.current.timestamp).toBe('2026-01-10T07:00-01:00');
    expect(response.current.temperature).toBe(-6);
    expect(response.current.dewPoint).toBe(-8.5);
    expect(response.current.extended.wetBulbTemperature).toBe(-7);
    expect(response.hourly[0]?.timestamp).toBe('2026-01-10T07:00-01:00');
    expect(response.hourly[0]?.temperature).toBe(-6);
    expect(response.hourly[0]?.extended.wetBulbTemperature).toBe(-7);
    expect(response.daily[0]?.temperature).toBe(-5);
  });

  it('normalizes supported extended air-quality variables without requiring every value', () => {
    const response = normalizeAirQuality({
      latitude: 50,
      longitude: 14,
      timezone: 'Europe/Prague',
      utc_offset_seconds: 7200,
      current: {
        time: '2026-08-01T12:00',
        pm2_5: 8,
        european_aqi_pm2_5: 20,
        uv_index: 6.1,
        uv_index_clear_sky: 7.2,
        pm10_wildfires: 4,
        secondary_inorganic_aerosol: 2.5,
        residential_elementary_carbon: 0.4,
        total_elementary_carbon: 0.9,
        pm2_5_total_organic_matter: 3.1,
        sea_salt_aerosol: 1.2,
        carbon_dioxide: 418,
        ammonia: 'bad',
        nitrogen_monoxide: 3.2,
        formaldehyde: Number.NaN,
        glyoxal: 0.02,
        peroxyacyl_nitrates: null,
      },
      hourly: {
        time: ['2026-08-01T12:00', '2026-08-01T13:00'],
        pm2_5: [8],
        european_aqi_pm2_5: [20],
        uv_index: [6.2, 'bad'],
        uv_index_clear_sky: [7.3],
        pm10_wildfires: [5],
        secondary_inorganic_aerosol: [2.7],
        residential_elementary_carbon: [0.5],
        total_elementary_carbon: [1],
        pm2_5_total_organic_matter: [3.3],
        sea_salt_aerosol: [1.4],
        carbon_dioxide: [420],
        ammonia: [1.8],
        methane: [1900],
        nitrogen_monoxide: [3],
        formaldehyde: [0.7],
        glyoxal: [0.03],
        non_methane_volatile_organic_compounds: [14],
        peroxyacyl_nitrates: [0.08],
      },
    });

    expect(response.current.uvIndex).toBeCloseTo(6.1);
    expect(response.current.atmosphericIrritants.wildfirePm10).toBe(4);
    expect(response.current.extended).toEqual({
      carbonDioxide: 418,
      ammonia: null,
      methane: null,
      nitrogenMonoxide: 3.2,
      formaldehyde: null,
      glyoxal: 0.02,
      nonMethaneVolatileOrganicCompounds: null,
      peroxyacylNitrates: null,
      secondaryInorganicAerosol: 2.5,
      residentialElementaryCarbon: 0.4,
      totalElementaryCarbon: 0.9,
      pm25TotalOrganicMatter: 3.1,
      seaSaltAerosol: 1.2,
      uvIndexClearSky: 7.2,
    });
    expect(response.hourly[0]?.uvIndex).toBeCloseTo(6.2);
    expect(response.hourly[0]?.atmosphericIrritants.wildfirePm10).toBe(5);
    expect(response.hourly[0]?.extended).toEqual({
      carbonDioxide: 420,
      ammonia: 1.8,
      methane: 1900,
      nitrogenMonoxide: 3,
      formaldehyde: 0.7,
      glyoxal: 0.03,
      nonMethaneVolatileOrganicCompounds: 14,
      peroxyacylNitrates: 0.08,
      secondaryInorganicAerosol: 2.7,
      residentialElementaryCarbon: 0.5,
      totalElementaryCarbon: 1,
      pm25TotalOrganicMatter: 3.3,
      seaSaltAerosol: 1.4,
      uvIndexClearSky: 7.3,
    });
    expect(response.hourly[1]?.uvIndex).toBeNull();
    expect(response.hourly[1]?.extended.pm25TotalOrganicMatter).toBeNull();
  });

  it('applies provider UTC offsets to air-quality timestamps', () => {
    const response = normalizeAirQuality({
      latitude: 40.7,
      longitude: -74,
      timezone: 'America/New_York',
      utc_offset_seconds: -14400,
      current: {
        time: '2026-08-01T12:00',
        pm2_5: 8,
        us_aqi_pm2_5: 32,
      },
      hourly: {
        time: ['2026-08-01T12:00'],
        pm2_5: [8],
        us_aqi_pm2_5: [32],
      },
    });

    expect(response.current.timestamp).toBe('2026-08-01T12:00-04:00');
    expect(response.hourly[0]?.timestamp).toBe('2026-08-01T12:00-04:00');
  });

  it('normalizes supported extended weather variables and rejects malformed numbers', () => {
    const response = normalizeWeather({
      latitude: 50,
      longitude: 14,
      timezone: 'Europe/Prague',
      utc_offset_seconds: 7200,
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
        apparent_temperature: 21.2,
        precipitation_probability: 15,
        wind_gusts_10m: 28,
        shortwave_radiation: 520,
        direct_normal_irradiance: 430,
        diffuse_radiation: 90,
        sunshine_duration: 3600,
        cape: Number.POSITIVE_INFINITY,
        soil_moisture_0_1cm: 0.22,
        soil_temperature_0cm: 16.4,
        et0_fao_evapotranspiration: 0.18,
        vapour_pressure_deficit: 1.1,
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
      apparentTemperature: 21.2,
      precipitationProbability: 15,
      windGusts: 28,
      shortwaveRadiation: 520,
      directNormalIrradiance: 430,
      diffuseRadiation: 90,
      sunshineDuration: 3600,
      cape: null,
      soilMoisture0To1cm: 0.22,
      soilTemperature0cm: 16.4,
      et0FaoEvapotranspiration: 0.18,
      vapourPressureDeficit: 1.1,
    });
    expect(response.hourly[0]?.extended.pressureMsl).toBe(1019);
    expect(response.hourly[0]?.extended.sunshineDuration).toBe(1800);
  });

  it('does not parse offset-less provider-local weather timestamps as device-local time', () => {
    const response = normalizeWeather({
      latitude: 50,
      longitude: 14,
      timezone: 'Europe/Prague',
      current: {
        time: '2026-08-01T12:00',
        temperature_2m: 20,
      },
      hourly: {
        time: ['2026-08-01T12:00'],
        temperature_2m: [21],
      },
    });

    expect(response.current.timestamp).toBeNull();
    expect(response.hourly).toEqual([]);
    expect(response.partial).toBe(true);
  });

  it('does not parse offset-less provider-local air-quality timestamps as device-local time', () => {
    const response = normalizeAirQuality({
      latitude: 50,
      longitude: 14,
      timezone: 'Europe/Prague',
      current: {
        time: '2026-08-01T12:00',
        pm2_5: 8,
      },
      hourly: {
        time: ['2026-08-01T12:00'],
        pm2_5: [9],
      },
    });

    expect(response.current.timestamp).toBeNull();
    expect(response.hourly).toEqual([]);
    expect(response.partial).toBe(true);
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

import AsyncStorage from '@react-native-async-storage/async-storage';
import { FREE_ENTITLEMENT } from '../src/capabilities/entitlements';
import { DEFAULT_PROFILE, DEFAULT_SETTINGS } from '../src/models/profile';

/* eslint-disable import/first */
const mockFetchAirQuality = jest.fn();
const mockFetchWeather = jest.fn();
const mockResolveLocation = jest.fn();
const mockFetchVegetationContext = jest.fn();

jest.mock('../src/services/environmentProviders', () => ({
  activeEnvironmentalProvider: jest.fn(() => ({
    id: 'open-meteo',
    fetchAirQuality: mockFetchAirQuality,
    fetchWeather: mockFetchWeather,
  })),
}));

jest.mock('../src/services/locationService', () => ({
  parseManualCoordinates: jest.fn(() => ({ latitude: 50.0755, longitude: 14.4378 })),
  resolveLocation: (...args: unknown[]) => mockResolveLocation(...args),
}));

jest.mock('../src/api/openStreetMapVegetation', () => ({
  fetchVegetationContext: (...args: unknown[]) => mockFetchVegetationContext(...args),
}));

jest.mock('../src/services/notificationService', () => ({
  deliverRiskTransitionNotification: jest.fn().mockResolvedValue(true),
  deliverRiskTestNotification: jest.fn().mockResolvedValue(true),
  getRiskNotificationPermissionStatus: jest.fn().mockResolvedValue('granted'),
  openSystemNotificationSettings: jest.fn().mockResolvedValue(true),
  requestRiskNotificationPermission: jest.fn().mockResolvedValue('granted'),
}));

import {
  airQualityVariableCoverageFor,
  type NormalizedAirQuality,
} from '../src/api/openMeteoAirQuality';
import { type NormalizedWeather, weatherVariableCoverageFor } from '../src/api/openMeteoWeather';
import { assembleEnvironment } from '../src/services/environmentAssembler';
import { useAppStore } from '../src/state/useAppStore';

const coordinates = { latitude: 50.0755, longitude: 14.4378 };
const timestamp = '2026-08-14T12:00:00Z';

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((nextResolve) => {
    resolve = nextResolve;
  });
  return { promise, resolve };
}

function airQuality(fetchedAt = timestamp): NormalizedAirQuality {
  const reading = {
    timestamp,
    pollen: {
      alder: 1,
      birch: 1,
      grass: 1,
      mugwort: 1,
      olive: 1,
      ragweed: 1,
    },
    regulatedPollutants: {
      pm25: 5,
      pm10: 8,
      nitrogenDioxide: 4,
      ozone: 40,
      sulphurDioxide: 1,
    },
    pollutantAqi: {
      pm25: 10,
      pm10: 12,
      nitrogenDioxide: 8,
      ozone: 20,
      sulphurDioxide: 2,
    },
    aqiLabel: 'EU AQI' as const,
    atmosphericIrritants: {
      carbonMonoxide: 120,
      aerosolOpticalDepth: 0.05,
      dust: 2,
      wildfirePm10: 0,
    },
    extended: {
      carbonDioxide: null,
      ammonia: null,
      methane: null,
      nitrogenMonoxide: null,
      formaldehyde: null,
      nonMethaneVolatileOrganicCompounds: null,
    },
  };

  return {
    coordinates,
    fetchedAt,
    timezone: 'Europe/Prague',
    current: reading,
    hourly: [reading],
    partial: false,
  };
}

function weather(fetchedAt = timestamp): NormalizedWeather {
  const reading = {
    timestamp,
    temperature: 20,
    relativeHumidity: 55,
    dewPoint: 10,
    precipitation: 0,
    windSpeed: 2,
    windDirection: 90,
    windGusts: 4,
    visibility: 20_000,
    leafWetnessProbability: 0,
    uvIndex: 4,
    extended: {
      apparentTemperature: 20,
      precipitationProbability: 0,
      pressureMsl: 1015,
      surfacePressure: 990,
      visibility: 20_000,
      cloudCover: 20,
      cloudCoverLow: 5,
      cloudCoverMid: 10,
      cloudCoverHigh: 20,
      dewPoint: 10,
      wetBulbTemperature: 14,
      windGusts: 4,
      shortwaveRadiation: 300,
      directNormalIrradiance: 200,
      diffuseRadiation: 80,
      sunshineDuration: 3600,
      cape: 0,
      soilMoisture0To1cm: 0.2,
      soilTemperature0cm: 18,
      et0FaoEvapotranspiration: 0.1,
      vapourPressureDeficit: 0.8,
    },
  };

  return {
    coordinates,
    fetchedAt,
    timezone: 'Europe/Prague',
    current: reading,
    hourly: [reading],
    daily: [],
    partial: false,
  };
}

async function flushMicrotasks() {
  await Promise.resolve();
  await Promise.resolve();
}

describe('app store refresh orchestration', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    jest.clearAllMocks();
    mockResolveLocation.mockResolvedValue({
      coordinates,
      placeName: 'Prague',
      mode: 'manual',
      permissionStatus: 'granted',
    });
    mockFetchVegetationContext.mockResolvedValue({
      provider: 'openstreetmap',
      coordinates,
      radiusMeters: 2000,
      fetchedAt: timestamp,
      categories: {
        woodland: { present: false, featureCount: 0, nearestMeters: null },
        grassland: { present: false, featureCount: 0, nearestMeters: null },
        meadow: { present: false, featureCount: 0, nearestMeters: null },
        orchard: { present: false, featureCount: 0, nearestMeters: null },
        scrub: { present: false, featureCount: 0, nearestMeters: null },
        parkland: { present: false, featureCount: 0, nearestMeters: null },
        farmland: { present: false, featureCount: 0, nearestMeters: null },
      },
      mappedTaxa: {
        birch: { featureCount: 0, nearestMeters: null },
        alder: { featureCount: 0, nearestMeters: null },
        olive: { featureCount: 0, nearestMeters: null },
      },
      attribution: 'OpenStreetMap contributors',
      completeness: 'unknown',
    });
    useAppStore.setState({
      hydrated: true,
      loading: false,
      sharing: false,
      stale: false,
      error: null,
      shareMessage: null,
      notificationMessage: null,
      billingMessage: null,
      notificationPermissionStatus: 'unknown',
      location: {
        coordinates: null,
        placeName: null,
        mode: 'automatic',
        permissionStatus: 'unknown',
      },
      settings: {
        ...DEFAULT_SETTINGS,
        locationMode: 'manual',
        manualLatitude: '50.0755',
        manualLongitude: '14.4378',
        locationOnboardingComplete: true,
      },
      profile: DEFAULT_PROFILE,
      entitlement: FREE_ENTITLEMENT,
      environment: null,
      vegetation: null,
      vegetationStale: false,
      vegetationLoading: false,
      vegetationError: null,
      riskNotificationTransitionState: null,
    });
  });

  it('preserves forced refresh when queued behind an in-flight refresh', async () => {
    const firstAirQuality = deferred<NormalizedAirQuality>();
    const firstWeather = deferred<NormalizedWeather>();
    mockFetchAirQuality
      .mockReturnValueOnce(firstAirQuality.promise)
      .mockResolvedValue(airQuality());
    mockFetchWeather.mockReturnValueOnce(firstWeather.promise).mockResolvedValue(weather());

    const firstRefresh = useAppStore.getState().refresh();
    await flushMicrotasks();

    await useAppStore.getState().refresh({ force: true });

    firstAirQuality.resolve(airQuality());
    firstWeather.resolve(weather());
    await firstRefresh;
    await flushMicrotasks();

    expect(mockFetchAirQuality).toHaveBeenCalledTimes(2);
    expect(mockFetchWeather).toHaveBeenCalledTimes(2);
  });

  it('reuses fresh complete automatic-location cache without resolving location or fetching providers', async () => {
    const fetchedAt = new Date().toISOString();
    const cachedEnvironment = {
      ...assembleEnvironment({
        coordinates,
        placeName: 'Prague',
        airQuality: airQuality(fetchedAt),
        weather: weather(fetchedAt),
        requestedActivityDomains: [],
        requestedAirQualityVariables: airQualityVariableCoverageFor([]),
        requestedWeatherVariables: weatherVariableCoverageFor([]),
      }),
      forecastDays: [
        { date: '2026-08-14', label: 'Today', score: null },
        { date: '2026-08-15', label: 'Tomorrow', score: null },
        { date: '2026-08-16', label: 'Sunday', score: null },
      ],
    };
    useAppStore.setState({
      settings: {
        ...DEFAULT_SETTINGS,
        locationMode: 'automatic',
        locationOnboardingComplete: true,
      },
      location: {
        coordinates,
        placeName: 'Prague',
        mode: 'automatic',
        permissionStatus: 'granted',
      },
      environment: cachedEnvironment,
    });

    await useAppStore.getState().refresh();

    expect(mockResolveLocation).not.toHaveBeenCalled();
    expect(mockFetchAirQuality).not.toHaveBeenCalled();
    expect(mockFetchWeather).not.toHaveBeenCalled();
    expect(useAppStore.getState().loading).toBe(false);
  });
});

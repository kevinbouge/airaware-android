import AsyncStorage from '@react-native-async-storage/async-storage';
import { FREE_ENTITLEMENT } from '../src/capabilities/entitlements';
import { CURRENT_LOCATION_ID, currentLocationEntry } from '../src/models/location';
import { DEFAULT_PROFILE, DEFAULT_SETTINGS, type AppSettings } from '../src/models/profile';

/* eslint-disable import/first */
const mockFetchAirQuality = jest.fn();
const mockFetchWeather = jest.fn();
const mockResolveLocation = jest.fn();
const mockFetchVegetationContext = jest.fn();
const mockReverseGeocodePlaceName = jest.fn();
const mockDeliverRiskTransitionNotification = jest.fn();
const mockGetRiskNotificationPermissionStatus = jest.fn();

jest.mock('../src/services/environmentProviders', () => ({
  activeEnvironmentalProvider: jest.fn(() => ({
    id: 'open-meteo',
    fetchAirQuality: mockFetchAirQuality,
    fetchWeather: mockFetchWeather,
  })),
}));

jest.mock('../src/services/locationService', () => ({
  resolveActiveLocation: (...args: unknown[]) => mockResolveLocation(...args),
  reverseGeocodePlaceName: (...args: unknown[]) => mockReverseGeocodePlaceName(...args),
}));

jest.mock('../src/api/openStreetMapVegetation', () => ({
  fetchVegetationContext: (...args: unknown[]) => mockFetchVegetationContext(...args),
}));

jest.mock('../src/services/notificationService', () => ({
  deliverRiskTransitionNotification: (...args: unknown[]) =>
    mockDeliverRiskTransitionNotification(...args),
  deliverRiskTestNotification: jest.fn().mockResolvedValue(true),
  getRiskNotificationPermissionStatus: (...args: unknown[]) =>
    mockGetRiskNotificationPermissionStatus(...args),
  openSystemNotificationSettings: jest.fn().mockResolvedValue(true),
  requestRiskNotificationPermission: jest.fn().mockResolvedValue('granted'),
}));

import {
  airQualityVariableCoverageFor,
  type NormalizedAirQuality,
} from '../src/api/openMeteoAirQuality';
import { type NormalizedWeather, weatherVariableCoverageFor } from '../src/api/openMeteoWeather';
import { riskNotificationLocationKey } from '../src/core/riskTransitionNotifications';
import { assembleEnvironment } from '../src/services/environmentAssembler';
import { useAppStore } from '../src/state/useAppStore';
import { loadWidgetSnapshot } from '../src/storage/storage';
import type { NormalizedVegetationContext } from '../src/models/vegetation';

const coordinates = { latitude: 50.0755, longitude: 14.4378 };
const brnoCoordinates = { latitude: 49.1951, longitude: 16.6068 };
const timestamp = '2026-08-14T12:00:00Z';

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((nextResolve) => {
    resolve = nextResolve;
  });
  return { promise, resolve };
}

function airQuality(fetchedAt = timestamp, itemCoordinates = coordinates): NormalizedAirQuality {
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
    coordinates: itemCoordinates,
    fetchedAt,
    timezone: 'Europe/Prague',
    current: reading,
    hourly: [reading],
    partial: false,
  };
}

function weather(fetchedAt = timestamp, itemCoordinates = coordinates): NormalizedWeather {
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
    coordinates: itemCoordinates,
    fetchedAt,
    timezone: 'Europe/Prague',
    current: reading,
    hourly: [reading],
    daily: [],
    partial: false,
  };
}

function vegetationContext(
  itemCoordinates = coordinates,
  featureCount = 0,
): NormalizedVegetationContext {
  return {
    provider: 'openstreetmap',
    coordinates: itemCoordinates,
    radiusMeters: 2000,
    fetchedAt: timestamp,
    categories: {
      woodland: {
        present: featureCount > 0,
        featureCount,
        nearestMeters: featureCount ? 120 : null,
      },
      grassland: { present: false, featureCount: 0, nearestMeters: null },
      meadow: { present: false, featureCount: 0, nearestMeters: null },
      orchard: { present: false, featureCount: 0, nearestMeters: null },
      scrub: { present: false, featureCount: 0, nearestMeters: null },
      parkland: { present: false, featureCount: 0, nearestMeters: null },
      farmland: { present: false, featureCount: 0, nearestMeters: null },
    },
    mappedTaxa: {
      birch: { featureCount, nearestMeters: featureCount ? 400 : null },
      alder: { featureCount: 0, nearestMeters: null },
      olive: { featureCount: 0, nearestMeters: null },
    },
    attribution: 'OpenStreetMap contributors',
    completeness: 'unknown',
  };
}

function highAirQuality(itemCoordinates = coordinates): NormalizedAirQuality {
  const next = airQuality(timestamp, itemCoordinates);
  return {
    ...next,
    current: {
      ...next.current,
      pollen: {
        alder: 500,
        birch: 500,
        grass: 250,
        mugwort: 250,
        olive: 500,
        ragweed: 250,
      },
    },
    hourly: next.hourly.map((hour) => ({
      ...hour,
      pollen: {
        alder: 500,
        birch: 500,
        grass: 250,
        mugwort: 250,
        olive: 500,
        ragweed: 250,
      },
    })),
  };
}

function resolveLocationFromSettings(settings: AppSettings) {
  const active = settings.locations.find((location) => location.id === settings.activeLocationId);

  if (active?.type === 'manual') {
    return {
      activeLocationId: active.id,
      activeLocationName: active.name,
      coordinates: { latitude: active.latitude, longitude: active.longitude },
      placeName: active.placeName ?? active.name,
      mode: 'manual' as const,
      permissionStatus: 'unknown' as const,
    };
  }

  return {
    activeLocationId: CURRENT_LOCATION_ID,
    activeLocationName: 'Current location',
    coordinates,
    placeName: 'Prague',
    mode: 'automatic' as const,
    permissionStatus: 'granted' as const,
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
    mockReverseGeocodePlaceName.mockResolvedValue('Prague');
    mockFetchAirQuality.mockResolvedValue(airQuality());
    mockFetchWeather.mockResolvedValue(weather());
    mockDeliverRiskTransitionNotification.mockResolvedValue(true);
    mockGetRiskNotificationPermissionStatus.mockResolvedValue('granted');
    mockResolveLocation.mockResolvedValue({
      activeLocationId: 'manual-prague',
      activeLocationName: 'Prague',
      coordinates,
      placeName: 'Prague',
      mode: 'manual',
      permissionStatus: 'granted',
    });
    mockFetchVegetationContext.mockResolvedValue(vegetationContext());
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
        activeLocationId: CURRENT_LOCATION_ID,
        activeLocationName: 'Current location',
        coordinates: null,
        placeName: null,
        mode: 'automatic',
        permissionStatus: 'unknown',
      },
      settings: {
        ...DEFAULT_SETTINGS,
        locations: [
          currentLocationEntry(),
          {
            id: 'manual-prague',
            type: 'manual',
            name: 'Prague',
            latitude: coordinates.latitude,
            longitude: coordinates.longitude,
            placeName: 'Prague',
            createdAt: 0,
            updatedAt: 0,
          },
        ],
        activeLocationId: 'manual-prague',
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
        locations: [currentLocationEntry({ coordinates, placeName: 'Prague', updatedAt: 0 })],
        activeLocationId: CURRENT_LOCATION_ID,
        locationOnboardingComplete: true,
      },
      location: {
        activeLocationId: CURRENT_LOCATION_ID,
        activeLocationName: 'Current location',
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

  it('marks the widget snapshot stale when refresh falls back to cached provider data', async () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    const cachedEnvironment = assembleEnvironment({
      coordinates,
      placeName: 'Prague',
      airQuality: airQuality(),
      weather: weather(),
      requestedActivityDomains: [],
      requestedAirQualityVariables: airQualityVariableCoverageFor([]),
      requestedWeatherVariables: weatherVariableCoverageFor([]),
    });
    useAppStore.setState({ environment: cachedEnvironment });
    mockFetchAirQuality.mockRejectedValue(new Error('air unavailable'));
    mockFetchWeather.mockRejectedValue(new Error('weather unavailable'));

    try {
      await useAppStore.getState().refresh({ force: true });
    } finally {
      warnSpy.mockRestore();
    }

    expect(useAppStore.getState().stale).toBe(true);
    await expect(loadWidgetSnapshot()).resolves.toMatchObject({
      data: {
        stale: true,
        placeName: 'Prague',
      },
    });
  });

  it('updates location state when automatic location becomes unavailable', async () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    useAppStore.setState({
      settings: {
        ...DEFAULT_SETTINGS,
        locations: [currentLocationEntry({ coordinates, placeName: 'Prague', updatedAt: 0 })],
        activeLocationId: CURRENT_LOCATION_ID,
        locationOnboardingComplete: true,
      },
      location: {
        activeLocationId: CURRENT_LOCATION_ID,
        activeLocationName: 'Current location',
        coordinates,
        placeName: 'Prague',
        mode: 'automatic',
        permissionStatus: 'granted',
      },
    });
    mockResolveLocation.mockResolvedValue({
      activeLocationId: CURRENT_LOCATION_ID,
      activeLocationName: 'Current location',
      coordinates: null,
      placeName: null,
      mode: 'automatic',
      permissionStatus: 'unavailable',
    });

    try {
      await useAppStore.getState().refresh({ force: true });
    } finally {
      warnSpy.mockRestore();
    }

    expect(useAppStore.getState().location).toEqual({
      activeLocationId: CURRENT_LOCATION_ID,
      activeLocationName: 'Current location',
      coordinates: null,
      placeName: null,
      mode: 'automatic',
      permissionStatus: 'unavailable',
    });
    expect(useAppStore.getState().environment).toBeNull();
    expect(useAppStore.getState().error).toBe('No environmental data is available.');
  });

  it('switches between saved manual locations without retaining previous environment data', async () => {
    mockResolveLocation.mockImplementation((settings) =>
      settings.activeLocationId === 'manual-brno'
        ? {
            activeLocationId: 'manual-brno',
            activeLocationName: 'Brno',
            coordinates: brnoCoordinates,
            placeName: 'Brno',
            mode: 'manual',
            permissionStatus: 'unknown',
          }
        : {
            activeLocationId: 'manual-prague',
            activeLocationName: 'Prague',
            coordinates,
            placeName: 'Prague',
            mode: 'manual',
            permissionStatus: 'unknown',
          },
    );
    mockFetchAirQuality.mockResolvedValue(airQuality(timestamp, brnoCoordinates));
    mockFetchWeather.mockResolvedValue(weather(timestamp, brnoCoordinates));
    useAppStore.setState({
      settings: {
        ...useAppStore.getState().settings,
        locations: [
          currentLocationEntry(),
          {
            id: 'manual-prague',
            type: 'manual',
            name: 'Prague',
            latitude: coordinates.latitude,
            longitude: coordinates.longitude,
            placeName: 'Prague',
            createdAt: 0,
            updatedAt: 0,
          },
          {
            id: 'manual-brno',
            type: 'manual',
            name: 'Brno',
            latitude: brnoCoordinates.latitude,
            longitude: brnoCoordinates.longitude,
            placeName: 'Brno',
            createdAt: 0,
            updatedAt: 0,
          },
        ],
        activeLocationId: 'manual-prague',
      },
      environment: assembleEnvironment({
        coordinates,
        placeName: 'Prague',
        airQuality: airQuality(),
        weather: weather(),
      }),
    });

    await useAppStore.getState().setActiveLocation('manual-brno');

    expect(useAppStore.getState().settings.activeLocationId).toBe('manual-brno');
    expect(useAppStore.getState().location.coordinates).toEqual(brnoCoordinates);
    expect(useAppStore.getState().environment?.coordinates).toEqual(brnoCoordinates);
  });

  it('deletes inactive locations without changing the active location', async () => {
    useAppStore.setState({
      settings: {
        ...useAppStore.getState().settings,
        locations: [
          currentLocationEntry(),
          {
            id: 'manual-prague',
            type: 'manual',
            name: 'Prague',
            latitude: coordinates.latitude,
            longitude: coordinates.longitude,
            placeName: 'Prague',
            createdAt: 0,
            updatedAt: 0,
          },
          {
            id: 'manual-brno',
            type: 'manual',
            name: 'Brno',
            latitude: brnoCoordinates.latitude,
            longitude: brnoCoordinates.longitude,
            placeName: 'Brno',
            createdAt: 0,
            updatedAt: 0,
          },
        ],
        activeLocationId: 'manual-prague',
      },
    });

    await useAppStore.getState().deleteSavedLocation('manual-brno');

    expect(useAppStore.getState().settings.activeLocationId).toBe('manual-prague');
    expect(useAppStore.getState().settings.locations.map((item) => item.id)).toEqual([
      CURRENT_LOCATION_ID,
      'manual-prague',
    ]);
  });

  it('deletes the active manual location by switching back to Current location', async () => {
    await useAppStore.getState().deleteSavedLocation('manual-prague');

    expect(useAppStore.getState().settings.activeLocationId).toBe(CURRENT_LOCATION_ID);
    expect(useAppStore.getState().settings.locations.map((item) => item.id)).toEqual([
      CURRENT_LOCATION_ID,
    ]);
    expect(useAppStore.getState().environment?.coordinates).toEqual(coordinates);
  });

  it('regenerates widget snapshots with the active saved location name', async () => {
    await useAppStore.getState().renameSavedLocation('manual-prague', 'Home');

    await expect(loadWidgetSnapshot()).resolves.toMatchObject({
      data: {
        activeLocationName: 'Home',
      },
    });
  });

  it('serializes saved-location additions before reverse geocoding', async () => {
    const firstGeocode = deferred<string | null>();
    mockResolveLocation.mockImplementation(resolveLocationFromSettings);
    mockReverseGeocodePlaceName
      .mockReturnValueOnce(firstGeocode.promise)
      .mockResolvedValueOnce('Brno');

    const firstAdd = useAppStore.getState().addSavedLocation(coordinates);
    await flushMicrotasks();
    const secondAdd = useAppStore.getState().addSavedLocation(brnoCoordinates);
    await flushMicrotasks();

    expect(mockReverseGeocodePlaceName).toHaveBeenCalledTimes(1);
    firstGeocode.resolve('Prague');
    await Promise.all([firstAdd, secondAdd]);

    const manualNames = useAppStore
      .getState()
      .settings.locations.filter((location) => location.type === 'manual')
      .map((location) => location.name);

    expect(mockReverseGeocodePlaceName).toHaveBeenCalledTimes(2);
    expect(manualNames.slice(-2)).toEqual(['Prague', 'Brno']);
    expect(useAppStore.getState().location.activeLocationName).toBe('Brno');
  });

  it('keeps the last coordinate edit when reverse geocoding finishes out of order', async () => {
    const firstGeocode = deferred<string | null>();
    mockResolveLocation.mockImplementation(resolveLocationFromSettings);
    mockReverseGeocodePlaceName
      .mockReturnValueOnce(firstGeocode.promise)
      .mockResolvedValueOnce('Brno');

    const firstEdit = useAppStore
      .getState()
      .updateSavedLocationCoordinates('manual-prague', { latitude: 48.8566, longitude: 2.3522 });
    await flushMicrotasks();
    const secondEdit = useAppStore
      .getState()
      .updateSavedLocationCoordinates('manual-prague', brnoCoordinates);
    await flushMicrotasks();

    expect(mockReverseGeocodePlaceName).toHaveBeenCalledTimes(1);
    firstGeocode.resolve('Paris');
    await Promise.all([firstEdit, secondEdit]);

    const prague = useAppStore
      .getState()
      .settings.locations.find((location) => location.id === 'manual-prague');

    expect(mockReverseGeocodePlaceName).toHaveBeenCalledTimes(2);
    expect(prague).toMatchObject({
      latitude: brnoCoordinates.latitude,
      longitude: brnoCoordinates.longitude,
      placeName: 'Brno',
    });
  });

  it('does not add saved locations past the capability limit', async () => {
    const manualLocations = Array.from({ length: 8 }, (_, index) => ({
      id: `manual-${index}`,
      type: 'manual' as const,
      name: `Location ${index}`,
      latitude: 40 + index,
      longitude: 10 + index,
      placeName: null,
      createdAt: index,
      updatedAt: index,
    }));
    useAppStore.setState({
      settings: {
        ...useAppStore.getState().settings,
        locations: [currentLocationEntry(), ...manualLocations],
        activeLocationId: 'manual-0',
      },
    });

    await useAppStore.getState().addSavedLocation(brnoCoordinates, 'Overflow');

    expect(mockReverseGeocodePlaceName).not.toHaveBeenCalled();
    expect(useAppStore.getState().settings.locations).toHaveLength(9);
    expect(useAppStore.getState().error).toBe('Saved location limit reached.');
  });

  it('does not send saved location names to environmental providers', async () => {
    mockFetchAirQuality.mockResolvedValue(airQuality());
    mockFetchWeather.mockResolvedValue(weather());

    await useAppStore.getState().refresh({ force: true });

    expect(mockFetchAirQuality).toHaveBeenCalledWith(coordinates, {
      enabledActivities: [],
    });
    expect(mockFetchWeather).toHaveBeenCalledWith(coordinates, {
      enabledActivities: [],
    });
    expect(JSON.stringify(mockFetchAirQuality.mock.calls)).not.toContain('Prague');
  });

  it('does not let old vegetation refresh overwrite a newer active location', async () => {
    const staleVegetation = deferred<NormalizedVegetationContext>();
    mockFetchVegetationContext.mockReturnValueOnce(staleVegetation.promise);
    useAppStore.setState({
      settings: {
        ...useAppStore.getState().settings,
        locations: [
          currentLocationEntry(),
          {
            id: 'manual-prague',
            type: 'manual',
            name: 'Prague',
            latitude: coordinates.latitude,
            longitude: coordinates.longitude,
            placeName: 'Prague',
            createdAt: 0,
            updatedAt: 0,
          },
          {
            id: 'manual-brno',
            type: 'manual',
            name: 'Brno',
            latitude: brnoCoordinates.latitude,
            longitude: brnoCoordinates.longitude,
            placeName: 'Brno',
            createdAt: 0,
            updatedAt: 0,
          },
        ],
        activeLocationId: 'manual-prague',
      },
      location: {
        activeLocationId: 'manual-prague',
        activeLocationName: 'Prague',
        coordinates,
        placeName: 'Prague',
        mode: 'manual',
        permissionStatus: 'unknown',
      },
      environment: assembleEnvironment({
        coordinates,
        placeName: 'Prague',
        airQuality: airQuality(),
        weather: weather(),
      }),
      vegetation: null,
    });

    const refresh = useAppStore.getState().refreshVegetation(true);
    await flushMicrotasks();
    useAppStore.setState({
      settings: {
        ...useAppStore.getState().settings,
        activeLocationId: 'manual-brno',
      },
      location: {
        activeLocationId: 'manual-brno',
        activeLocationName: 'Brno',
        coordinates: brnoCoordinates,
        placeName: 'Brno',
        mode: 'manual',
        permissionStatus: 'unknown',
      },
      environment: assembleEnvironment({
        coordinates: brnoCoordinates,
        placeName: 'Brno',
        airQuality: airQuality(timestamp, brnoCoordinates),
        weather: weather(timestamp, brnoCoordinates),
      }),
      vegetation: null,
    });
    staleVegetation.resolve(vegetationContext(coordinates, 3));
    await refresh;

    expect(useAppStore.getState().settings.activeLocationId).toBe('manual-brno');
    expect(useAppStore.getState().vegetation).toBeNull();
    expect(useAppStore.getState().vegetationLoading).toBe(false);
  });

  it('does not deliver a transition notification after the active location changes', async () => {
    const permission = deferred<'granted'>();
    mockGetRiskNotificationPermissionStatus.mockReturnValueOnce(permission.promise);
    mockFetchAirQuality.mockResolvedValue(highAirQuality());
    mockFetchWeather.mockResolvedValue(weather());
    useAppStore.setState({
      settings: {
        ...useAppStore.getState().settings,
        riskTransitionNotificationsEnabled: true,
      },
      riskNotificationTransitionState: {
        version: 1,
        previousCategory: 'moderate',
        previousScoreType: 'environmental',
        locationKey: riskNotificationLocationKey(coordinates, 'manual-prague'),
        profileFingerprint: null,
        lastObservationKey: 'previous-observation',
        lastDeliveredObservationKey: null,
        evaluatedAt: '2026-08-14T11:00:00Z',
      },
    });

    const refresh = useAppStore.getState().refresh({ force: true });
    await flushMicrotasks();
    useAppStore.setState({
      settings: {
        ...useAppStore.getState().settings,
        activeLocationId: 'manual-brno',
      },
    });
    permission.resolve('granted');
    await refresh;

    expect(mockDeliverRiskTransitionNotification).not.toHaveBeenCalled();
  });

  it('does not let an old location refresh overwrite a newer active location', async () => {
    const firstAirQuality = deferred<NormalizedAirQuality>();
    const firstWeather = deferred<NormalizedWeather>();
    mockFetchAirQuality
      .mockReturnValueOnce(firstAirQuality.promise)
      .mockResolvedValue(airQuality(timestamp, brnoCoordinates));
    mockFetchWeather
      .mockReturnValueOnce(firstWeather.promise)
      .mockResolvedValue(weather(timestamp, brnoCoordinates));
    mockResolveLocation.mockImplementation((settings) =>
      settings.activeLocationId === 'manual-brno'
        ? {
            activeLocationId: 'manual-brno',
            activeLocationName: 'Brno',
            coordinates: brnoCoordinates,
            placeName: 'Brno',
            mode: 'manual',
            permissionStatus: 'unknown',
          }
        : {
            activeLocationId: 'manual-prague',
            activeLocationName: 'Prague',
            coordinates,
            placeName: 'Prague',
            mode: 'manual',
            permissionStatus: 'unknown',
          },
    );
    useAppStore.setState({
      settings: {
        ...useAppStore.getState().settings,
        locations: [
          currentLocationEntry(),
          {
            id: 'manual-prague',
            type: 'manual',
            name: 'Prague',
            latitude: coordinates.latitude,
            longitude: coordinates.longitude,
            placeName: 'Prague',
            createdAt: 0,
            updatedAt: 0,
          },
          {
            id: 'manual-brno',
            type: 'manual',
            name: 'Brno',
            latitude: brnoCoordinates.latitude,
            longitude: brnoCoordinates.longitude,
            placeName: 'Brno',
            createdAt: 0,
            updatedAt: 0,
          },
        ],
        activeLocationId: 'manual-prague',
      },
    });

    const firstRefresh = useAppStore.getState().refresh({ force: true });
    await flushMicrotasks();
    await useAppStore.getState().setActiveLocation('manual-brno');
    firstAirQuality.resolve(airQuality(timestamp, coordinates));
    firstWeather.resolve(weather(timestamp, coordinates));
    await firstRefresh;
    for (let attempt = 0; attempt < 10 && !useAppStore.getState().environment; attempt += 1) {
      await flushMicrotasks();
    }

    expect(useAppStore.getState().settings.activeLocationId).toBe('manual-brno');
    expect(useAppStore.getState().environment?.coordinates).toEqual(brnoCoordinates);
    expect(useAppStore.getState().environment?.placeName).toBe('Brno');
  });
});

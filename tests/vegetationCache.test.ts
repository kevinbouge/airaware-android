import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  NEARBY_VEGETATION_RADIUS_METERS,
  VEGETATION_CACHE_SCHEMA_VERSION,
} from '../src/core/constants';
import type {
  CachedVegetationContext,
  NormalizedVegetationContext,
} from '../src/models/vegetation';
import { loadVegetationCache, saveVegetationCache } from '../src/storage/storage';
import {
  vegetationCacheEnvelope,
  vegetationCacheExpired,
  vegetationCacheForRequest,
  vegetationCacheKey,
} from '../src/services/vegetationCache';

const coordinates = { latitude: 50.0755, longitude: 14.4378 };

function vegetation(): NormalizedVegetationContext {
  return {
    provider: 'openstreetmap',
    coordinates,
    radiusMeters: NEARBY_VEGETATION_RADIUS_METERS,
    fetchedAt: '2026-08-01T12:00:00Z',
    categories: {
      woodland: { present: false, featureCount: 0, nearestMeters: null },
      grassland: { present: true, featureCount: 2, nearestMeters: 120 },
      meadow: { present: false, featureCount: 0, nearestMeters: null },
      orchard: { present: false, featureCount: 0, nearestMeters: null },
      scrub: { present: false, featureCount: 0, nearestMeters: null },
      parkland: { present: false, featureCount: 0, nearestMeters: null },
      farmland: { present: false, featureCount: 0, nearestMeters: null },
    },
    mappedTaxa: {
      birch: { featureCount: 1, nearestMeters: 400 },
      alder: { featureCount: 0, nearestMeters: null },
      olive: { featureCount: 0, nearestMeters: null },
    },
    attribution: 'OpenStreetMap contributors',
    completeness: 'unknown',
  };
}

describe('vegetation cache', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  it('generates cache keys from precise coordinates, standard radius, and schema version', () => {
    expect(vegetationCacheKey(coordinates)).toBe(
      `${VEGETATION_CACHE_SCHEMA_VERSION}:50.07550:14.43780:2000`,
    );
  });

  it('loads a valid vegetation cache envelope', async () => {
    const envelope = vegetationCacheEnvelope(vegetation());

    await saveVegetationCache(envelope);

    await expect(loadVegetationCache()).resolves.toEqual([envelope]);
  });

  it('matches by precise location and standard radius', () => {
    const envelope = vegetationCacheEnvelope(vegetation());

    expect(vegetationCacheForRequest([envelope], coordinates)).toBe(envelope);
    expect(
      vegetationCacheForRequest([envelope], { latitude: 50.07555, longitude: 14.43785 }),
    ).toBeNull();
    expect(vegetationCacheForRequest([envelope], { latitude: 50.2, longitude: 14.44 })).toBeNull();
  });

  it('rejects old variable-radius cache entries', () => {
    const oldRadiusEnvelope = {
      ...vegetationCacheEnvelope(vegetation()),
      metadata: {
        ...vegetationCacheEnvelope(vegetation()).metadata,
        cacheKey: `${VEGETATION_CACHE_SCHEMA_VERSION}:50.07550:14.43780:5000`,
      },
      data: {
        ...vegetation(),
        radiusMeters: 5000,
      },
    } as unknown as CachedVegetationContext;

    expect(vegetationCacheForRequest([oldRadiusEnvelope], coordinates)).toBeNull();
  });

  it('detects expired vegetation cache entries', () => {
    const envelope = {
      ...vegetationCacheEnvelope(vegetation()),
      metadata: {
        ...vegetationCacheEnvelope(vegetation()).metadata,
        savedAt: '2026-08-01T00:00:00Z',
      },
    };

    expect(vegetationCacheExpired(envelope, new Date('2026-08-10T00:00:00Z'))).toBe(false);
    expect(vegetationCacheExpired(envelope, new Date('2026-08-20T00:00:00Z'))).toBe(true);
  });

  it('rejects schema mismatches and malformed data', async () => {
    await AsyncStorage.setItem(
      'airaware.vegetation-cache.v1',
      JSON.stringify({
        metadata: { version: 999, savedAt: '2026-08-01T00:00:00Z', cacheKey: 'x' },
        data: vegetation(),
      }),
    );

    await expect(loadVegetationCache()).resolves.toEqual([]);
  });

  it('rejects persisted vegetation data fetched with an obsolete radius', async () => {
    await AsyncStorage.setItem(
      'airaware.vegetation-cache.v1',
      JSON.stringify({
        version: VEGETATION_CACHE_SCHEMA_VERSION,
        entries: [
          {
            metadata: {
              version: VEGETATION_CACHE_SCHEMA_VERSION,
              savedAt: '2026-08-01T00:00:00Z',
              cacheKey: `${VEGETATION_CACHE_SCHEMA_VERSION}:50.07550:14.43780:5000`,
            },
            data: {
              ...vegetation(),
              radiusMeters: 5000,
            },
          },
        ],
      }),
    );

    await expect(loadVegetationCache()).resolves.toEqual([]);
  });

  it('rejects persisted vegetation entries whose cache key does not match their data', async () => {
    await AsyncStorage.setItem(
      'airaware.vegetation-cache.v1',
      JSON.stringify({
        version: VEGETATION_CACHE_SCHEMA_VERSION,
        entries: [
          {
            metadata: {
              version: VEGETATION_CACHE_SCHEMA_VERSION,
              savedAt: '2026-08-01T00:00:00Z',
              cacheKey: `${VEGETATION_CACHE_SCHEMA_VERSION}:48.86:2.35:2000`,
            },
            data: vegetation(),
          },
        ],
      }),
    );

    await expect(loadVegetationCache()).resolves.toEqual([]);
  });

  it('keeps separate vegetation cache entries by location', async () => {
    const prague = vegetationCacheEnvelope(vegetation());
    const parisVegetation: NormalizedVegetationContext = {
      ...vegetation(),
      coordinates: { latitude: 48.8566, longitude: 2.3522 },
    };
    const paris = vegetationCacheEnvelope(parisVegetation);

    await saveVegetationCache(prague);
    await saveVegetationCache(paris);

    const caches = await loadVegetationCache();

    expect(vegetationCacheForRequest(caches, coordinates)).toEqual(prague);
    expect(vegetationCacheForRequest(caches, parisVegetation.coordinates)).toEqual(paris);
  });
});

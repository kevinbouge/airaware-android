import AsyncStorage from '@react-native-async-storage/async-storage';
import { VEGETATION_CACHE_SCHEMA_VERSION } from '../src/core/constants';
import type { NormalizedVegetationContext } from '../src/models/vegetation';
import { loadVegetationCache, saveVegetationCache } from '../src/storage/storage';
import {
  vegetationCacheEnvelope,
  vegetationCacheExpired,
  vegetationCacheForRequest,
  vegetationCacheKey,
} from '../src/services/vegetationCache';

const coordinates = { latitude: 50.0755, longitude: 14.4378 };

function vegetation(radiusMeters: 1000 | 2000 | 5000 = 2000): NormalizedVegetationContext {
  return {
    provider: 'openstreetmap',
    coordinates,
    radiusMeters,
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

  it('generates cache keys from rounded coordinates, radius, and schema version', () => {
    expect(vegetationCacheKey(coordinates, 2000)).toBe(
      `${VEGETATION_CACHE_SCHEMA_VERSION}:50.08:14.44:2000`,
    );
  });

  it('loads a valid vegetation cache envelope', async () => {
    const envelope = vegetationCacheEnvelope(vegetation());

    await saveVegetationCache(envelope);

    await expect(loadVegetationCache()).resolves.toEqual(envelope);
  });

  it('matches by coarse location and radius', () => {
    const envelope = vegetationCacheEnvelope(vegetation());

    expect(vegetationCacheForRequest(envelope, coordinates, 2000)).toBe(envelope);
    expect(vegetationCacheForRequest(envelope, coordinates, 5000)).toBeNull();
    expect(
      vegetationCacheForRequest(envelope, { latitude: 50.2, longitude: 14.44 }, 2000),
    ).toBeNull();
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

    await expect(loadVegetationCache()).resolves.toBeNull();
  });
});

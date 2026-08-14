import {
  buildVegetationQuery,
  buildVegetationUrl,
  normalizeVegetationResponse,
} from '../src/api/openStreetMapVegetation';
import { NEARBY_VEGETATION_RADIUS_METERS } from '../src/core/constants';

const coordinates = { latitude: 50.0755, longitude: 14.4378 };

describe('OpenStreetMap vegetation provider', () => {
  it('builds an encoded Overpass URL with the standard radius and no full geometry request', () => {
    const url = buildVegetationUrl(coordinates, 'https://example.test/interpreter');
    const parsed = new URL(url);
    const query = parsed.searchParams.get('data') ?? '';

    expect(parsed.origin + parsed.pathname).toBe('https://example.test/interpreter');
    expect(query).toContain('[out:json][timeout:20]');
    expect(query).toContain('nwr(around:2000,50.0755,14.4378)');
    expect(query).toContain('out center tags;');
    expect(query).not.toContain('out geom');
  });

  it('uses the standard vegetation radius', () => {
    expect(NEARBY_VEGETATION_RADIUS_METERS).toBe(2000);
    expect(buildVegetationQuery(coordinates)).toContain('around:2000');
  });

  it('rejects invalid coordinates', () => {
    expect(() => buildVegetationQuery({ latitude: 91, longitude: 14 })).toThrow(
      'Invalid vegetation coordinates',
    );
    expect(() => buildVegetationQuery({ latitude: 50, longitude: 181 })).toThrow(
      'Invalid vegetation coordinates',
    );
  });

  it('normalizes broad vegetation categories, coordinates, centers, taxa, and duplicates', () => {
    const result = normalizeVegetationResponse(
      {
        elements: [
          {
            type: 'node',
            id: 1,
            lat: 50.076,
            lon: 14.438,
            tags: { natural: 'grassland' },
          },
          {
            type: 'way',
            id: 2,
            center: { lat: 50.077, lon: 14.439 },
            tags: { landuse: 'meadow' },
          },
          {
            type: 'way',
            id: 3,
            center: { lat: 50.08, lon: 14.44 },
            tags: { landuse: 'orchard', genus: 'Betula' },
          },
          {
            type: 'relation',
            id: 4,
            center: { lat: 50.081, lon: 14.441 },
            tags: { natural: 'scrub', species: 'Alnus glutinosa' },
          },
          {
            type: 'way',
            id: 5,
            center: { lat: 50.082, lon: 14.442 },
            tags: { leisure: 'park', taxon: 'olea europaea' },
          },
          {
            type: 'way',
            id: 6,
            center: { lat: 50.083, lon: 14.443 },
            tags: { landuse: 'farmland' },
          },
          {
            type: 'way',
            id: 7,
            center: { lat: 50.084, lon: 14.444 },
            tags: { natural: 'wood' },
          },
          {
            type: 'way',
            id: 7,
            center: { lat: 50.084, lon: 14.444 },
            tags: { natural: 'wood' },
          },
          {
            type: 'node',
            id: 8,
            tags: { natural: 'grassland' },
          },
          {
            type: 'node',
            id: 9,
            lat: 50.085,
            lon: 14.445,
            tags: { genus: 'Quercus' },
          },
        ],
      },
      coordinates,
      '2026-08-01T12:00:00Z',
    );

    expect(result.categories.grassland.present).toBe(true);
    expect(result.categories.meadow.present).toBe(true);
    expect(result.categories.orchard.present).toBe(true);
    expect(result.categories.scrub.present).toBe(true);
    expect(result.categories.parkland.present).toBe(true);
    expect(result.categories.farmland.present).toBe(true);
    expect(result.categories.woodland.featureCount).toBe(1);
    expect(result.categories.grassland.featureCount).toBe(1);
    expect(result.categories.grassland.nearestMeters).toBeGreaterThan(0);
    expect(result.mappedTaxa.birch.featureCount).toBe(1);
    expect(result.mappedTaxa.alder.featureCount).toBe(1);
    expect(result.mappedTaxa.olive.featureCount).toBe(1);
  });

  it('keeps valid empty responses distinct from invalid response structures', () => {
    const empty = normalizeVegetationResponse({ elements: [] }, coordinates);

    expect(empty.categories.woodland.present).toBe(false);
    expect(empty.mappedTaxa.birch.featureCount).toBe(0);
    expect(() => normalizeVegetationResponse({}, coordinates)).toThrow('Invalid Overpass response');
  });

  it('does not mutate input payloads', () => {
    const payload = {
      elements: [
        {
          type: 'node',
          id: 1,
          lat: 50.076,
          lon: 14.438,
          tags: { genus: 'Betula' },
        },
      ],
    };
    const before = JSON.stringify(payload);

    normalizeVegetationResponse(payload, coordinates);

    expect(JSON.stringify(payload)).toBe(before);
  });
});

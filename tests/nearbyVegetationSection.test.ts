import { nearbyVegetationRows } from '../src/components/NearbyVegetationSection';
import type { NormalizedVegetationContext } from '../src/models/vegetation';

const vegetation: NormalizedVegetationContext = {
  provider: 'openstreetmap',
  coordinates: { latitude: 50.0755, longitude: 14.4378 },
  radiusMeters: 2000,
  fetchedAt: '2026-08-01T12:00:00Z',
  categories: {
    woodland: { present: true, featureCount: 1, nearestMeters: 1100 },
    grassland: { present: true, featureCount: 2, nearestMeters: 180 },
    meadow: { present: false, featureCount: 0, nearestMeters: null },
    orchard: { present: false, featureCount: 0, nearestMeters: null },
    scrub: { present: false, featureCount: 0, nearestMeters: null },
    parkland: { present: true, featureCount: 1, nearestMeters: 420 },
    farmland: { present: false, featureCount: 0, nearestMeters: null },
  },
  mappedTaxa: {
    birch: { featureCount: 6, nearestMeters: 250 },
    alder: { featureCount: 0, nearestMeters: null },
    olive: { featureCount: 2, nearestMeters: 850 },
  },
  attribution: 'OpenStreetMap contributors',
  completeness: 'unknown',
};

describe('nearby vegetation display rows', () => {
  it('renders available vegetation categories and mapped taxa without absent rows', () => {
    const rows = nearbyVegetationRows(vegetation);
    const labels = rows.map((row) => row.label);

    expect(labels).toEqual(['Woodland', 'Grassland', 'Parkland', 'Mapped birch', 'Mapped olive']);
    expect(rows.find((row) => row.label === 'Grassland')?.value).toBe('180 m');
    expect(rows.find((row) => row.label === 'Woodland')?.value).toBe('1.1 km');
    expect(rows.find((row) => row.label === 'Mapped birch')?.value).toBe('6 · nearest 250 m');
    expect(labels).not.toContain('Mapped alder');
  });

  it('returns no rows for null or empty vegetation context', () => {
    expect(nearbyVegetationRows(null)).toEqual([]);
    expect(
      nearbyVegetationRows({
        ...vegetation,
        categories: Object.fromEntries(
          Object.keys(vegetation.categories).map((key) => [
            key,
            { present: false, featureCount: 0, nearestMeters: null },
          ]),
        ) as NormalizedVegetationContext['categories'],
        mappedTaxa: {
          birch: { featureCount: 0, nearestMeters: null },
          alder: { featureCount: 0, nearestMeters: null },
          olive: { featureCount: 0, nearestMeters: null },
        },
      }),
    ).toEqual([]);
  });
});

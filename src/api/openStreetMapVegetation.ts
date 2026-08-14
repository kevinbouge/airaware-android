import { z } from 'zod';
import type { Coordinates } from '../models/environment';
import type {
  NormalizedVegetationContext,
  VegetationCategoryId,
  VegetationFeatureSummary,
  VegetationTaxonId,
  VegetationTaxonSummary,
} from '../models/vegetation';
import { NEARBY_VEGETATION_RADIUS_METERS } from '../core/constants';
import { distanceMeters } from '../utils/geo';
import { coordinateNumber, isFiniteNumber } from '../utils/number';
import { fetchJson } from './http';

const DEFAULT_OVERPASS_ENDPOINT = 'https://overpass-api.de/api/interpreter';

const overpassElementSchema = z
  .object({
    type: z.unknown().optional(),
    id: z.unknown().optional(),
    lat: z.unknown().optional(),
    lon: z.unknown().optional(),
    center: z
      .object({
        lat: z.unknown().optional(),
        lon: z.unknown().optional(),
      })
      .optional(),
    tags: z.unknown().optional(),
  })
  .passthrough();
const overpassPayloadSchema = z.object({
  elements: z.array(overpassElementSchema),
});

type OverpassElement = z.infer<typeof overpassElementSchema>;
type OverpassPayload = z.infer<typeof overpassPayloadSchema>;

const CATEGORY_IDS: VegetationCategoryId[] = [
  'woodland',
  'grassland',
  'meadow',
  'orchard',
  'scrub',
  'parkland',
  'farmland',
];

const TAXON_IDS: VegetationTaxonId[] = ['birch', 'alder', 'olive'];

function emptyCategories(): Record<VegetationCategoryId, VegetationFeatureSummary> {
  return Object.fromEntries(
    CATEGORY_IDS.map((id) => [id, { present: false, featureCount: 0, nearestMeters: null }]),
  ) as Record<VegetationCategoryId, VegetationFeatureSummary>;
}

function emptyTaxa(): Record<VegetationTaxonId, VegetationTaxonSummary> {
  return Object.fromEntries(
    TAXON_IDS.map((id) => [id, { featureCount: 0, nearestMeters: null }]),
  ) as Record<VegetationTaxonId, VegetationTaxonSummary>;
}

function validateCoordinates(coordinates: Coordinates): Coordinates {
  const latitude = coordinateNumber(coordinates.latitude);
  const longitude = coordinateNumber(coordinates.longitude);

  if (latitude === null || longitude === null) {
    throw new Error('Invalid vegetation coordinates');
  }

  if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
    throw new Error('Invalid vegetation coordinates');
  }

  return { latitude, longitude };
}

function elementCoordinates(element: OverpassElement): Coordinates | null {
  const directLatitude = coordinateNumber(element.lat);
  const directLongitude = coordinateNumber(element.lon);

  if (directLatitude !== null && directLongitude !== null) {
    return { latitude: directLatitude, longitude: directLongitude };
  }

  const centerLatitude = coordinateNumber(element.center?.lat);
  const centerLongitude = coordinateNumber(element.center?.lon);

  return centerLatitude !== null && centerLongitude !== null
    ? { latitude: centerLatitude, longitude: centerLongitude }
    : null;
}

function tagsFor(element: OverpassElement): Record<string, string> {
  if (element.tags === null || typeof element.tags !== 'object' || Array.isArray(element.tags)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(element.tags).filter(
      (entry): entry is [string, string] => typeof entry[1] === 'string',
    ),
  );
}

function categoriesFor(tags: Record<string, string>): VegetationCategoryId[] {
  const categories: VegetationCategoryId[] = [];

  if (tags.natural === 'wood' || tags.landuse === 'forest') categories.push('woodland');
  if (tags.natural === 'grassland' || tags.landuse === 'grass') categories.push('grassland');
  if (tags.landuse === 'meadow') categories.push('meadow');
  if (tags.landuse === 'orchard') categories.push('orchard');
  if (tags.natural === 'scrub') categories.push('scrub');
  if (tags.leisure === 'park') categories.push('parkland');
  if (tags.landuse === 'farmland') categories.push('farmland');

  return categories;
}

function taxonomyText(tags: Record<string, string>): string {
  return [tags.genus, tags.species, tags.taxon].filter(Boolean).join(' ').toLowerCase();
}

function taxaFor(tags: Record<string, string>): VegetationTaxonId[] {
  const text = taxonomyText(tags);
  const taxa: VegetationTaxonId[] = [];

  if (/\bbetula\b/.test(text)) taxa.push('birch');
  if (/\balnus\b/.test(text)) taxa.push('alder');
  if (/\bolea\b/.test(text)) taxa.push('olive');

  return taxa;
}

function addCategory(
  categories: Record<VegetationCategoryId, VegetationFeatureSummary>,
  category: VegetationCategoryId,
  distance: number,
) {
  const current = categories[category];
  const roundedDistance = Math.round(distance);
  categories[category] = {
    present: true,
    featureCount: current.featureCount + 1,
    nearestMeters:
      current.nearestMeters === null
        ? roundedDistance
        : Math.min(current.nearestMeters, roundedDistance),
  };
}

function addTaxon(
  taxa: Record<VegetationTaxonId, VegetationTaxonSummary>,
  taxon: VegetationTaxonId,
  distance: number,
) {
  const current = taxa[taxon];
  const roundedDistance = Math.round(distance);
  taxa[taxon] = {
    featureCount: current.featureCount + 1,
    nearestMeters:
      current.nearestMeters === null
        ? roundedDistance
        : Math.min(current.nearestMeters, roundedDistance),
  };
}

export function buildVegetationQuery(coordinates: Coordinates): string {
  const { latitude, longitude } = validateCoordinates(coordinates);
  const around = `around:${NEARBY_VEGETATION_RADIUS_METERS},${latitude},${longitude}`;

  return `[out:json][timeout:20];
(
  nwr(${around})["natural"~"^(wood|tree|scrub|grassland)$"];
  nwr(${around})["landuse"~"^(forest|meadow|grass|orchard|farmland)$"];
  nwr(${around})["leisure"="park"];
);
out center tags;`;
}

export function buildVegetationUrl(
  coordinates: Coordinates,
  endpoint = DEFAULT_OVERPASS_ENDPOINT,
): string {
  const params = new URLSearchParams({
    data: buildVegetationQuery(coordinates),
  });

  return `${endpoint}?${params.toString()}`;
}

export function normalizeVegetationResponse(
  payload: unknown,
  coordinates: Coordinates,
  fetchedAt = new Date().toISOString(),
): NormalizedVegetationContext {
  const effectiveCoordinates = validateCoordinates(coordinates);
  const parsed = overpassPayloadSchema.safeParse(payload);
  if (!parsed.success) {
    throw new Error('Invalid Overpass response');
  }

  const categories = emptyCategories();
  const mappedTaxa = emptyTaxa();
  const seen = new Set<string>();

  for (const element of parsed.data.elements) {
    const type = typeof element.type === 'string' ? element.type : null;
    const id = isFiniteNumber(element.id) ? String(Math.trunc(element.id)) : null;
    if (!type || !id) continue;

    const key = `${type}:${id}`;
    if (seen.has(key)) continue;
    seen.add(key);

    const featureCoordinates = elementCoordinates(element);
    if (!featureCoordinates) continue;

    const tags = tagsFor(element);
    const distance = distanceMeters(effectiveCoordinates, featureCoordinates);

    for (const category of categoriesFor(tags)) {
      addCategory(categories, category, distance);
    }

    for (const taxon of taxaFor(tags)) {
      addTaxon(mappedTaxa, taxon, distance);
    }
  }

  return {
    provider: 'openstreetmap',
    coordinates: effectiveCoordinates,
    radiusMeters: NEARBY_VEGETATION_RADIUS_METERS,
    fetchedAt,
    categories,
    mappedTaxa,
    attribution: 'OpenStreetMap contributors',
    completeness: 'unknown',
  };
}

export async function fetchVegetationContext(
  coordinates: Coordinates,
  endpoint = DEFAULT_OVERPASS_ENDPOINT,
): Promise<NormalizedVegetationContext> {
  const payload = await fetchJson<OverpassPayload>(buildVegetationUrl(coordinates, endpoint));
  return normalizeVegetationResponse(payload, coordinates);
}

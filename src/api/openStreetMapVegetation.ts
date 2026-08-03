import type { Coordinates } from '../models/environment';
import type {
  NormalizedVegetationContext,
  VegetationCategoryId,
  VegetationFeatureSummary,
  VegetationTaxonId,
  VegetationTaxonSummary,
} from '../models/vegetation';
import { distanceMeters } from '../utils/geo';
import { coordinateNumber, isFiniteNumber } from '../utils/number';
import { fetchJson } from './http';

const DEFAULT_OVERPASS_ENDPOINT = 'https://overpass-api.de/api/interpreter';
const VEGETATION_RADII = [1000, 2000, 5000] as const;
type VegetationRadiusMeters = (typeof VEGETATION_RADII)[number];

type OverpassElement = {
  type?: unknown;
  id?: unknown;
  lat?: unknown;
  lon?: unknown;
  center?: {
    lat?: unknown;
    lon?: unknown;
  };
  tags?: unknown;
};

type OverpassPayload = {
  elements?: unknown;
};

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

function validateRadius(radiusMeters: number): VegetationRadiusMeters {
  if (VEGETATION_RADII.includes(radiusMeters as VegetationRadiusMeters)) {
    return radiusMeters as VegetationRadiusMeters;
  }

  throw new Error('Invalid vegetation radius');
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

export function buildVegetationQuery(coordinates: Coordinates, radiusMeters: number): string {
  const { latitude, longitude } = validateCoordinates(coordinates);
  const radius = validateRadius(radiusMeters);
  const around = `around:${radius},${latitude},${longitude}`;

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
  radiusMeters: number,
  endpoint = DEFAULT_OVERPASS_ENDPOINT,
): string {
  const params = new URLSearchParams({
    data: buildVegetationQuery(coordinates, radiusMeters),
  });

  return `${endpoint}?${params.toString()}`;
}

export function normalizeVegetationResponse(
  payload: OverpassPayload,
  coordinates: Coordinates,
  radiusMeters: number,
  fetchedAt = new Date().toISOString(),
): NormalizedVegetationContext {
  const effectiveCoordinates = validateCoordinates(coordinates);
  const radius = validateRadius(radiusMeters);

  if (!Array.isArray(payload.elements)) {
    throw new Error('Invalid Overpass response');
  }

  const categories = emptyCategories();
  const mappedTaxa = emptyTaxa();
  const seen = new Set<string>();

  for (const rawElement of payload.elements) {
    if (rawElement === null || typeof rawElement !== 'object' || Array.isArray(rawElement)) {
      continue;
    }

    const element = rawElement as OverpassElement;
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
    radiusMeters: radius,
    fetchedAt,
    categories,
    mappedTaxa,
    attribution: 'OpenStreetMap contributors',
    completeness: 'unknown',
  };
}

export async function fetchVegetationContext(
  coordinates: Coordinates,
  radiusMeters: number,
  endpoint = DEFAULT_OVERPASS_ENDPOINT,
): Promise<NormalizedVegetationContext> {
  const payload = await fetchJson<OverpassPayload>(
    buildVegetationUrl(coordinates, radiusMeters, endpoint),
  );
  return normalizeVegetationResponse(payload, coordinates, radiusMeters);
}

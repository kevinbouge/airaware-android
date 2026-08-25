import type { Coordinates, LocationInfo } from '../models/environment';
import type { HealthGeography } from '../models/healthSignals';
import { eurostatCodeFromIso2, iso2FromCountryCode, iso3FromIso2 } from './isoCountries';

interface CountryDefinition {
  iso2: string;
  iso3: string;
  name: string;
  bounds: {
    minLat: number;
    maxLat: number;
    minLon: number;
    maxLon: number;
  };
}

const LEGACY_COORDINATE_COUNTRIES: CountryDefinition[] = [
  {
    iso2: 'AU',
    iso3: 'AUS',
    name: 'Australia',
    bounds: { minLat: -44.0, maxLat: -10.0, minLon: 112.0, maxLon: 154.0 },
  },
  {
    iso2: 'BR',
    iso3: 'BRA',
    name: 'Brazil',
    bounds: { minLat: -34.0, maxLat: 6.0, minLon: -74.0, maxLon: -34.0 },
  },
  {
    iso2: 'CZ',
    iso3: 'CZE',
    name: 'Czechia',
    bounds: { minLat: 48.5, maxLat: 51.1, minLon: 12.0, maxLon: 18.9 },
  },
  {
    iso2: 'DE',
    iso3: 'DEU',
    name: 'Germany',
    bounds: { minLat: 47.2, maxLat: 55.2, minLon: 5.5, maxLon: 15.6 },
  },
  {
    iso2: 'JP',
    iso3: 'JPN',
    name: 'Japan',
    bounds: { minLat: 24.0, maxLat: 46.0, minLon: 122.0, maxLon: 146.0 },
  },
  {
    iso2: 'KE',
    iso3: 'KEN',
    name: 'Kenya',
    bounds: { minLat: -5.0, maxLat: 5.5, minLon: 33.5, maxLon: 42.5 },
  },
  {
    iso2: 'AT',
    iso3: 'AUT',
    name: 'Austria',
    bounds: { minLat: 46.3, maxLat: 49.1, minLon: 9.4, maxLon: 17.2 },
  },
  {
    iso2: 'SK',
    iso3: 'SVK',
    name: 'Slovakia',
    bounds: { minLat: 47.7, maxLat: 49.7, minLon: 16.8, maxLon: 22.7 },
  },
  {
    iso2: 'PL',
    iso3: 'POL',
    name: 'Poland',
    bounds: { minLat: 49.0, maxLat: 54.9, minLon: 14.0, maxLon: 24.2 },
  },
  {
    iso2: 'US',
    iso3: 'USA',
    name: 'United States',
    bounds: { minLat: 24.0, maxLat: 49.5, minLon: -125.0, maxLon: -66.0 },
  },
];

function countryNameForCode(iso2: string, fallback: string | null | undefined): string {
  if (fallback?.trim()) return fallback.trim();

  try {
    return new Intl.DisplayNames(['en'], { type: 'region' }).of(iso2) ?? iso2;
  } catch {
    return iso2;
  }
}

function countryFromCode(
  code: string | null | undefined,
  fallbackName?: string | null | undefined,
): CountryDefinition | null {
  const iso2 = iso2FromCountryCode(code);
  if (!iso2) return null;
  const iso3 = iso3FromIso2(iso2);
  if (!iso3) return null;

  return {
    iso2,
    iso3,
    name: countryNameForCode(iso2, fallbackName),
    bounds: { minLat: -90, maxLat: 90, minLon: -180, maxLon: 180 },
  };
}

function countryFromCoordinates(
  coordinates: Coordinates | null | undefined,
): CountryDefinition | null {
  if (!coordinates) return null;

  return (
    LEGACY_COORDINATE_COUNTRIES.find(
      (country) =>
        coordinates.latitude >= country.bounds.minLat &&
        coordinates.latitude <= country.bounds.maxLat &&
        coordinates.longitude >= country.bounds.minLon &&
        coordinates.longitude <= country.bounds.maxLon,
    ) ?? null
  );
}

export function healthCacheKey(geography: HealthGeography): string {
  return `${geography.level}:${geography.countryCode ?? geography.code ?? geography.name}`;
}

export function resolveHealthGeography(input: {
  location: LocationInfo;
  coordinates?: Coordinates | null | undefined;
}): HealthGeography | null {
  const country =
    countryFromCode(input.location.countryCode, input.location.countryName) ??
    countryFromCoordinates(input.coordinates ?? input.location.coordinates);
  if (!country) return null;
  const eurostatCode = eurostatCodeFromIso2(country.iso2);

  return {
    level: 'country',
    code: country.iso2,
    name: country.name,
    countryCode: country.iso2,
    countryName: country.name,
    providerCodes: {
      eurostat: eurostatCode ?? undefined,
      who: country.iso3,
      whoEurope: country.iso3,
    },
  };
}

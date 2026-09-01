import type { HealthGeography, ProviderRegion } from '../models/healthSignals';

const ECDC_VECTOR_COUNTRY_CODES = new Set([
  'AT',
  'BE',
  'BG',
  'CY',
  'CZ',
  'DE',
  'DK',
  'EE',
  'EL',
  'ES',
  'FI',
  'FR',
  'HR',
  'HU',
  'IE',
  'IS',
  'IT',
  'LI',
  'LT',
  'LU',
  'LV',
  'MT',
  'NL',
  'NO',
  'PL',
  'PT',
  'RO',
  'SE',
  'SI',
  'SK',
]);

const AMERICAS_COUNTRY_CODES = new Set([
  'AG',
  'AR',
  'AW',
  'BB',
  'BM',
  'BO',
  'BQ',
  'BR',
  'BS',
  'BZ',
  'CA',
  'CL',
  'CO',
  'CR',
  'CU',
  'CW',
  'DM',
  'DO',
  'EC',
  'GD',
  'GF',
  'GL',
  'GP',
  'GT',
  'GY',
  'HN',
  'HT',
  'JM',
  'KN',
  'KY',
  'LC',
  'MF',
  'MQ',
  'MS',
  'MX',
  'NI',
  'PA',
  'PE',
  'PM',
  'PR',
  'PY',
  'SR',
  'SV',
  'SX',
  'TC',
  'TT',
  'US',
  'UY',
  'VC',
  'VE',
  'VG',
  'VI',
]);

function ecdcCountryCode(countryCode: string | undefined): string | undefined {
  if (countryCode === 'GR') return 'EL';
  return countryCode;
}

export function geographyInProviderRegion(
  geography: HealthGeography | null | undefined,
  region: ProviderRegion,
): boolean {
  if (region === 'global') return true;
  const countryCode = geography?.countryCode;
  if (!countryCode) return false;

  if (region === 'europe') {
    return ECDC_VECTOR_COUNTRY_CODES.has(ecdcCountryCode(countryCode) ?? '');
  }

  if (region === 'americas') {
    return AMERICAS_COUNTRY_CODES.has(countryCode);
  }

  return false;
}

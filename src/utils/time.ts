import { isFiniteNumber } from './number';

function utcOffsetSuffix(value: unknown): string | null {
  if (!isFiniteNumber(value)) return null;

  const totalMinutes = Math.trunc(value / 60);
  if (Math.abs(totalMinutes) > 24 * 60) return null;

  const sign = totalMinutes >= 0 ? '+' : '-';
  const absoluteMinutes = Math.abs(totalMinutes);
  const hours = Math.floor(absoluteMinutes / 60);
  const minutes = absoluteMinutes % 60;

  return `${sign}${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

export function timestampWithUtcOffset(value: unknown, utcOffsetSeconds: unknown): string | null {
  if (typeof value !== 'string' || value.length === 0) return null;
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(value)) return null;
  if (/(Z|[+-]\d{2}:\d{2})$/.test(value)) return value;

  const suffix = utcOffsetSuffix(utcOffsetSeconds);
  return suffix ? `${value}${suffix}` : value;
}

export function providerLocalDate(value: string): string | null {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return match ? `${match[1]}-${match[2]}-${match[3]}` : null;
}

export function providerLocalTime(value: string): string | null {
  const match = value.match(/T(\d{2}):(\d{2})/);
  return match ? `${match[1]}:${match[2]}` : null;
}

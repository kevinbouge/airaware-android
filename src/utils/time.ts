import { isFiniteNumber } from './number';

const MINUTE_MS = 60 * 1000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

export function millisecondsBetween(later: Date | number, earlier: Date | number): number {
  const laterTime = typeof later === 'number' ? later : later.getTime();
  const earlierTime = typeof earlier === 'number' ? earlier : earlier.getTime();
  return laterTime - earlierTime;
}

export function addHours(time: Date | number, hours: number): number {
  const baseTime = typeof time === 'number' ? time : time.getTime();
  return baseTime + hours * HOUR_MS;
}

export function subtractHours(time: Date | number, hours: number): number {
  return addHours(time, -hours);
}

export function subtractDays(time: Date | number, days: number): number {
  const baseTime = typeof time === 'number' ? time : time.getTime();
  return baseTime - days * DAY_MS;
}

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
  return suffix ? `${value}${suffix}` : null;
}

export function providerLocalDate(value: string): string | null {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return match ? `${match[1]}-${match[2]}-${match[3]}` : null;
}

export function providerLocalTime(value: string): string | null {
  const match = value.match(/T(\d{2}):(\d{2})/);
  return match ? `${match[1]}:${match[2]}` : null;
}

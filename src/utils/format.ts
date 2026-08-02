import { categoryEmoji, categoryLabel } from '../core/categories';
import type { Coordinates, RiskCategoryId } from '../models/environment';
import { isFiniteNumber } from './number';

export function formatScore(score: number | null): string {
  return isFiniteNumber(score) ? `${Math.round(score)}%` : 'Unavailable';
}

export function formatCategoryScore(category: RiskCategoryId, score: number | null): string {
  if (!isFiniteNumber(score) || category === 'unavailable') return 'Unavailable';
  return `${categoryLabel(category)} (${formatScore(score)})`;
}

export function formatNumber(value: number | null, unit = '', precision = 0): string {
  if (!isFiniteNumber(value)) return 'Unavailable';
  const formatted = precision > 0 ? value.toFixed(precision) : Math.round(value).toString();
  return unit.length > 0 ? `${formatted} ${unit}` : formatted;
}

export function formatCoordinates(coordinates: Coordinates | null): string | null {
  if (!coordinates) return null;
  return `${coordinates.latitude.toFixed(3)}, ${coordinates.longitude.toFixed(3)}`;
}

export function formatTimestamp(value: string | null): string {
  if (!value) return 'Unavailable';
  const time = Date.parse(value);
  if (!Number.isFinite(time)) return 'Unavailable';
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(time));
}

export function formatDateLabel(value: string | null): string {
  if (!value) return 'Unavailable';
  const time = Date.parse(value);
  if (!Number.isFinite(time)) return 'Unavailable';
  return new Intl.DateTimeFormat(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  }).format(new Date(time));
}

export function formatShortTime(value: string | null): string {
  if (!value) return 'Unavailable';
  const time = Date.parse(value);
  if (!Number.isFinite(time)) return 'Unavailable';
  return new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit' }).format(
    new Date(time),
  );
}

export function headlineWithEmoji(category: RiskCategoryId, score: number | null): string {
  return `${categoryEmoji(category)} ${formatCategoryScore(category, score)}`;
}

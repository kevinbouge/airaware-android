import { categoryEmoji, categoryLabel } from '../core/categories';
import type { Coordinates, RiskCategoryId } from '../models/environment';
import { providerLocalDate, providerLocalTime } from './time';
import { isFiniteNumber } from './number';

export function formatScore(score: number | null): string {
  return isFiniteNumber(score) ? `${Math.round(score)}%` : 'Unavailable';
}

function formatCategoryScore(category: RiskCategoryId, score: number | null): string {
  if (!isFiniteNumber(score) || category === 'unavailable') return 'Unavailable';
  return `${categoryLabel(category)} (${formatScore(score)})`;
}

export function formatNumber(value: number | null, unit = '', precision = 0): string {
  if (!isFiniteNumber(value)) return 'Unavailable';
  const formatted = precision > 0 ? value.toFixed(precision) : Math.round(value).toString();
  return unit.length > 0 ? `${formatted} ${unit}` : formatted;
}

function formatLocalizedNumber(value: number | null, precision = 0): string {
  if (!isFiniteNumber(value)) return 'Unavailable';
  return new Intl.NumberFormat(undefined, {
    maximumFractionDigits: precision,
    minimumFractionDigits: precision > 0 ? 0 : undefined,
  }).format(value);
}

export function formatMeasurement(value: number | null, unit = '', precision = 0): string {
  if (!isFiniteNumber(value)) return 'Unavailable';
  const formatted = formatLocalizedNumber(value, precision);
  if (unit === '%') return `${formatted}%`;
  return unit.length > 0 ? `${formatted} ${unit}` : formatted;
}

export function formatVisibilityMeters(value: number | null): string {
  if (!isFiniteNumber(value)) return 'Unavailable';
  return formatMeasurement(value / 1000, 'km', 1);
}

export function formatDistanceMeters(value: number | null): string {
  if (!isFiniteNumber(value)) return 'Unavailable';
  if (value >= 1000) return formatMeasurement(value / 1000, 'km', 1);
  return formatMeasurement(value, 'm');
}

export function formatDurationSeconds(value: number | null): string {
  if (!isFiniteNumber(value)) return 'Unavailable';
  if (value >= 3600) return formatMeasurement(value / 3600, 'h', 1);
  return formatMeasurement(value, 's');
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
  const providerDate = providerLocalDate(value);
  if (providerDate) {
    const dateParts = providerDate.split('-').map(Number);
    const year = dateParts[0];
    const month = dateParts[1];
    const day = dateParts[2];
    if (
      !Number.isFinite(year) ||
      !Number.isFinite(month) ||
      !Number.isFinite(day) ||
      year === undefined ||
      month === undefined ||
      day === undefined
    ) {
      return 'Unavailable';
    }

    return new Intl.DateTimeFormat(undefined, {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
    }).format(new Date(year, month - 1, day, 12));
  }

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
  const providerTime = providerLocalTime(value);
  if (providerTime) return providerTime;

  const time = Date.parse(value);
  if (!Number.isFinite(time)) return 'Unavailable';
  return new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit' }).format(
    new Date(time),
  );
}

function addDaysToProviderDate(date: string, days: number): string | null {
  const parts = date.split('-').map(Number);
  const year = parts[0];
  const month = parts[1];
  const day = parts[2];

  if (
    !Number.isFinite(year) ||
    !Number.isFinite(month) ||
    !Number.isFinite(day) ||
    year === undefined ||
    month === undefined ||
    day === undefined
  ) {
    return null;
  }

  const next = new Date(Date.UTC(year, month - 1, day + days, 12));
  return next.toISOString().slice(0, 10);
}

export function formatTimeRangeWithTomorrow(
  startTime: string | null,
  endTime: string | null,
  referenceTime: string | null,
): string {
  const startLabel = formatShortTime(startTime);
  const endLabel = formatShortTime(endTime);

  if (startLabel === 'Unavailable' || endLabel === 'Unavailable') return 'Unavailable';

  const startDate = startTime ? providerLocalDate(startTime) : null;
  const referenceDate = referenceTime ? providerLocalDate(referenceTime) : null;
  const tomorrowDate = referenceDate ? addDaysToProviderDate(referenceDate, 1) : null;
  const tomorrowSuffix =
    startDate && tomorrowDate && startDate === tomorrowDate ? ' (tomorrow)' : '';

  return `${startLabel}–${endLabel}${tomorrowSuffix}`;
}

export function headlineWithEmoji(category: RiskCategoryId, score: number | null): string {
  return `${categoryEmoji(category)} ${formatCategoryScore(category, score)}`;
}

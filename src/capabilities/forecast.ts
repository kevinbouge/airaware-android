import type { AppCapabilities } from './types';

export function forecastDayLimit(capabilities: AppCapabilities): number {
  const maxDays = Math.max(0, Math.floor(capabilities.forecast.maxDays));
  const defaultDays = Math.max(0, Math.floor(capabilities.forecast.defaultDays));

  return Math.min(defaultDays, maxDays);
}

export function isForecastHorizonConfigurable(capabilities: AppCapabilities): boolean {
  return capabilities.forecast.configurable;
}

export function forecastDaysForCapabilities<T>(
  days: readonly T[],
  capabilities: AppCapabilities,
): T[] {
  return days.slice(0, forecastDayLimit(capabilities));
}

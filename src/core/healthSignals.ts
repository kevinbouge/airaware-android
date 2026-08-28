import type {
  HealthSignal,
  HealthSignalFreshnessStatus,
  HealthSignalTrend,
  HealthSignalType,
  ReportingPeriod,
} from '../models/healthSignals';
import { appLocale, translate } from '../i18n';
import { formatMeasurement } from '../utils/format';

export function healthSignalTypeLabel(type: HealthSignalType): string {
  switch (type) {
    case 'ambient-dose-rate':
      return translate('health.ambientDoseRate');
    case 'influenza':
      return translate('health.influenza');
    case 'covid-19':
      return translate('health.covid19');
    case 'rsv':
      return translate('health.rsv');
    case 'excess-mortality':
      return translate('health.excessMortality');
  }
}

export function healthSignalCategoryLabel(signal: HealthSignal): string {
  switch (signal.category) {
    case 'normal-background':
      return translate('health.radiological.status.normalBackground');
    case 'elevated':
      return translate('health.radiological.status.elevated');
    case 'strongly-elevated':
      return translate('health.radiological.status.stronglyElevated');
    case 'low':
      return translate('risk.categories.low');
    case 'moderate':
      return translate('risk.categories.moderate');
    case 'high':
      return translate('risk.categories.high');
    case 'very-high':
      return translate('risk.categories.veryHigh');
    case 'unknown':
      return translate('health.radiological.status.unknown');
  }
}

export function healthSignalTrendLabel(trend: HealthSignalTrend): string {
  switch (trend) {
    case 'rising':
      return translate('health.trend.rising');
    case 'falling':
      return translate('health.trend.falling');
    case 'stable':
      return translate('health.trend.stable');
    case 'unknown':
      return translate('health.trend.unknown');
  }
}

export function healthSignalValueLabel(signal: HealthSignal): string {
  if (signal.value === undefined || signal.unit === undefined) {
    if (signal.metadata?.unavailable === true) {
      return signal.type === 'ambient-dose-rate'
        ? translate('health.radiological.noRecentLocalMeasurement')
        : translate('health.noRecentData');
    }

    return translate('common.unavailable');
  }

  const precision = signal.type === 'ambient-dose-rate' ? 2 : 1;
  const signed =
    signal.type === 'excess-mortality' && signal.value > 0
      ? `+${formatMeasurement(signal.value, signal.unit, precision)}`
      : formatMeasurement(signal.value, signal.unit, precision);
  return signed;
}

function reportingPeriodLabel(period: ReportingPeriod): string {
  if (period.type === 'week') {
    return translate('health.reportingWeek', {
      week: period.week,
      year: period.year,
    });
  }

  const date = new Date(Date.UTC(period.year, period.month - 1, 1));
  try {
    return new Intl.DateTimeFormat(appLocale(), {
      month: 'long',
      year: 'numeric',
      timeZone: 'UTC',
    }).format(date);
  } catch {
    return `${period.year}-${period.month.toString().padStart(2, '0')}`;
  }
}

export function healthSignalPeriodLabel(signal: HealthSignal): string {
  if (signal.reportingPeriod) return reportingPeriodLabel(signal.reportingPeriod);
  if (signal.periodStart && signal.periodEnd && signal.periodStart !== signal.periodEnd) {
    return translate('health.periodRange', {
      start: signal.periodStart,
      end: signal.periodEnd,
    });
  }
  return signal.periodEnd ?? signal.observedAt ?? translate('today.latestSurveillance');
}

export function healthSignalFreshnessLabel(status: HealthSignalFreshnessStatus): string {
  switch (status) {
    case 'fresh':
      return translate('health.freshnessStatus.fresh');
    case 'aging':
      return translate('health.freshnessStatus.aging');
    case 'stale':
      return translate('health.freshnessStatus.stale');
  }
}

export function healthSignalSourceLabel(signal: HealthSignal): string {
  return [providerDisplayName(signal.source.provider), signal.source.dataset]
    .filter(Boolean)
    .join(' · ');
}

export function healthSignalGeographyLabel(signal: HealthSignal): string {
  const countryCode = signal.geography.countryCode ?? signal.geography.code;
  if (!countryCode || signal.geography.level !== 'country') return signal.geography.name;

  try {
    const displayNames = new Intl.DisplayNames([appLocale()], { type: 'region' });
    return displayNames.of(countryCode) ?? signal.geography.name;
  } catch {
    return signal.geography.name;
  }
}

function providerDisplayName(provider: string): string {
  if (provider === 'WHO GISRS / FluNet') return `${translate('providers.who')} GISRS / FluNet`;
  if (provider.toLowerCase() === 'who') return translate('providers.who');
  if (provider.toLowerCase() === 'cdc') return translate('providers.cdc');
  if (provider.toLowerCase() === 'ecdc') return translate('providers.ecdc');
  if (provider.toLowerCase() === 'eurostat') return translate('providers.eurostat');
  if (provider.toLowerCase() === 'safecast') return translate('providers.safecast');
  if (provider.toLowerCase() === 'epa radnet') return translate('providers.radnet');
  if (provider.toLowerCase() === 'eurdep') return translate('providers.eurdep');
  return provider;
}

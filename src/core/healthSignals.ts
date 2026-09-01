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
    case 'thermal-stress':
      return translate('health.thermalStress.title');
    case 'measured-mold-spores':
      return translate('health.measuredMoldSpores');
    case 'ambient-dose-rate':
      return translate('health.ambientDoseRate');
    case 'influenza':
      return translate('health.influenza');
    case 'covid-19':
      return translate('health.covid19');
    case 'rsv':
      return translate('health.rsv');
    case 'outbreak-event':
      return translate('health.outbreakEvent');
    case 'wastewater-covid-19':
      return translate('health.wastewater.covid19');
    case 'wastewater-influenza':
      return translate('health.wastewater.influenza');
    case 'wastewater-rsv':
      return translate('health.wastewater.rsv');
    case 'dengue':
      return translate('health.vector.dengue');
    case 'chikungunya':
      return translate('health.vector.chikungunya');
    case 'west-nile':
      return translate('health.vector.westNile');
    case 'malaria':
      return translate('health.vector.malaria');
    case 'tick-borne-disease':
      return translate('health.vector.tickBorneDisease');
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
    case 'extreme-cold-stress':
      return translate('health.thermalStress.status.extremeColdStress');
    case 'very-strong-cold-stress':
      return translate('health.thermalStress.status.veryStrongColdStress');
    case 'strong-cold-stress':
      return translate('health.thermalStress.status.strongColdStress');
    case 'moderate-cold-stress':
      return translate('health.thermalStress.status.moderateColdStress');
    case 'slight-cold-stress':
      return translate('health.thermalStress.status.slightColdStress');
    case 'no-thermal-stress':
      return translate('health.thermalStress.status.noThermalStress');
    case 'moderate-heat-stress':
      return translate('health.thermalStress.status.moderateHeatStress');
    case 'strong-heat-stress':
      return translate('health.thermalStress.status.strongHeatStress');
    case 'very-strong-heat-stress':
      return translate('health.thermalStress.status.veryStrongHeatStress');
    case 'extreme-heat-stress':
      return translate('health.thermalStress.status.extremeHeatStress');
    case 'no-thermal-strain':
      return translate('health.thermalStress.status.noThermalStrain');
    case 'cold-strain':
      return translate('health.thermalStress.status.coldStrain');
    case 'moderate-heat-strain':
      return translate('health.thermalStress.status.moderateHeatStrain');
    case 'high-heat-strain':
      return translate('health.thermalStress.status.highHeatStrain');
    case 'very-high-heat-strain':
      return translate('health.thermalStress.status.veryHighHeatStrain');
    case 'low':
      return translate('risk.categories.low');
    case 'moderate':
      return translate('risk.categories.moderate');
    case 'high':
      return translate('risk.categories.high');
    case 'very-high':
      return translate('risk.categories.veryHigh');
    case 'unknown':
      return signal.domain === 'radiological'
        ? translate('health.radiological.status.unknown')
        : translate('health.categoryUnknown');
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
  if (signal.type === 'outbreak-event') {
    const disease = signal.metadata?.disease;
    return typeof disease === 'string' && disease.length > 0
      ? disease
      : translate('health.outbreakReportedEvent');
  }

  if (signal.value === undefined || signal.unit === undefined) {
    if (signal.metadata?.unavailable === true) {
      return signal.type === 'ambient-dose-rate'
        ? translate('health.radiological.noRecentLocalMeasurement')
        : translate('health.noRecentData');
    }

    return translate('common.unavailable');
  }

  const precision = signal.type === 'ambient-dose-rate' || signal.type === 'thermal-stress' ? 2 : 1;
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
  if (period.type === 'year') {
    return translate('health.reportingYear', { year: period.year });
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

function healthSignalAgeLabel(ageMs: number | undefined): string | null {
  if (ageMs === undefined || !Number.isFinite(ageMs) || ageMs < 0) return null;

  const minuteMs = 60 * 1000;
  const hourMs = 60 * minuteMs;
  const dayMs = 24 * hourMs;
  const monthMs = 30 * dayMs;
  const yearMs = 365 * dayMs;
  const absoluteAge = Math.max(0, ageMs);
  let unit: Intl.RelativeTimeFormatUnit = 'minute';
  let divisor = minuteMs;

  if (absoluteAge >= yearMs) {
    unit = 'year';
    divisor = yearMs;
  } else if (absoluteAge >= monthMs) {
    unit = 'month';
    divisor = monthMs;
  } else if (absoluteAge >= dayMs) {
    unit = 'day';
    divisor = dayMs;
  } else if (absoluteAge >= hourMs) {
    unit = 'hour';
    divisor = hourMs;
  }
  const value = Math.max(1, Math.round(absoluteAge / divisor));

  try {
    return new Intl.RelativeTimeFormat(appLocale(), { numeric: 'always' }).format(-value, unit);
  } catch {
    return translate('health.updatedAgo', { count: value, unit });
  }
}

export function healthSignalFreshnessDetailLabel(signal: Pick<HealthSignal, 'freshness'>): string {
  const freshness = healthSignalFreshnessLabel(signal.freshness.status);
  const age = healthSignalAgeLabel(signal.freshness.ageMs);
  return age ? translate('health.freshnessWithAge', { freshness, age }) : freshness;
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
  if (provider === 'WHO Disease Outbreak News') {
    return `${translate('providers.who')} Disease Outbreak News`;
  }
  if (provider === 'WHO Global Health Observatory') {
    return `${translate('providers.who')} Global Health Observatory`;
  }
  if (provider.toLowerCase() === 'who') return translate('providers.who');
  if (provider.toLowerCase() === 'cdc') return translate('providers.cdc');
  if (provider.toLowerCase() === 'cdc nwss') return `${translate('providers.cdc')} NWSS`;
  if (provider.toLowerCase() === 'ecdc') return translate('providers.ecdc');
  if (provider.toLowerCase() === 'eurostat') return translate('providers.eurostat');
  if (provider.toLowerCase() === 'our world in data') return translate('providers.owid');
  if (provider.toLowerCase() === 'open-meteo') return translate('providers.openMeteo');
  if (provider.toLowerCase() === 'phac') return translate('providers.phac');
  if (provider.toLowerCase() === 'santé publique france') {
    return translate('providers.santePubliqueFrance');
  }
  if (provider.toLowerCase() === 'safecast') return translate('providers.safecast');
  if (provider.toLowerCase() === 'epa radnet') return translate('providers.radnet');
  if (provider.toLowerCase() === 'eurdep') return translate('providers.eurdep');
  return provider;
}

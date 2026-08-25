import { eurostatExcessMortalityProvider } from '../api/health/eurostatExcessMortality';
import { RESPIRATORY_SIGNAL_TYPES, whoRespiratoryProvider } from '../api/health/whoRespiratory';
import { translate } from '../i18n';
import type { LocationInfo, NormalizedEnvironment } from '../models/environment';
import type {
  CachedHealthSignals,
  HealthGeography,
  HealthSignal,
  HealthSignalProvider,
  HealthSignalsState,
} from '../models/healthSignals';
import { loadHealthSignalsCacheForGeography, saveHealthSignalsCache } from '../storage/storage';
import { healthCacheKey, resolveHealthGeography } from './healthGeography';
import {
  EXCESS_MORTALITY_FRESHNESS,
  RESPIRATORY_SURVEILLANCE_FRESHNESS,
  calculateHealthSignalFreshness,
} from './healthSignalFreshness';

const HEALTH_SIGNAL_PROVIDERS: HealthSignalProvider[] = [
  whoRespiratoryProvider,
  eurostatExcessMortalityProvider,
];

function cacheFreshEnough(cache: CachedHealthSignals | null, now: string): boolean {
  if (!cache) return false;
  const savedAt = Date.parse(cache.savedAt);
  const nowTime = Date.parse(now);
  if (!Number.isFinite(savedAt) || !Number.isFinite(nowTime)) return false;

  return nowTime - savedAt < 12 * 60 * 60 * 1000;
}

function sortSignals(signals: HealthSignal[]): HealthSignal[] {
  const order: Record<HealthSignal['type'], number> = {
    influenza: 0,
    'covid-19': 1,
    rsv: 2,
    'excess-mortality': 3,
  };

  return [...signals].sort((left, right) => order[left.type] - order[right.type]);
}

function providerOwnsSignal(providerId: string, signal: HealthSignal): boolean {
  if (providerId === whoRespiratoryProvider.id) {
    return RESPIRATORY_SIGNAL_TYPES.some((type) => type === signal.type);
  }
  if (providerId === eurostatExcessMortalityProvider.id) {
    return signal.type === 'excess-mortality';
  }
  return false;
}

function freshnessPolicyForSignal(signal: HealthSignal) {
  return signal.type === 'excess-mortality'
    ? EXCESS_MORTALITY_FRESHNESS
    : RESPIRATORY_SURVEILLANCE_FRESHNESS;
}

function cachedSignalForNow(signal: HealthSignal, now: string): HealthSignal | null {
  const freshness = calculateHealthSignalFreshness({
    updatedAt: signal.periodEnd ?? signal.updatedAt,
    now,
    policy: freshnessPolicyForSignal(signal),
  });
  if (freshness.status === 'stale') return null;

  return { ...signal, freshness };
}

function usableCachedSignals(cache: CachedHealthSignals | null, now: string): HealthSignal[] {
  return cache?.signals.flatMap((signal) => cachedSignalForNow(signal, now) ?? []) ?? [];
}

function mergeSignalsByType(fresh: HealthSignal[], cached: HealthSignal[]): HealthSignal[] {
  const freshTypes = new Set(fresh.map((signal) => signal.type));
  return [...fresh, ...cached.filter((signal) => !freshTypes.has(signal.type))];
}

function initialState(geography: HealthGeography | null): HealthSignalsState {
  return {
    geography,
    signals: [],
    loading: false,
    error: geography ? translate('errors.healthUnavailable') : null,
    updatedAt: null,
  };
}

function partialHealthSignalError(input: {
  respiratoryUnavailable: boolean;
  failed: boolean;
}): string | null {
  if (input.respiratoryUnavailable) {
    return translate('errors.respiratoryUnavailable');
  }
  if (input.failed) {
    return translate('errors.partialHealthUnavailable');
  }

  return null;
}

export async function refreshHealthSignalsForLocation(input: {
  location: LocationInfo;
  environment: NormalizedEnvironment | null;
  force?: boolean | undefined;
  now?: string | undefined;
}): Promise<HealthSignalsState> {
  const now = input.now ?? new Date().toISOString();
  const geography = resolveHealthGeography({
    location: input.location,
    coordinates: input.environment?.coordinates ?? input.location.coordinates,
  });
  if (!geography) {
    return {
      ...initialState(null),
      error: translate('errors.healthUnavailable'),
    };
  }

  const cache = await loadHealthSignalsCacheForGeography(healthCacheKey(geography));
  const cachedSignals = usableCachedSignals(cache, now);
  if (cache && cacheFreshEnough(cache, now) && cachedSignals.length > 0 && input.force !== true) {
    return {
      geography: cache.geography,
      signals: sortSignals(cachedSignals),
      loading: false,
      error: null,
      updatedAt: cache.savedAt,
    };
  }

  const providers = HEALTH_SIGNAL_PROVIDERS.filter((provider) =>
    provider.supports({ geography, now }),
  );
  const results = await Promise.allSettled(
    providers.map((provider) => provider.fetchSignals({ geography, now })),
  );
  const freshSignals = sortSignals(
    results.flatMap((result) => (result.status === 'fulfilled' ? result.value.signals : [])),
  );
  const failed = results.some((result) => result.status === 'rejected');
  const failedProviderIds = new Set(
    results.flatMap((result, index) =>
      result.status === 'rejected' && providers[index] ? [providers[index].id] : [],
    ),
  );
  const fallbackSignals = cachedSignals.filter((signal) =>
    [...failedProviderIds].some((providerId) => providerOwnsSignal(providerId, signal)),
  );
  const signals = sortSignals(mergeSignalsByType(freshSignals, fallbackSignals));
  const respiratoryUnavailable = !signals.some((signal) =>
    RESPIRATORY_SIGNAL_TYPES.some((type) => type === signal.type),
  );

  if (signals.length > 0) {
    const nextCache: CachedHealthSignals = {
      version: 1,
      savedAt: now,
      cacheKey: healthCacheKey(geography),
      geography,
      signals,
    };
    await saveHealthSignalsCache(nextCache);

    return {
      geography,
      signals,
      loading: false,
      error: partialHealthSignalError({ respiratoryUnavailable, failed }),
      updatedAt: now,
    };
  }

  if (cache) {
    if (cachedSignals.length === 0) {
      return {
        geography: cache.geography,
        signals: [],
        loading: false,
        error: failed
          ? translate('errors.healthUnavailable')
          : translate('errors.respiratoryUnavailable'),
        updatedAt: cache.savedAt,
      };
    }

    return {
      geography: cache.geography,
      signals: sortSignals(cachedSignals),
      loading: false,
      error: translate('errors.cachedHealth'),
      updatedAt: cache.savedAt,
    };
  }

  return {
    geography,
    signals: [],
    loading: false,
    error: failed
      ? translate('errors.healthUnavailable')
      : translate('errors.respiratoryUnavailable'),
    updatedAt: null,
  };
}

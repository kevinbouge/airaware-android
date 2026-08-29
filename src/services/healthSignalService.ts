import { cdcWastewaterProvider, CDC_WASTEWATER_SIGNAL_TYPES } from '../api/health/cdcWastewater';
import { eurostatExcessMortalityProvider } from '../api/health/eurostatExcessMortality';
import { owidExcessMortalityProvider } from '../api/health/owidExcessMortality';
import {
  radiologicalSpatialCacheKey,
  safecastRadiologicalProvider,
} from '../api/health/safecastRadiological';
import { RIVM_WASTEWATER_SIGNAL_TYPES, rivmWastewaterProvider } from '../api/health/rivmWastewater';
import { RESPIRATORY_SIGNAL_TYPES, whoRespiratoryProvider } from '../api/health/whoRespiratory';
import { whoVectorDiseaseProvider } from '../api/health/whoVectorDisease';
import { thermalStressSignalFromEnvironment } from '../core/thermalStress';
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
  RADIATION_MONITORING_FRESHNESS,
  RESPIRATORY_SURVEILLANCE_FRESHNESS,
  THERMAL_STRESS_FRESHNESS,
  MEASURED_SPORE_SURVEILLANCE_FRESHNESS,
  VECTOR_SURVEILLANCE_FRESHNESS,
  WASTEWATER_SURVEILLANCE_FRESHNESS,
  calculateHealthSignalFreshness,
} from './healthSignalFreshness';

const HEALTH_SIGNAL_PROVIDERS: HealthSignalProvider[] = [
  whoRespiratoryProvider,
  cdcWastewaterProvider,
  rivmWastewaterProvider,
  whoVectorDiseaseProvider,
  eurostatExcessMortalityProvider,
  owidExcessMortalityProvider,
  safecastRadiologicalProvider,
];

function providersForContext(context: {
  geography: HealthGeography | null;
  coordinates: { latitude: number; longitude: number } | undefined;
  now: string;
}): HealthSignalProvider[] {
  const eurostatSupported = eurostatExcessMortalityProvider.supports(context);

  return HEALTH_SIGNAL_PROVIDERS.filter((provider) => {
    if (provider.id === owidExcessMortalityProvider.id && eurostatSupported) return false;
    return provider.supports(context);
  });
}

function cacheSavedWithin(
  cache: CachedHealthSignals | null,
  now: string,
  maxAgeMs: number,
): boolean {
  if (!cache) return false;
  const savedAt = Date.parse(cache.savedAt);
  const nowTime = Date.parse(now);
  if (!Number.isFinite(savedAt) || !Number.isFinite(nowTime)) return false;

  return nowTime - savedAt < maxAgeMs;
}

function sortSignals(signals: HealthSignal[]): HealthSignal[] {
  const order: Record<HealthSignal['type'], number> = {
    influenza: 0,
    'covid-19': 1,
    rsv: 2,
    'thermal-stress': 3,
    'wastewater-covid-19': 4,
    'wastewater-influenza': 5,
    'wastewater-rsv': 6,
    dengue: 7,
    'west-nile': 8,
    malaria: 9,
    'tick-borne-disease': 10,
    'measured-mold-spores': 11,
    'excess-mortality': 12,
    'ambient-dose-rate': 13,
  };

  return [...signals].sort((left, right) => order[left.type] - order[right.type]);
}

function providerOwnsSignal(providerId: string, signal: HealthSignal): boolean {
  if (providerId === whoRespiratoryProvider.id) {
    return RESPIRATORY_SIGNAL_TYPES.some((type) => type === signal.type);
  }
  if (providerId === cdcWastewaterProvider.id) {
    return CDC_WASTEWATER_SIGNAL_TYPES.some((type) => type === signal.type);
  }
  if (providerId === rivmWastewaterProvider.id) {
    return RIVM_WASTEWATER_SIGNAL_TYPES.some((type) => type === signal.type);
  }
  if (providerId === whoVectorDiseaseProvider.id) {
    return ['dengue', 'west-nile', 'malaria', 'tick-borne-disease'].some(
      (type) => type === signal.type,
    );
  }
  if (providerId === eurostatExcessMortalityProvider.id) {
    return signal.type === 'excess-mortality' && signal.source.provider === 'Eurostat';
  }
  if (providerId === owidExcessMortalityProvider.id) {
    return signal.type === 'excess-mortality' && signal.source.provider === 'Our World in Data';
  }
  if (providerId === safecastRadiologicalProvider.id) {
    return signal.type === 'ambient-dose-rate';
  }
  return false;
}

function signalFreshnessRank(signal: HealthSignal): number {
  if (signal.metadata?.unavailable === true) return 0;
  if (signal.freshness.status === 'fresh') return 3;
  if (signal.freshness.status === 'aging') return 2;
  return 1;
}

function signalProviderRank(signal: HealthSignal): number {
  if (signal.source.provider === 'Eurostat') return 3;
  if (signal.source.provider === 'Our World in Data') return 2;
  return 1;
}

function betterSignal(left: HealthSignal, right: HealthSignal): HealthSignal {
  const freshnessDelta = signalFreshnessRank(left) - signalFreshnessRank(right);
  if (freshnessDelta !== 0) return freshnessDelta > 0 ? left : right;

  const providerDelta = signalProviderRank(left) - signalProviderRank(right);
  if (providerDelta !== 0) return providerDelta > 0 ? left : right;

  return left;
}

function dedupeSignalsByType(signals: HealthSignal[]): HealthSignal[] {
  const byType = new Map<HealthSignal['type'], HealthSignal>();

  signals.forEach((signal) => {
    const existing = byType.get(signal.type);
    byType.set(signal.type, existing ? betterSignal(existing, signal) : signal);
  });

  return [...byType.values()];
}

function freshnessPolicyForSignal(signal: HealthSignal) {
  if (signal.type === 'thermal-stress') return THERMAL_STRESS_FRESHNESS;
  if (signal.type === 'ambient-dose-rate') return RADIATION_MONITORING_FRESHNESS;
  if (
    signal.type === 'wastewater-covid-19' ||
    signal.type === 'wastewater-influenza' ||
    signal.type === 'wastewater-rsv'
  ) {
    return WASTEWATER_SURVEILLANCE_FRESHNESS;
  }
  if (
    signal.type === 'dengue' ||
    signal.type === 'west-nile' ||
    signal.type === 'malaria' ||
    signal.type === 'tick-borne-disease'
  ) {
    return VECTOR_SURVEILLANCE_FRESHNESS;
  }
  if (signal.type === 'measured-mold-spores') return MEASURED_SPORE_SURVEILLANCE_FRESHNESS;
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

function cacheKeyForProvider(
  provider: HealthSignalProvider,
  geography: HealthGeography | null,
  coordinates: { latitude: number; longitude: number } | undefined,
): string | null {
  if (provider.id === safecastRadiologicalProvider.id) {
    return coordinates ? radiologicalSpatialCacheKey(coordinates) : null;
  }

  return geography ? healthCacheKey(geography) : null;
}

async function loadProviderCaches(
  providers: HealthSignalProvider[],
  geography: HealthGeography | null,
  coordinates: { latitude: number; longitude: number } | undefined,
): Promise<Map<string, CachedHealthSignals | null>> {
  const keys = [
    ...new Set(
      providers.flatMap((provider) => {
        const key = cacheKeyForProvider(provider, geography, coordinates);
        return key ? [key] : [];
      }),
    ),
  ];
  const caches = await Promise.all(
    keys.map(async (key) => [key, await loadHealthSignalsCacheForGeography(key)] as const),
  );
  return new Map(caches);
}

function cachedSignalsForFailedProviders(input: {
  cachedSignals: HealthSignal[];
  failedProviderIds: Set<string>;
}): HealthSignal[] {
  return input.cachedSignals.filter((signal) =>
    [...input.failedProviderIds].some((providerId) => providerOwnsSignal(providerId, signal)),
  );
}

function providerHasFreshCache(input: {
  provider: HealthSignalProvider;
  cache: CachedHealthSignals | null;
  now: string;
}): boolean {
  const ownedSignals =
    input.cache?.signals.filter((signal) => providerOwnsSignal(input.provider.id, signal)) ?? [];
  if (ownedSignals.length === 0) return false;

  return ownedSignals.some(
    (signal) =>
      cacheSavedWithin(
        input.cache,
        input.now,
        freshnessPolicyForSignal(signal).expectedUpdateIntervalMs,
      ) && cachedSignalForNow(signal, input.now) !== null,
  );
}

async function saveSignalCaches(input: {
  providers: HealthSignalProvider[];
  geography: HealthGeography | null;
  coordinates: { latitude: number; longitude: number } | undefined;
  signals: HealthSignal[];
  now: string;
}): Promise<void> {
  const providerKeys = input.providers.flatMap((provider) => {
    const key = cacheKeyForProvider(provider, input.geography, input.coordinates);
    return key ? [{ provider, key }] : [];
  });
  const uniqueKeys = [...new Set(providerKeys.map((entry) => entry.key))];

  for (const key of uniqueKeys) {
    const providersForKey = providerKeys
      .filter((entry) => entry.key === key)
      .map((entry) => entry.provider);
    const signalsForKey = input.signals.filter((signal) =>
      providersForKey.some((provider) => providerOwnsSignal(provider.id, signal)),
    );
    const cacheGeography = signalsForKey[0]?.geography ?? input.geography;
    if (signalsForKey.length === 0 || !cacheGeography) continue;

    await saveHealthSignalsCache({
      version: 1,
      savedAt: input.now,
      cacheKey: key,
      geography: cacheGeography,
      signals: signalsForKey,
    });
  }
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
  const coordinates = input.environment?.coordinates ?? input.location.coordinates ?? undefined;
  const geography = resolveHealthGeography({
    location: input.location,
    coordinates,
  });
  if (!geography && !coordinates) {
    return {
      ...initialState(null),
      error: translate('errors.healthUnavailable'),
    };
  }

  const providerContext = { geography, coordinates, now };
  const environmentSignals = [
    thermalStressSignalFromEnvironment({ environment: input.environment, now }),
  ].filter((signal): signal is HealthSignal => signal !== null);
  const providers = providersForContext(providerContext);
  const caches = await loadProviderCaches(providers, geography, coordinates);
  const cachedSignals = [...caches.values()].flatMap((cache) => usableCachedSignals(cache, now));
  const providersToFetch =
    input.force === true
      ? providers
      : providers.filter((provider) => {
          const key = cacheKeyForProvider(provider, geography, coordinates);
          return !providerHasFreshCache({
            provider,
            cache: key ? (caches.get(key) ?? null) : null,
            now,
          });
        });

  if (providersToFetch.length === 0 && cachedSignals.length > 0 && input.force !== true) {
    return {
      geography,
      signals: sortSignals(dedupeSignalsByType([...environmentSignals, ...cachedSignals])),
      loading: false,
      error: null,
      updatedAt: [...caches.values()].find((cache) => cache !== null)?.savedAt ?? null,
    };
  }

  const results = await Promise.allSettled(
    providersToFetch.map((provider) => provider.fetchSignals(providerContext)),
  );
  const freshSignals = sortSignals(
    dedupeSignalsByType([
      ...environmentSignals,
      ...results.flatMap((result) => (result.status === 'fulfilled' ? result.value.signals : [])),
    ]),
  );
  const failed = results.some((result) => result.status === 'rejected');
  const failedProviderIds = new Set(
    results.flatMap((result, index) =>
      result.status === 'rejected' && providersToFetch[index] ? [providersToFetch[index].id] : [],
    ),
  );
  const fetchedProviderIds = new Set(providersToFetch.map((provider) => provider.id));
  const skippedCachedSignals = cachedSignals.filter((signal) =>
    providers.some(
      (provider) => !fetchedProviderIds.has(provider.id) && providerOwnsSignal(provider.id, signal),
    ),
  );
  const fallbackSignals = cachedSignalsForFailedProviders({ cachedSignals, failedProviderIds });
  const signals = sortSignals(
    dedupeSignalsByType(
      mergeSignalsByType(freshSignals, [...skippedCachedSignals, ...fallbackSignals]),
    ),
  );
  const respiratoryUnavailable = !signals.some((signal) =>
    RESPIRATORY_SIGNAL_TYPES.some((type) => type === signal.type),
  );

  if (signals.length > 0) {
    await saveSignalCaches({
      providers,
      geography,
      signals,
      coordinates,
      now,
    });

    return {
      geography,
      signals,
      loading: false,
      error: partialHealthSignalError({ respiratoryUnavailable, failed }),
      updatedAt: now,
    };
  }

  const cache = [...caches.values()].find((entry) => entry !== null) ?? null;
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

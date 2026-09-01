import { cdcWastewaterProvider } from '../api/health/cdcWastewater';
import { ecdcChikungunyaProvider, ecdcDengueProvider } from '../api/health/ecdcVectorSurveillance';
import { eurostatExcessMortalityProvider } from '../api/health/eurostatExcessMortality';
import { owidExcessMortalityProvider } from '../api/health/owidExcessMortality';
import { phacWastewaterProvider } from '../api/health/phacWastewater';
import {
  radiologicalSpatialCacheKey,
  safecastRadiologicalProvider,
} from '../api/health/safecastRadiological';
import { rivmWastewaterProvider } from '../api/health/rivmWastewater';
import { sumeauWastewaterProvider } from '../api/health/sumeauWastewater';
import { whoOutbreakProvider } from '../api/health/whoOutbreaks';
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
  evaluateHealthSignalFreshness,
  freshnessPolicyForHealthSignal,
  resolveBestHealthObservation,
} from './healthSignalFreshness';

const HEALTH_SIGNAL_PROVIDERS: HealthSignalProvider[] = [
  whoRespiratoryProvider,
  whoOutbreakProvider,
  cdcWastewaterProvider,
  phacWastewaterProvider,
  sumeauWastewaterProvider,
  rivmWastewaterProvider,
  ecdcDengueProvider,
  ecdcChikungunyaProvider,
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
  return HEALTH_SIGNAL_PROVIDERS.filter((provider) => provider.supports(context));
}

function cacheSavedWithin(
  cache: CachedHealthSignals | null,
  now: string,
  maxAgeMs: number,
): boolean {
  if (!cache) return false;
  return cacheSavedAtWithin(cache.savedAt, now, maxAgeMs);
}

function cacheSavedAtWithin(savedAtValue: string, now: string, maxAgeMs: number): boolean {
  const savedAt = Date.parse(savedAtValue);
  const nowTime = Date.parse(now);
  if (!Number.isFinite(savedAt) || !Number.isFinite(nowTime)) return false;

  return nowTime - savedAt < maxAgeMs;
}

function sortSignals(signals: HealthSignal[]): HealthSignal[] {
  const order: Record<HealthSignal['type'], number> = {
    influenza: 0,
    'covid-19': 1,
    rsv: 2,
    'outbreak-event': 3,
    'thermal-stress': 4,
    'wastewater-covid-19': 5,
    'wastewater-influenza': 6,
    'wastewater-rsv': 7,
    dengue: 8,
    chikungunya: 9,
    'west-nile': 10,
    malaria: 11,
    'tick-borne-disease': 12,
    'measured-mold-spores': 13,
    'excess-mortality': 14,
    'ambient-dose-rate': 15,
  };

  return [...signals].sort((left, right) => order[left.type] - order[right.type]);
}

function providerOwnsSignal(providerId: string, signal: HealthSignal): boolean {
  if (providerId === eurostatExcessMortalityProvider.id) {
    return signal.type === 'excess-mortality' && signal.source.provider === 'Eurostat';
  }
  if (providerId === owidExcessMortalityProvider.id) {
    return signal.type === 'excess-mortality' && signal.source.provider === 'Our World in Data';
  }
  return providerSignalTypes(providerId).some((type) => type === signal.type);
}

function signalAvailabilityRank(signal: HealthSignal): number {
  return signal.metadata?.unavailable === true ? 0 : 1;
}

function signalFreshnessRank(signal: HealthSignal): number {
  if (signal.metadata?.unavailable === true) return 0;
  if (signal.freshness.status === 'fresh') return 3;
  if (signal.freshness.status === 'aging') return 2;
  return 1;
}

function signalProviderRank(signal: HealthSignal): number {
  if (signal.source.provider === 'Our World in Data') return 3;
  if (signal.source.provider === 'Eurostat') return 2;
  return 1;
}

function signalReportingTime(signal: HealthSignal): number {
  const timestamp = signal.periodEnd ?? signal.observedAt ?? signal.updatedAt;
  const parsed = Date.parse(timestamp);
  return Number.isFinite(parsed) ? parsed : 0;
}

function rankedSignal(
  left: HealthSignal,
  right: HealthSignal,
  rank: (signal: HealthSignal) => number,
): HealthSignal | null {
  const delta = rank(left) - rank(right);
  if (delta === 0) return null;
  return delta > 0 ? left : right;
}

function nonStaleSignal(left: HealthSignal, right: HealthSignal): HealthSignal | null {
  const leftStale = left.freshness.status === 'stale';
  const rightStale = right.freshness.status === 'stale';
  if (leftStale === rightStale) return null;
  return leftStale ? right : left;
}

function betterMortalitySignal(left: HealthSignal, right: HealthSignal): HealthSignal {
  return (
    rankedSignal(left, right, signalAvailabilityRank) ??
    nonStaleSignal(left, right) ??
    rankedSignal(left, right, signalFreshnessRank) ??
    rankedSignal(left, right, signalReportingTime) ??
    rankedSignal(left, right, signalProviderRank) ??
    left
  );
}

function betterSignal(left: HealthSignal, right: HealthSignal): HealthSignal {
  if (left.type === 'excess-mortality' && right.type === 'excess-mortality') {
    return betterMortalitySignal(left, right);
  }

  return resolveBestHealthObservation(left, right);
}

function dedupeSignalsByType(signals: HealthSignal[]): HealthSignal[] {
  const byType = new Map<string, HealthSignal>();

  signals.forEach((signal) => {
    const key = signal.type === 'outbreak-event' ? signal.id : signal.type;
    const existing = byType.get(key);
    byType.set(key, existing ? betterSignal(existing, signal) : signal);
  });

  return [...byType.values()];
}

function cachedSignalForNow(
  signal: HealthSignal,
  now: string,
  cacheSavedAt?: string | undefined,
): HealthSignal | null {
  if (signalHasProviderError(signal)) return null;

  if (signal.metadata?.unavailable === true) {
    const policy = freshnessPolicyForHealthSignal(signal);
    if (cacheSavedAt && cacheSavedAtWithin(cacheSavedAt, now, policy.expectedUpdateIntervalMs)) {
      return signal;
    }

    return null;
  }

  const freshness = evaluateHealthSignalFreshness(signal, now);
  if (freshness.status === 'stale') return null;

  return { ...signal, freshness };
}

function usableCachedSignals(cache: CachedHealthSignals | null, now: string): HealthSignal[] {
  return (
    cache?.signals.flatMap((signal) => cachedSignalForNow(signal, now, cache.savedAt) ?? []) ?? []
  );
}

function mergeSignalsByType(fresh: HealthSignal[], cached: HealthSignal[]): HealthSignal[] {
  const freshTypes = new Set(
    fresh.filter((signal) => !signalHasProviderError(signal)).map((signal) => signal.type),
  );
  return [...fresh, ...cached.filter((signal) => !freshTypes.has(signal.type))];
}

function normalizedProviderLocationName(locationName: string | undefined): string | null {
  const normalized = locationName
    ?.normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .split('-')
    .filter(Boolean)
    .join('-');

  return normalized ? normalized : null;
}

function cacheKeyForProvider(
  provider: HealthSignalProvider,
  geography: HealthGeography | null,
  coordinates: { latitude: number; longitude: number } | undefined,
  locationName?: string | undefined,
): string | null {
  if (provider.id === safecastRadiologicalProvider.id) {
    return coordinates ? radiologicalSpatialCacheKey(coordinates) : null;
  }

  if (
    provider.id === phacWastewaterProvider.id ||
    provider.id === ecdcDengueProvider.id ||
    provider.id === ecdcChikungunyaProvider.id
  ) {
    if (!geography?.countryCode) return null;
    const normalizedLocation = normalizedProviderLocationName(locationName);
    return normalizedLocation
      ? `${provider.id}:${geography.countryCode}:${normalizedLocation}`
      : null;
  }

  return geography ? healthCacheKey(geography) : null;
}

async function loadProviderCaches(
  providers: HealthSignalProvider[],
  geography: HealthGeography | null,
  coordinates: { latitude: number; longitude: number } | undefined,
  locationName?: string | undefined,
): Promise<Map<string, CachedHealthSignals | null>> {
  const keys = [
    ...new Set(
      providers.flatMap((provider) => {
        const key = cacheKeyForProvider(provider, geography, coordinates, locationName);
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

function providerCachedSignalCandidates(input: {
  provider: HealthSignalProvider;
  cache: CachedHealthSignals | null;
}): HealthSignal[] {
  const signals = input.cache?.signals ?? [];

  if (input.provider.id === eurostatExcessMortalityProvider.id) {
    return signals.filter(
      (signal) => signal.type === 'excess-mortality' && signal.source.provider === 'Eurostat',
    );
  }

  return signals.filter((signal) => providerOwnsSignal(input.provider.id, signal));
}

function providerHasFreshCache(input: {
  provider: HealthSignalProvider;
  cache: CachedHealthSignals | null;
  now: string;
}): boolean {
  const ownedSignals = providerCachedSignalCandidates({
    provider: input.provider,
    cache: input.cache,
  });
  if (ownedSignals.length === 0) return false;

  const expectedTypes = providerSignalTypes(input.provider.id);
  const cachedResultUsable = (signal: HealthSignal) =>
    cacheSavedWithin(
      input.cache,
      input.now,
      freshnessPolicyForHealthSignal(signal).expectedUpdateIntervalMs,
    ) && cachedSignalForNow(signal, input.now, input.cache?.savedAt) !== null;

  if (expectedTypes.length === 0) return ownedSignals.some(cachedResultUsable);

  return expectedTypes.every((type) =>
    ownedSignals.some((signal) => signal.type === type && cachedResultUsable(signal)),
  );
}

function providerSignalTypes(providerId: string): HealthSignal['type'][] {
  const provider = HEALTH_SIGNAL_PROVIDERS.find((candidate) => candidate.id === providerId);
  return [...(provider?.signals ?? [])];
}

function providerFailuresAffectDisplayedState(input: {
  failedProviderIds: Set<string>;
  signals: HealthSignal[];
}): boolean {
  return [...input.failedProviderIds].some((providerId) =>
    providerSignalTypes(providerId).some((type) => {
      const signal = input.signals.find((item) => item.type === type);
      return (
        !signal || signal.metadata?.unavailable === true || signal.freshness.status === 'stale'
      );
    }),
  );
}

function providerErrorTypesAffectDisplayedState(input: {
  providerErrorTypes: Set<HealthSignal['type']>;
  signals: HealthSignal[];
}): boolean {
  return [...input.providerErrorTypes].some((type) => {
    if (type === 'outbreak-event' || type === 'dengue' || type === 'chikungunya') return false;
    const signal = input.signals.find((item) => item.type === type);
    return !signal || signal.metadata?.unavailable === true || signal.freshness.status === 'stale';
  });
}

function signalHasProviderError(signal: HealthSignal): boolean {
  return signal.metadata?.providerStatus === 'provider-error';
}

function signalProviderErrorAffectsSummary(signal: HealthSignal): boolean {
  if (!signalHasProviderError(signal)) return false;
  return (
    signal.type !== 'outbreak-event' && signal.type !== 'dengue' && signal.type !== 'chikungunya'
  );
}

async function saveSignalCaches(input: {
  providers: HealthSignalProvider[];
  geography: HealthGeography | null;
  coordinates: { latitude: number; longitude: number } | undefined;
  locationName?: string | undefined;
  signals: HealthSignal[];
  now: string;
}): Promise<void> {
  const providerKeys = input.providers.flatMap((provider) => {
    const key = cacheKeyForProvider(
      provider,
      input.geography,
      input.coordinates,
      input.locationName,
    );
    return key ? [{ provider, key }] : [];
  });
  const uniqueKeys = [...new Set(providerKeys.map((entry) => entry.key))];

  for (const key of uniqueKeys) {
    const providersForKey = providerKeys
      .filter((entry) => entry.key === key)
      .map((entry) => entry.provider);
    const signalsForKey = input.signals.filter(
      (signal) =>
        !signalHasProviderError(signal) &&
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
  allProviderErrors: boolean;
}): string | null {
  if (input.allProviderErrors) {
    return translate('errors.healthUnavailable');
  }
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

  const providerContext = {
    geography,
    coordinates,
    locationName: input.location.placeName ?? undefined,
    now,
  };
  const environmentSignals = [
    thermalStressSignalFromEnvironment({ environment: input.environment, now }),
  ].filter((signal): signal is HealthSignal => signal !== null);
  const providers = providersForContext(providerContext);
  const caches = await loadProviderCaches(
    providers,
    geography,
    coordinates,
    providerContext.locationName,
  );
  const cachedSignals = [...caches.values()].flatMap((cache) => usableCachedSignals(cache, now));
  const providersToFetch =
    input.force === true
      ? providers
      : providers.filter((provider) => {
          const providerCacheKey = cacheKeyForProvider(
            provider,
            geography,
            coordinates,
            providerContext.locationName,
          );
          return !providerHasFreshCache({
            provider,
            cache: providerCacheKey ? (caches.get(providerCacheKey) ?? null) : null,
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
  const fetchedSignals = results.flatMap((result) =>
    result.status === 'fulfilled' ? result.value.signals : [],
  );
  const freshSignals = sortSignals(dedupeSignalsByType([...environmentSignals, ...fetchedSignals]));
  const failed = results.some((result) => result.status === 'rejected');
  const failedProviderIds = new Set(
    results.flatMap((result, index) =>
      result.status === 'rejected' && providersToFetch[index] ? [providersToFetch[index].id] : [],
    ),
  );
  const providerErrorTypes = new Set<HealthSignal['type']>();
  results.forEach((result) => {
    if (result.status !== 'fulfilled') return;
    result.value.signalStatuses
      ?.filter((status) => status.status === 'provider-error')
      .forEach((status) => {
        providerErrorTypes.add(status.type);
      });
    result.value.signals.filter(signalHasProviderError).forEach((signal) => {
      providerErrorTypes.add(signal.type);
    });
  });
  const fetchedProviderIds = new Set(providersToFetch.map((provider) => provider.id));
  const skippedCachedSignals = cachedSignals.filter((signal) =>
    providers.some(
      (provider) => !fetchedProviderIds.has(provider.id) && providerOwnsSignal(provider.id, signal),
    ),
  );
  const fallbackSignals = cachedSignalsForFailedProviders({ cachedSignals, failedProviderIds });
  const providerErrorFallbackSignals = cachedSignals.filter((signal) =>
    providerErrorTypes.has(signal.type),
  );
  const signals = sortSignals(
    dedupeSignalsByType(
      mergeSignalsByType(freshSignals, [
        ...skippedCachedSignals,
        ...fallbackSignals,
        ...providerErrorFallbackSignals,
      ]),
    ),
  );
  const providerErrorCacheFallbackUsed = providerErrorFallbackSignals.some((fallbackSignal) =>
    signals.some((signal) => signal.id === fallbackSignal.id),
  );
  const displayAffectingFailure =
    providerFailuresAffectDisplayedState({
      failedProviderIds,
      signals,
    }) ||
    providerErrorTypesAffectDisplayedState({
      providerErrorTypes,
      signals,
    }) ||
    providerErrorCacheFallbackUsed ||
    signals.some(signalProviderErrorAffectsSummary);
  const respiratoryUnavailable = !signals.some((signal) =>
    RESPIRATORY_SIGNAL_TYPES.some((type) => type === signal.type),
  );
  const allProviderErrors = signals.length > 0 && signals.every(signalHasProviderError);

  if (signals.length > 0) {
    await saveSignalCaches({
      providers,
      geography,
      signals: [...environmentSignals, ...fetchedSignals, ...skippedCachedSignals],
      coordinates,
      locationName: providerContext.locationName,
      now,
    });

    return {
      geography,
      signals,
      loading: false,
      error: partialHealthSignalError({
        respiratoryUnavailable,
        failed: displayAffectingFailure,
        allProviderErrors,
      }),
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

import { focusManager, QueryClient } from '@tanstack/react-query';
import { AppState, type AppStateStatus } from 'react-native';
import {
  DATA_DETAIL_CACHE_STALE_AFTER_MS,
  ENVIRONMENT_PROVIDER_FRESHNESS_MS,
  VEGETATION_CACHE_STALE_AFTER_MS,
} from '../core/constants';

export const providerStaleTimes = {
  airQuality: ENVIRONMENT_PROVIDER_FRESHNESS_MS,
  weather: ENVIRONMENT_PROVIDER_FRESHNESS_MS,
  vegetation: VEGETATION_CACHE_STALE_AFTER_MS,
  dataDetailHistory: DATA_DETAIL_CACHE_STALE_AFTER_MS,
  dataDetailForecast: ENVIRONMENT_PROVIDER_FRESHNESS_MS,
} as const;

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: ENVIRONMENT_PROVIDER_FRESHNESS_MS,
      gcTime: 60 * 60 * 1000,
      refetchOnMount: false,
      refetchOnReconnect: false,
      refetchOnWindowFocus: false,
    },
  },
});

function syncQueryFocusWithAppState(nextState: AppStateStatus): void {
  focusManager.setFocused(nextState === 'active');
}

export function installQueryFocusListener(): () => void {
  syncQueryFocusWithAppState(AppState.currentState);
  const subscription = AppState.addEventListener('change', syncQueryFocusWithAppState);
  return () => subscription.remove();
}

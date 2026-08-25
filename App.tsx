import { StatusBar } from 'expo-status-bar';
import { QueryClientProvider } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AppNavigator } from './src/navigation/AppNavigator';
import { installQueryFocusListener, queryClient } from './src/services/queryClient';
import { shouldRefreshAfterHydration } from './src/state/appLifecycle';
import {
  disposeAppStoreResources,
  flushPendingSettingsSave,
  useAppStore,
} from './src/state/useAppStore';

export default function App() {
  const hydrate = useAppStore((state) => state.hydrate);
  const hydrated = useAppStore((state) => state.hydrated);
  const refresh = useAppStore((state) => state.refresh);
  const locationOnboardingComplete = useAppStore(
    (state) => state.settings.locationOnboardingComplete,
  );
  const appState = useRef(AppState.currentState);

  useEffect(() => {
    void hydrate();
    const uninstallQueryFocusListener = installQueryFocusListener();
    return () => {
      uninstallQueryFocusListener();
      disposeAppStoreResources();
    };
  }, [hydrate]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      const wasInactive = appState.current === 'background' || appState.current === 'inactive';
      appState.current = nextState;

      if (nextState === 'background' || nextState === 'inactive') {
        void flushPendingSettingsSave();
      }

      if (nextState === 'active' && wasInactive && hydrated && locationOnboardingComplete) {
        void refresh();
      }
    });

    return () => subscription.remove();
  }, [hydrated, locationOnboardingComplete, refresh]);

  useEffect(() => {
    if (
      shouldRefreshAfterHydration({
        hydrated,
        locationOnboardingComplete,
      })
    ) {
      void refresh();
    }
  }, [hydrated, locationOnboardingComplete, refresh]);

  return (
    <QueryClientProvider client={queryClient}>
      <SafeAreaProvider>
        <AppNavigator />
        <StatusBar style="auto" />
      </SafeAreaProvider>
    </QueryClientProvider>
  );
}

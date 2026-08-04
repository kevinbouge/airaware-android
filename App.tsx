import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { AppNavigator } from './src/navigation/AppNavigator';
import { useCapabilities } from './src/hooks/useCapabilities';
import { shouldRefreshAfterHydration, shouldRunScheduledRefresh } from './src/state/appLifecycle';
import {
  disposeAppStoreResources,
  flushPendingSettingsSave,
  useAppStore,
} from './src/state/useAppStore';

export default function App() {
  const hydrate = useAppStore((state) => state.hydrate);
  const hydrated = useAppStore((state) => state.hydrated);
  const environment = useAppStore((state) => state.environment);
  const refresh = useAppStore((state) => state.refresh);
  const refreshIntervalMinutes = useAppStore((state) => state.settings.refreshIntervalMinutes);
  const locationOnboardingComplete = useAppStore(
    (state) => state.settings.locationOnboardingComplete,
  );
  const capabilities = useCapabilities();
  const extendedRefreshAttempted = useRef(false);

  useEffect(() => {
    void hydrate();
    return () => disposeAppStoreResources();
  }, [hydrate]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'background' || state === 'inactive') {
        void flushPendingSettingsSave();
      }
    });

    return () => subscription.remove();
  }, []);

  useEffect(() => {
    if (
      shouldRefreshAfterHydration({
        hydrated,
        environment,
        locationOnboardingComplete,
        capabilities,
        extendedRefreshAttempted: extendedRefreshAttempted.current,
      })
    ) {
      extendedRefreshAttempted.current = true;
      void refresh();
    }
  }, [capabilities, environment, hydrated, locationOnboardingComplete, refresh]);

  useEffect(() => {
    if (!shouldRunScheduledRefresh({ hydrated, locationOnboardingComplete })) {
      return undefined;
    }

    const timer = setInterval(
      () => {
        void refresh();
      },
      refreshIntervalMinutes * 60 * 1000,
    );

    return () => clearInterval(timer);
  }, [hydrated, locationOnboardingComplete, refresh, refreshIntervalMinutes]);

  return (
    <>
      <AppNavigator />
      <StatusBar style="auto" />
    </>
  );
}

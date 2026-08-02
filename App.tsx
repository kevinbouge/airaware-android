import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { AppNavigator } from './src/navigation/AppNavigator';
import { shouldRefreshAfterHydration, shouldRunScheduledRefresh } from './src/state/appLifecycle';
import { useAppStore } from './src/state/useAppStore';

export default function App() {
  const hydrate = useAppStore((state) => state.hydrate);
  const hydrated = useAppStore((state) => state.hydrated);
  const environment = useAppStore((state) => state.environment);
  const refresh = useAppStore((state) => state.refresh);
  const refreshIntervalMinutes = useAppStore((state) => state.settings.refreshIntervalMinutes);
  const locationOnboardingComplete = useAppStore(
    (state) => state.settings.locationOnboardingComplete,
  );

  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  useEffect(() => {
    if (shouldRefreshAfterHydration({ hydrated, environment, locationOnboardingComplete })) {
      void refresh();
    }
  }, [environment, hydrated, locationOnboardingComplete, refresh]);

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

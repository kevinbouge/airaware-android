import { useMemo } from 'react';
import { deriveEnvironmentState } from '../state/derivedEnvironment';
import { useAppStore } from '../state/useAppStore';

export function useDerivedEnvironment() {
  const environment = useAppStore((state) => state.environment);
  const profile = useAppStore((state) => state.profile);
  const duration = useAppStore((state) => state.settings.outdoorWindowDurationHours);

  return useMemo(
    () => deriveEnvironmentState(environment, profile, duration),
    [duration, environment, profile],
  );
}

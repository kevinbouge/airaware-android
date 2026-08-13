import { useMemo } from 'react';
import { deriveEnvironmentState } from '../state/derivedEnvironment';
import { useAppStore } from '../state/useAppStore';
import { useCapabilities } from './useCapabilities';

export function useDerivedEnvironment() {
  const environment = useAppStore((state) => state.environment);
  const profile = useAppStore((state) => state.profile);
  const capabilities = useCapabilities();

  return useMemo(
    () => deriveEnvironmentState(environment, profile, capabilities),
    [capabilities, environment, profile],
  );
}

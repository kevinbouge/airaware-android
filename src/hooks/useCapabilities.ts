import { useMemo } from 'react';
import { capabilitiesForEntitlement } from '../capabilities/config';
import { useAppStore } from '../state/useAppStore';

export function useCapabilities() {
  const entitlement = useAppStore((state) => state.entitlement);

  return useMemo(() => capabilitiesForEntitlement(entitlement), [entitlement]);
}

import {
  FREE_ENTITLEMENT,
  entitlementForBuild,
  type EntitlementState,
} from '../capabilities/entitlements';
import { loadDevelopmentEntitlementOverride } from '../storage/storage';

type BillingStatus = 'not_configured';

export interface BillingGateway {
  status: BillingStatus;
  isAvailable: () => false;
  currentEntitlement: () => Promise<EntitlementState>;
}

export function createBillingGateway(): BillingGateway {
  return {
    status: 'not_configured',
    isAvailable: () => false,
    currentEntitlement: async () => {
      const developmentOverride = __DEV__ ? await loadDevelopmentEntitlementOverride() : undefined;

      return entitlementForBuild({
        isProduction: !__DEV__,
        developmentOverride,
        storedEntitlement: FREE_ENTITLEMENT,
      });
    },
  };
}

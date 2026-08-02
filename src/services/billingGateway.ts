import {
  FREE_ENTITLEMENT,
  PRO_LIFETIME_ENTITLEMENT,
  entitlementForBuild,
  type EntitlementState,
} from '../capabilities/entitlements';

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
    currentEntitlement: async () =>
      entitlementForBuild({
        isProduction: !__DEV__,
        developmentOverride: PRO_LIFETIME_ENTITLEMENT,
        storedEntitlement: FREE_ENTITLEMENT,
      }),
  };
}

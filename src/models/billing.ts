import type { EntitlementState } from '../capabilities/entitlements';

type BillingStatus =
  'unconfigured' | 'initializing' | 'ready' | 'unavailable' | 'offline' | 'error';

type EntitlementStatus = 'loading' | 'free' | 'pro' | 'cached_pro' | 'unknown';

export type BillingEntitlementSource =
  | 'revenuecat'
  | 'cached_revenuecat'
  | 'development_preview'
  | 'unconfigured'
  | 'unavailable'
  | 'unknown';

export interface ProOffering {
  packageIdentifier: string;
  productIdentifier: string | null;
  title: string | null;
  description: string | null;
  priceString: string | null;
  currencyCode: string | null;
  price: number | null;
  available: boolean;
}

export interface BillingState {
  billingStatus: BillingStatus;
  entitlementStatus: EntitlementStatus;
  entitlement: EntitlementState;
  entitlementSource: BillingEntitlementSource;
  proActive: boolean;
  offering: ProOffering | null;
  purchaseInProgress: boolean;
  restoreInProgress: boolean;
  lastSuccessfulEntitlementRefreshAt: string | null;
  error: string | null;
}

export interface BillingOperationResult {
  billingState: BillingState;
  message: string | null;
  cancelled?: boolean;
}

export const UNCONFIGURED_BILLING_STATE: BillingState = {
  billingStatus: 'unconfigured',
  entitlementStatus: 'free',
  entitlement: { kind: 'free' },
  entitlementSource: 'unconfigured',
  proActive: false,
  offering: null,
  purchaseInProgress: false,
  restoreInProgress: false,
  lastSuccessfulEntitlementRefreshAt: null,
  error: null,
};

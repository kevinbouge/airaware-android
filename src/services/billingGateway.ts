import { Platform } from 'react-native';
import {
  FREE_ENTITLEMENT,
  PRO_LIFETIME_ENTITLEMENT,
  entitlementForBuild,
  type EntitlementState,
} from '../capabilities/entitlements';
import type { BillingOperationResult, BillingState, ProOffering } from '../models/billing';
import { UNCONFIGURED_BILLING_STATE } from '../models/billing';
import { loadBillingEntitlementCache, saveBillingEntitlementCache } from '../storage/storage';
import { translate } from '../i18n';

const REVENUECAT_PRO_ENTITLEMENT_ID = 'pro';
const REVENUECAT_LIFETIME_PACKAGE_ID = 'lifetime';
const PURCHASE_CANCELLED_ERROR_CODE = '1';
const NETWORK_ERROR_CODES = new Set(['10', '35']);
const PAYMENT_PENDING_ERROR_CODE = '20';

type CustomerInfoLike = {
  entitlements?: {
    active?: Record<string, unknown>;
  };
};

type StoreProductLike = {
  identifier?: unknown;
  title?: unknown;
  description?: unknown;
  priceString?: unknown;
  currencyCode?: unknown;
  price?: unknown;
};

type PackageLike = {
  identifier?: unknown;
  product?: StoreProductLike;
};

type OfferingsLike = {
  current?: {
    availablePackages?: PackageLike[];
  } | null;
};

type PurchasesClientLike = {
  configure: (config: { apiKey: string }) => void;
  setLogLevel?: (level: unknown) => void;
  setLogHandler?: (handler: (logLevel: unknown, message: string) => void) => void;
  getCustomerInfo: () => Promise<CustomerInfoLike>;
  getOfferings: () => Promise<OfferingsLike>;
  purchasePackage: (
    pkg: PackageLike,
  ) => Promise<{ customerInfo?: CustomerInfoLike } | CustomerInfoLike>;
  restorePurchases: () => Promise<CustomerInfoLike>;
  addCustomerInfoUpdateListener?: (listener: (customerInfo: CustomerInfoLike) => void) => void;
  removeCustomerInfoUpdateListener?: (listener: (customerInfo: CustomerInfoLike) => void) => void;
};

type PurchasesModuleLike = {
  default?: PurchasesClientLike;
  LOG_LEVEL?: {
    VERBOSE?: unknown;
  };
};

export interface BillingGatewayDependencies {
  apiKey?: string | null;
  platformOS?: string;
  isDevelopment?: boolean;
  loadPurchasesModule?: () => Promise<PurchasesModuleLike>;
  now?: () => string;
}

export interface BillingGateway {
  initializeBilling: () => Promise<BillingState>;
  getBillingState: () => BillingState;
  currentEntitlement: () => Promise<EntitlementState>;
  loadProOffering: () => Promise<ProOffering | null>;
  purchaseProLifetime: () => Promise<BillingOperationResult>;
  restorePurchases: () => Promise<BillingOperationResult>;
  refreshEntitlement: () => Promise<BillingState>;
  subscribeToEntitlementChanges: (listener: (state: BillingState) => void) => () => void;
  dispose: () => void;
}

function configuredApiKey(): string | null {
  const value = process.env.EXPO_PUBLIC_REVENUECAT_API_KEY;
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

async function defaultModuleLoader(): Promise<PurchasesModuleLike> {
  return import('react-native-purchases') as unknown as Promise<PurchasesModuleLike>;
}

function hasActiveProEntitlement(customerInfo: CustomerInfoLike | null): boolean {
  return Boolean(customerInfo?.entitlements?.active?.[REVENUECAT_PRO_ENTITLEMENT_ID]);
}

function entitlementFromCustomerInfo(customerInfo: CustomerInfoLike | null): EntitlementState {
  return hasActiveProEntitlement(customerInfo) ? PRO_LIFETIME_ENTITLEMENT : FREE_ENTITLEMENT;
}

function stringOrNull(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function numberOrNull(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function normalizePackage(pkg: PackageLike | null): ProOffering | null {
  if (!pkg) return null;

  const product = pkg.product ?? {};
  return {
    packageIdentifier: stringOrNull(pkg.identifier) ?? REVENUECAT_LIFETIME_PACKAGE_ID,
    productIdentifier: stringOrNull(product.identifier),
    title: stringOrNull(product.title),
    description: stringOrNull(product.description),
    priceString: stringOrNull(product.priceString),
    currencyCode: stringOrNull(product.currencyCode),
    price: numberOrNull(product.price),
    available: true,
  };
}

function unavailableLifetimePackage(): ProOffering {
  return {
    packageIdentifier: REVENUECAT_LIFETIME_PACKAGE_ID,
    productIdentifier: null,
    title: null,
    description: null,
    priceString: null,
    currencyCode: null,
    price: null,
    available: false,
  };
}

function customerInfoFromPurchaseResult(
  result: { customerInfo?: CustomerInfoLike } | CustomerInfoLike,
): CustomerInfoLike | null {
  if (result && typeof result === 'object' && 'customerInfo' in result) {
    return result.customerInfo ?? null;
  }

  return (result as CustomerInfoLike) ?? null;
}

function isCancelledPurchase(error: unknown): boolean {
  return (
    error !== null &&
    typeof error === 'object' &&
    ((error as Record<string, unknown>).userCancelled === true ||
      (error as Record<string, unknown>).code === PURCHASE_CANCELLED_ERROR_CODE ||
      (error as Record<string, unknown>).code === 'PURCHASE_CANCELLED_ERROR')
  );
}

function isPendingPurchase(error: unknown): boolean {
  return (
    error !== null &&
    typeof error === 'object' &&
    (error as Record<string, unknown>).code === PAYMENT_PENDING_ERROR_CODE
  );
}

function userSafeError(error: unknown): 'offline' | 'error' {
  if (error !== null && typeof error === 'object') {
    const code = (error as Record<string, unknown>).code;
    if (
      typeof code === 'string' &&
      (NETWORK_ERROR_CODES.has(code) || code.toLowerCase().includes('network'))
    ) {
      return 'offline';
    }
  }

  return 'error';
}

function isKnownPaywallUiConfigLog(message: string): boolean {
  return (
    (message.includes('Failed to ready ui_config before getOfferings') &&
      message.includes('proceeding without it')) ||
    (message.includes('Could not resolve remote config blob(s)') &&
      message.includes("topic 'ui_config'"))
  );
}

function installRevenueCatLogHandler(purchases: PurchasesClientLike, isDevelopment: boolean): void {
  purchases.setLogHandler?.((logLevel, message) => {
    const text = typeof message === 'string' ? message : String(message);

    if (isKnownPaywallUiConfigLog(text)) {
      return;
    }

    if (!isDevelopment) {
      return;
    }

    const formatted = `[RevenueCat] ${text}`;
    switch (String(logLevel)) {
      case 'ERROR':
      case 'WARN':
        console.warn(formatted);
        break;
      default:
        break;
    }
  });
}

export function createBillingGateway(
  dependencies: BillingGatewayDependencies = {},
): BillingGateway {
  const platformOS = dependencies.platformOS ?? Platform.OS;
  const isDevelopment = dependencies.isDevelopment ?? __DEV__;
  const now = dependencies.now ?? (() => new Date().toISOString());
  const apiKey = dependencies.apiKey ?? configuredApiKey();
  const loadPurchasesModule = dependencies.loadPurchasesModule ?? defaultModuleLoader;

  let state: BillingState = { ...UNCONFIGURED_BILLING_STATE };
  let purchases: PurchasesClientLike | null = null;
  let initialized = false;
  let initializing: Promise<BillingState> | null = null;
  let lifetimePackage: PackageLike | null = null;
  let customerInfoListener: ((customerInfo: CustomerInfoLike) => void) | null = null;
  const subscribers = new Set<(state: BillingState) => void>();

  function notify(): void {
    const snapshot = { ...state };
    subscribers.forEach((subscriber) => subscriber(snapshot));
  }

  async function setFreshCustomerInfo(customerInfo: CustomerInfoLike): Promise<BillingState> {
    const entitlement = entitlementFromCustomerInfo(customerInfo);
    const refreshedAt = now();

    state = {
      ...state,
      billingStatus: 'ready',
      entitlementStatus: entitlement.kind === 'pro_lifetime' ? 'pro' : 'free',
      entitlement,
      entitlementSource: 'revenuecat',
      proActive: entitlement.kind === 'pro_lifetime',
      lastSuccessfulEntitlementRefreshAt: refreshedAt,
      error: null,
    };

    await saveBillingEntitlementCache({
      version: 1,
      entitlement,
      verifiedAt: refreshedAt,
      source: 'revenuecat',
    });
    notify();
    return state;
  }

  async function setCachedEntitlement(): Promise<BillingState> {
    const cache = await loadBillingEntitlementCache();
    if (!cache) return state;

    const cachedEntitlement = entitlementForBuild({
      storedEntitlement: cache.entitlement,
      isProduction: !isDevelopment,
    });
    const cachedPro = cachedEntitlement.kind === 'pro_lifetime';

    state = {
      ...state,
      entitlement: FREE_ENTITLEMENT,
      entitlementStatus: cachedPro ? 'cached_pro' : 'free',
      entitlementSource: 'cached_revenuecat',
      proActive: false,
      lastSuccessfulEntitlementRefreshAt: cache.verifiedAt,
    };
    notify();
    return state;
  }

  async function ensureInitialized(): Promise<BillingState> {
    if (initialized) return state;
    if (initializing) return initializing;

    initializing = (async () => {
      if (platformOS !== 'android') {
        state = {
          ...UNCONFIGURED_BILLING_STATE,
          billingStatus: 'unavailable',
          entitlementSource: 'unavailable',
          error: translate('pro.billingAndroidOnly'),
        };
        notify();
        initialized = true;
        return state;
      }

      if (!apiKey) {
        state = {
          ...UNCONFIGURED_BILLING_STATE,
          error: translate('pro.apiKeyMissing'),
        };
        if (isDevelopment) {
          console.warn('AirAware: EXPO_PUBLIC_REVENUECAT_API_KEY is not configured.');
        }
        notify();
        initialized = true;
        return state;
      }

      state = {
        ...state,
        billingStatus: 'initializing',
        entitlementStatus: 'loading',
        error: null,
      };
      notify();

      try {
        const module = await loadPurchasesModule();
        purchases = module.default ?? null;

        if (!purchases) {
          throw new Error('RevenueCat Purchases module is unavailable.');
        }

        installRevenueCatLogHandler(purchases, isDevelopment);

        if (isDevelopment && module.LOG_LEVEL?.VERBOSE !== undefined) {
          purchases.setLogLevel?.(module.LOG_LEVEL.VERBOSE);
        }

        purchases.configure({ apiKey });
        initialized = true;

        if (purchases.addCustomerInfoUpdateListener) {
          customerInfoListener = (customerInfo) => {
            void setFreshCustomerInfo(customerInfo).catch((error) =>
              console.warn('AirAware: RevenueCat listener update failed', error),
            );
          };
          purchases.addCustomerInfoUpdateListener(customerInfoListener);
        }

        await setFreshCustomerInfo(await purchases.getCustomerInfo());
        await loadProOffering();
        return state;
      } catch (error) {
        console.warn('AirAware: RevenueCat initialization failed', error);
        initialized = true;
        state = {
          ...state,
          billingStatus: userSafeError(error),
          entitlementStatus: 'unknown',
          entitlement: FREE_ENTITLEMENT,
          entitlementSource: 'unknown',
          proActive: false,
          error: translate('pro.purchaseUnavailable'),
        };
        await setCachedEntitlement();
        notify();
        return state;
      } finally {
        initializing = null;
      }
    })();

    return initializing;
  }

  async function loadProOffering(): Promise<ProOffering | null> {
    await ensureInitialized();

    if (!purchases) {
      return state.offering;
    }

    try {
      const offerings = await purchases.getOfferings();
      lifetimePackage =
        offerings.current?.availablePackages?.find(
          (pkg) => pkg.identifier === REVENUECAT_LIFETIME_PACKAGE_ID,
        ) ?? null;
      state = {
        ...state,
        offering: normalizePackage(lifetimePackage) ?? unavailableLifetimePackage(),
        error: null,
      };
      notify();
      return state.offering;
    } catch (error) {
      console.warn('AirAware: RevenueCat offering load failed', error);
      state = {
        ...state,
        offering: unavailableLifetimePackage(),
        error: translate('pro.purchaseInfoUnavailable'),
      };
      notify();
      return state.offering;
    }
  }

  return {
    initializeBilling: ensureInitialized,

    getBillingState: () => ({ ...state }),

    currentEntitlement: async () => {
      await ensureInitialized();
      return state.entitlement;
    },

    loadProOffering,

    purchaseProLifetime: async () => {
      await ensureInitialized();

      if (!purchases || state.billingStatus !== 'ready') {
        return {
          billingState: state,
          message: translate('pro.purchaseUnavailable'),
        };
      }

      if (state.purchaseInProgress) {
        return { billingState: state, message: null };
      }

      if (!lifetimePackage) {
        await loadProOffering();
      }

      if (!lifetimePackage) {
        return {
          billingState: state,
          message: translate('pro.purchaseInfoUnavailable'),
        };
      }

      state = { ...state, purchaseInProgress: true, error: null };
      notify();

      try {
        const customerInfo = customerInfoFromPurchaseResult(
          await purchases.purchasePackage(lifetimePackage),
        );
        if (customerInfo) {
          await setFreshCustomerInfo(customerInfo);
        }

        state = { ...state, purchaseInProgress: false };
        notify();

        if (state.entitlement.kind === 'pro_lifetime') {
          return { billingState: state, message: translate('pro.unlocked') };
        }

        return {
          billingState: state,
          message: translate('pro.purchasePending'),
        };
      } catch (error) {
        state = { ...state, purchaseInProgress: false };
        if (isCancelledPurchase(error)) {
          notify();
          return { billingState: state, message: null, cancelled: true };
        }

        if (isPendingPurchase(error)) {
          state = {
            ...state,
            error: translate('pro.purchasePending'),
          };
          notify();
          return {
            billingState: state,
            message: translate('pro.purchasePending'),
            pending: true,
          };
        }

        console.warn('AirAware: RevenueCat purchase failed', error);
        state = {
          ...state,
          error: translate('pro.unlockFailed'),
        };
        notify();
        return {
          billingState: state,
          message: translate('pro.unlockFailed'),
        };
      }
    },

    restorePurchases: async () => {
      await ensureInitialized();

      if (!purchases || state.billingStatus !== 'ready') {
        return {
          billingState: state,
          message: translate('pro.restoreFailed'),
        };
      }

      if (state.restoreInProgress) {
        return { billingState: state, message: null };
      }

      state = { ...state, restoreInProgress: true, error: null };
      notify();

      try {
        await setFreshCustomerInfo(await purchases.restorePurchases());
        state = { ...state, restoreInProgress: false };
        notify();

        return {
          billingState: state,
          message:
            state.entitlement.kind === 'pro_lifetime'
              ? translate('pro.restored')
              : translate('pro.noPurchaseFound'),
        };
      } catch (error) {
        console.warn('AirAware: RevenueCat restore failed', error);
        state = {
          ...state,
          restoreInProgress: false,
          error: translate('pro.restoreFailed'),
        };
        notify();
        return {
          billingState: state,
          message: translate('pro.restoreFailed'),
        };
      }
    },

    refreshEntitlement: async () => {
      await ensureInitialized();

      if (!purchases && apiKey && platformOS === 'android') {
        initialized = false;
        return ensureInitialized();
      }

      if (!purchases) {
        return state;
      }

      try {
        return await setFreshCustomerInfo(await purchases.getCustomerInfo());
      } catch (error) {
        console.warn('AirAware: RevenueCat entitlement refresh failed', error);
        if (state.entitlementSource === 'revenuecat') {
          state = {
            ...state,
            billingStatus: userSafeError(error),
            error: translate('pro.entitlementRefreshUnavailable'),
          };
          notify();
          return state;
        }

        await setCachedEntitlement();
        return state;
      }
    },

    subscribeToEntitlementChanges: (listener) => {
      subscribers.add(listener);
      return () => {
        subscribers.delete(listener);
      };
    },

    dispose: () => {
      if (purchases?.removeCustomerInfoUpdateListener && customerInfoListener) {
        purchases.removeCustomerInfoUpdateListener(customerInfoListener);
      }
      customerInfoListener = null;
      subscribers.clear();
    },
  };
}

import AsyncStorage from '@react-native-async-storage/async-storage';
import { FREE_ENTITLEMENT, PRO_LIFETIME_ENTITLEMENT } from '../src/capabilities/entitlements';
import { createBillingGateway } from '../src/services/billingGateway';
import {
  saveBillingEntitlementCache,
  loadDevelopmentEntitlementOverride,
  saveDevelopmentEntitlementOverride,
} from '../src/storage/storage';

function customerInfo(activeEntitlements: Record<string, unknown> = {}) {
  return {
    entitlements: {
      active: activeEntitlements,
    },
  };
}

function purchasesMock(overrides: Partial<Record<string, jest.Mock>> = {}) {
  const lifetimePackage = {
    identifier: 'lifetime',
    product: {
      identifier: 'airaware_pro_lifetime',
      title: 'AirAware Pro',
      description: 'Lifetime unlock',
      priceString: '$4.99',
      currencyCode: 'USD',
      price: 4.99,
    },
  };
  const otherPackage = {
    identifier: 'other',
    product: {
      identifier: 'other',
      priceString: '$0.99',
    },
  };

  return {
    lifetimePackage,
    module: {
      LOG_LEVEL: {
        VERBOSE: 'verbose',
      },
      default: {
        configure: jest.fn(),
        setLogLevel: jest.fn(),
        setLogHandler: jest.fn(),
        getCustomerInfo: jest.fn().mockResolvedValue(customerInfo()),
        getOfferings: jest.fn().mockResolvedValue({
          current: {
            availablePackages: [otherPackage, lifetimePackage],
          },
        }),
        purchasePackage: jest.fn().mockResolvedValue({
          customerInfo: customerInfo({ pro: { identifier: 'pro' } }),
        }),
        restorePurchases: jest.fn().mockResolvedValue(customerInfo({ pro: { identifier: 'pro' } })),
        addCustomerInfoUpdateListener: jest.fn(),
        removeCustomerInfoUpdateListener: jest.fn(),
        ...overrides,
      },
    },
  };
}

describe('RevenueCat billing gateway boundary', () => {
  let warnSpy: jest.SpyInstance;

  beforeEach(async () => {
    await AsyncStorage.clear();
    warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => {
    warnSpy.mockRestore();
  });

  it('stays Free and unconfigured when the public SDK key is missing', async () => {
    const billing = createBillingGateway({
      apiKey: '',
      platformOS: 'android',
      isDevelopment: false,
      loadPurchasesModule: async () => purchasesMock().module,
    });

    const state = await billing.initializeBilling();

    expect(state.billingStatus).toBe('unconfigured');
    expect(state.entitlement).toEqual(FREE_ENTITLEMENT);
    expect(state.proActive).toBe(false);
  });

  it('configures RevenueCat once and maps missing pro entitlement to Free', async () => {
    const mock = purchasesMock();
    const billing = createBillingGateway({
      apiKey: 'test_public_sdk_key',
      platformOS: 'android',
      loadPurchasesModule: async () => mock.module,
      now: () => '2026-08-03T10:00:00.000Z',
    });

    await expect(billing.currentEntitlement()).resolves.toEqual(FREE_ENTITLEMENT);
    await billing.initializeBilling();

    expect(mock.module.default.configure).toHaveBeenCalledTimes(1);
    expect(mock.module.default.configure).toHaveBeenCalledWith({ apiKey: 'test_public_sdk_key' });
    expect(mock.module.default.setLogHandler).toHaveBeenCalledTimes(1);
    const logHandlerCallOrder = mock.module.default.setLogHandler.mock.invocationCallOrder[0];
    const configureCallOrder = mock.module.default.configure.mock.invocationCallOrder[0];
    expect(logHandlerCallOrder).toBeDefined();
    expect(configureCallOrder).toBeDefined();
    expect(logHandlerCallOrder ?? 0).toBeLessThan(configureCallOrder ?? 0);
    expect(mock.module.default.setLogLevel).toHaveBeenCalledWith('verbose');
    expect(billing.getBillingState()).toMatchObject({
      billingStatus: 'ready',
      entitlementStatus: 'free',
      proActive: false,
    });
  });

  it('does not enable verbose RevenueCat logging outside development', async () => {
    const mock = purchasesMock();
    const billing = createBillingGateway({
      apiKey: 'test_public_sdk_key',
      platformOS: 'android',
      isDevelopment: false,
      loadPurchasesModule: async () => mock.module,
    });

    await billing.initializeBilling();

    expect(mock.module.default.setLogLevel).not.toHaveBeenCalled();
  });

  it('suppresses the benign RevenueCat Paywalls ui_config error in development', async () => {
    const mock = purchasesMock();
    const billing = createBillingGateway({
      apiKey: 'test_public_sdk_key',
      platformOS: 'android',
      isDevelopment: true,
      loadPurchasesModule: async () => mock.module,
    });

    await billing.initializeBilling();
    const handler = mock.module.default.setLogHandler.mock.calls[0][0] as (
      logLevel: unknown,
      message: string,
    ) => void;
    handler(
      'ERROR',
      'Failed to ready ui_config before getOfferings; proceeding without it.. Throwable: java.lang.IllegalStateException: Required value was null.',
    );

    expect(warnSpy).not.toHaveBeenCalledWith(
      expect.stringContaining('Failed to ready ui_config before getOfferings'),
    );
  });

  it('keeps non-paywall RevenueCat warnings visible in development', async () => {
    const mock = purchasesMock();
    const billing = createBillingGateway({
      apiKey: 'test_public_sdk_key',
      platformOS: 'android',
      isDevelopment: true,
      loadPurchasesModule: async () => mock.module,
    });

    await billing.initializeBilling();
    const handler = mock.module.default.setLogHandler.mock.calls[0][0] as (
      logLevel: unknown,
      message: string,
    ) => void;
    handler('WARN', 'Offering could not be loaded.');

    expect(warnSpy).toHaveBeenCalledWith('[RevenueCat] Offering could not be loaded.');
  });

  it('classifies RevenueCat network and offline error codes as offline', async () => {
    const billing = createBillingGateway({
      apiKey: 'test_public_sdk_key',
      platformOS: 'android',
      isDevelopment: false,
      loadPurchasesModule: async () => {
        throw { code: '10' };
      },
    });

    const state = await billing.initializeBilling();

    expect(state.billingStatus).toBe('offline');
    expect(state.entitlement).toEqual(FREE_ENTITLEMENT);
    expect(state.proActive).toBe(false);
  });

  it('does not grant Pro capabilities from cached RevenueCat entitlement after refresh failure', async () => {
    await saveBillingEntitlementCache({
      version: 1,
      entitlement: PRO_LIFETIME_ENTITLEMENT,
      verifiedAt: '2026-08-03T10:00:00.000Z',
      source: 'revenuecat',
    });
    const billing = createBillingGateway({
      apiKey: 'test_public_sdk_key',
      platformOS: 'android',
      isDevelopment: false,
      loadPurchasesModule: async () => {
        throw { code: '35' };
      },
    });

    const state = await billing.initializeBilling();

    expect(state.billingStatus).toBe('offline');
    expect(state.entitlementStatus).toBe('cached_pro');
    expect(state.entitlement).toEqual(FREE_ENTITLEMENT);
    expect(state.entitlementSource).toBe('cached_revenuecat');
    expect(state.proActive).toBe(false);
  });

  it('maps active pro entitlement to Pro lifetime', async () => {
    const mock = purchasesMock({
      getCustomerInfo: jest.fn().mockResolvedValue(customerInfo({ pro: { identifier: 'pro' } })),
    });
    const billing = createBillingGateway({
      apiKey: 'test_public_sdk_key',
      platformOS: 'android',
      loadPurchasesModule: async () => mock.module,
    });

    await expect(billing.currentEntitlement()).resolves.toEqual(PRO_LIFETIME_ENTITLEMENT);
    expect(billing.getBillingState().proActive).toBe(true);
  });

  it('preserves a freshly verified Pro session after a transient entitlement refresh failure', async () => {
    const getCustomerInfo = jest
      .fn()
      .mockResolvedValueOnce(customerInfo({ pro: { identifier: 'pro' } }))
      .mockRejectedValueOnce({ code: '10' });
    const mock = purchasesMock({ getCustomerInfo });
    const billing = createBillingGateway({
      apiKey: 'test_public_sdk_key',
      platformOS: 'android',
      isDevelopment: false,
      loadPurchasesModule: async () => mock.module,
    });

    await billing.initializeBilling();
    const state = await billing.refreshEntitlement();

    expect(state.billingStatus).toBe('offline');
    expect(state.entitlement).toEqual(PRO_LIFETIME_ENTITLEMENT);
    expect(state.entitlementSource).toBe('revenuecat');
    expect(state.proActive).toBe(true);
  });

  it('does not grant Pro for unrelated active entitlements', async () => {
    const mock = purchasesMock({
      getCustomerInfo: jest
        .fn()
        .mockResolvedValue(customerInfo({ advanced: { identifier: 'advanced' } })),
    });
    const billing = createBillingGateway({
      apiKey: 'test_public_sdk_key',
      platformOS: 'android',
      loadPurchasesModule: async () => mock.module,
    });

    await expect(billing.currentEntitlement()).resolves.toEqual(FREE_ENTITLEMENT);
  });

  it('loads the lifetime package by stable package identifier and preserves localized price', async () => {
    const mock = purchasesMock();
    const billing = createBillingGateway({
      apiKey: 'test_public_sdk_key',
      platformOS: 'android',
      loadPurchasesModule: async () => mock.module,
    });

    const offering = await billing.loadProOffering();

    expect(offering).toMatchObject({
      packageIdentifier: 'lifetime',
      productIdentifier: 'airaware_pro_lifetime',
      priceString: '$4.99',
      currencyCode: 'USD',
      available: true,
    });
  });

  it('does not fake a price when the lifetime package is missing', async () => {
    const mock = purchasesMock({
      getOfferings: jest.fn().mockResolvedValue({
        current: {
          availablePackages: [{ identifier: 'other', product: { priceString: '$0.99' } }],
        },
      }),
    });
    const billing = createBillingGateway({
      apiKey: 'test_public_sdk_key',
      platformOS: 'android',
      loadPurchasesModule: async () => mock.module,
    });

    const offering = await billing.loadProOffering();

    expect(offering).toMatchObject({
      packageIdentifier: 'lifetime',
      priceString: null,
      available: false,
    });
  });

  it('grants Pro only after a purchase result contains active pro entitlement', async () => {
    const mock = purchasesMock();
    const billing = createBillingGateway({
      apiKey: 'test_public_sdk_key',
      platformOS: 'android',
      loadPurchasesModule: async () => mock.module,
    });

    const result = await billing.purchaseProLifetime();

    expect(mock.module.default.purchasePackage).toHaveBeenCalledWith(mock.lifetimePackage);
    expect(result.billingState.entitlement).toEqual(PRO_LIFETIME_ENTITLEMENT);
    expect(result.message).toBe('AirAware Pro unlocked.');
  });

  it('does not grant Pro when purchase callback lacks active pro entitlement', async () => {
    const mock = purchasesMock({
      purchasePackage: jest.fn().mockResolvedValue({ customerInfo: customerInfo() }),
    });
    const billing = createBillingGateway({
      apiKey: 'test_public_sdk_key',
      platformOS: 'android',
      loadPurchasesModule: async () => mock.module,
    });

    const result = await billing.purchaseProLifetime();

    expect(result.billingState.entitlement).toEqual(FREE_ENTITLEMENT);
    expect(result.message).toContain('pending');
  });

  it('handles purchase cancellation without an error message', async () => {
    const mock = purchasesMock({
      purchasePackage: jest.fn().mockRejectedValue({ userCancelled: true }),
    });
    const billing = createBillingGateway({
      apiKey: 'test_public_sdk_key',
      platformOS: 'android',
      loadPurchasesModule: async () => mock.module,
    });

    const result = await billing.purchaseProLifetime();

    expect(result.cancelled).toBe(true);
    expect(result.message).toBeNull();
    expect(result.billingState.entitlement).toEqual(FREE_ENTITLEMENT);
  });

  it('handles pending Google Play purchases without granting Pro or showing a failure', async () => {
    const mock = purchasesMock({
      purchasePackage: jest.fn().mockRejectedValue({ code: '20' }),
    });
    const billing = createBillingGateway({
      apiKey: 'test_public_sdk_key',
      platformOS: 'android',
      loadPurchasesModule: async () => mock.module,
    });

    const result = await billing.purchaseProLifetime();

    expect(result.pending).toBe(true);
    expect(result.message).toBe('AirAware Pro purchase is pending confirmation.');
    expect(result.billingState.entitlement).toEqual(FREE_ENTITLEMENT);
    expect(result.billingState.proActive).toBe(false);
  });

  it('restores Pro only when RevenueCat returns an active pro entitlement', async () => {
    const mock = purchasesMock();
    const billing = createBillingGateway({
      apiKey: 'test_public_sdk_key',
      platformOS: 'android',
      loadPurchasesModule: async () => mock.module,
    });

    const result = await billing.restorePurchases();

    expect(result.billingState.entitlement).toEqual(PRO_LIFETIME_ENTITLEMENT);
    expect(result.message).toBe('AirAware Pro restored.');
  });

  it('keeps development preview override separate from RevenueCat state', async () => {
    await saveDevelopmentEntitlementOverride(PRO_LIFETIME_ENTITLEMENT);
    expect(await loadDevelopmentEntitlementOverride()).toEqual(PRO_LIFETIME_ENTITLEMENT);

    await saveDevelopmentEntitlementOverride(null);
    expect(await loadDevelopmentEntitlementOverride()).toBeNull();
  });
});

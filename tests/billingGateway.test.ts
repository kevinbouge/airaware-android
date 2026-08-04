import AsyncStorage from '@react-native-async-storage/async-storage';
import { FREE_ENTITLEMENT, PRO_LIFETIME_ENTITLEMENT } from '../src/capabilities/entitlements';
import { createBillingGateway } from '../src/services/billingGateway';
import {
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
  beforeEach(async () => {
    await AsyncStorage.clear();
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

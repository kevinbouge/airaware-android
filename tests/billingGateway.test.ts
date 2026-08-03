import AsyncStorage from '@react-native-async-storage/async-storage';
import { FREE_ENTITLEMENT, PRO_LIFETIME_ENTITLEMENT } from '../src/capabilities/entitlements';
import { createBillingGateway } from '../src/services/billingGateway';
import { saveDevelopmentEntitlementOverride } from '../src/storage/storage';

describe('billing gateway boundary', () => {
  const devGlobal = globalThis as typeof globalThis & { __DEV__?: boolean };
  const originalDevFlag = devGlobal.__DEV__;

  function setDevFlag(value: boolean | undefined): void {
    if (value === undefined) {
      delete devGlobal.__DEV__;
      return;
    }

    devGlobal.__DEV__ = value;
  }

  afterEach(() => {
    setDevFlag(originalDevFlag);
  });

  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  it('is an isolated no-op boundary until billing is intentionally implemented', async () => {
    setDevFlag(false);
    const billing = createBillingGateway();

    expect(billing.status).toBe('not_configured');
    expect(billing.isAvailable()).toBe(false);
    await expect(billing.currentEntitlement()).resolves.toEqual(FREE_ENTITLEMENT);
  });

  it('defaults to Pro lifetime in development builds so Pro features can be tested locally', async () => {
    setDevFlag(true);
    const billing = createBillingGateway();

    expect(billing.status).toBe('not_configured');
    expect(billing.isAvailable()).toBe(false);
    await expect(billing.currentEntitlement()).resolves.toEqual(PRO_LIFETIME_ENTITLEMENT);
  });

  it('uses the persisted development entitlement override outside production', async () => {
    setDevFlag(true);
    await saveDevelopmentEntitlementOverride(FREE_ENTITLEMENT);
    const billing = createBillingGateway();

    await expect(billing.currentEntitlement()).resolves.toEqual(FREE_ENTITLEMENT);
  });

  it('ignores the development entitlement override in production builds', async () => {
    setDevFlag(true);
    await saveDevelopmentEntitlementOverride(PRO_LIFETIME_ENTITLEMENT);
    setDevFlag(false);
    const billing = createBillingGateway();

    await expect(billing.currentEntitlement()).resolves.toEqual(FREE_ENTITLEMENT);
  });
});

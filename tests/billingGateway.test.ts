import { FREE_ENTITLEMENT, PRO_LIFETIME_ENTITLEMENT } from '../src/capabilities/entitlements';
import { createBillingGateway } from '../src/services/billingGateway';

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

  it('is an isolated no-op boundary until billing is intentionally implemented', async () => {
    setDevFlag(false);
    const billing = createBillingGateway();

    expect(billing.status).toBe('not_configured');
    expect(billing.isAvailable()).toBe(false);
    await expect(billing.currentEntitlement()).resolves.toEqual(FREE_ENTITLEMENT);
  });

  it('uses Pro lifetime only in development builds so Pro features can be tested locally', async () => {
    setDevFlag(true);
    const billing = createBillingGateway();

    expect(billing.status).toBe('not_configured');
    expect(billing.isAvailable()).toBe(false);
    await expect(billing.currentEntitlement()).resolves.toEqual(PRO_LIFETIME_ENTITLEMENT);
  });
});

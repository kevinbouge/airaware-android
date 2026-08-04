import {
  FREE_ENTITLEMENT,
  PRO_LIFETIME_ENTITLEMENT,
  entitlementForBuild,
  normalizeEntitlement,
} from '../src/capabilities/entitlements';

describe('entitlements', () => {
  it('defaults invalid or missing entitlement data to Free', () => {
    expect(normalizeEntitlement(null)).toEqual(FREE_ENTITLEMENT);
    expect(normalizeEntitlement({ kind: 'trial' })).toEqual(FREE_ENTITLEMENT);
  });

  it('recognizes Pro lifetime entitlement', () => {
    expect(normalizeEntitlement({ kind: 'pro_lifetime' })).toEqual(PRO_LIFETIME_ENTITLEMENT);
  });

  it('does not allow a development override to affect production builds', () => {
    expect(
      entitlementForBuild({
        storedEntitlement: FREE_ENTITLEMENT,
        developmentOverride: PRO_LIFETIME_ENTITLEMENT,
        isProduction: true,
      }),
    ).toEqual(FREE_ENTITLEMENT);
  });

  it('allows a development override outside production for deterministic testing', () => {
    expect(
      entitlementForBuild({
        storedEntitlement: FREE_ENTITLEMENT,
        developmentOverride: PRO_LIFETIME_ENTITLEMENT,
        isProduction: false,
      }),
    ).toEqual(PRO_LIFETIME_ENTITLEMENT);
  });

  it('ignores null development override outside production', () => {
    expect(
      entitlementForBuild({
        storedEntitlement: FREE_ENTITLEMENT,
        developmentOverride: null,
        isProduction: false,
      }),
    ).toEqual(FREE_ENTITLEMENT);
  });
});

export type EntitlementKind = 'free' | 'pro_lifetime';

export interface EntitlementState {
  kind: EntitlementKind;
}

export const FREE_ENTITLEMENT: EntitlementState = { kind: 'free' };
export const PRO_LIFETIME_ENTITLEMENT: EntitlementState = { kind: 'pro_lifetime' };

export function normalizeEntitlement(value: unknown): EntitlementState {
  if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
    const kind = (value as Record<string, unknown>).kind;
    if (kind === 'pro_lifetime') return PRO_LIFETIME_ENTITLEMENT;
    if (kind === 'free') return FREE_ENTITLEMENT;
  }

  return FREE_ENTITLEMENT;
}

export function entitlementForBuild(input: {
  storedEntitlement?: unknown;
  developmentOverride?: unknown;
  isProduction: boolean;
}): EntitlementState {
  const stored = normalizeEntitlement(input.storedEntitlement);

  if (input.isProduction || input.developmentOverride === undefined) {
    return stored;
  }

  return normalizeEntitlement(input.developmentOverride);
}

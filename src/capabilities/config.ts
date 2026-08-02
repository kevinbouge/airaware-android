import type { AppCapabilities } from './types';
import type { EntitlementState } from './entitlements';

export const FORECAST_DAY_LIMITS = {
  free: 3,
  proLifetime: 4,
  providerRequest: 4,
} as const;

const BASE_CAPABILITIES = {
  forecast: {
    maxDays: FORECAST_DAY_LIMITS.free,
    defaultDays: FORECAST_DAY_LIMITS.free,
    configurable: false,
  },
  environmentalVariables: {
    availableGroups: ['standard'],
  },
  notifications: {
    availableGroups: ['basic_transition_notifications'],
  },
  locations: {
    automaticLocation: true,
    manualLocation: true,
    maxSavedLocations: 1,
  },
  history: {
    retentionDays: 0,
  },
  widgets: {
    availableWidgets: ['compact_home_widget'],
  },
  providers: {
    availableProviders: ['open-meteo'],
    defaultProvider: 'open-meteo',
  },
  sharing: {
    dailySummary: true,
    nativeShareSheet: true,
  },
} as const;

export const FREE_CAPABILITIES: AppCapabilities = BASE_CAPABILITIES;

export const PRO_LIFETIME_CAPABILITIES: AppCapabilities = {
  ...BASE_CAPABILITIES,
  forecast: {
    ...BASE_CAPABILITIES.forecast,
    maxDays: FORECAST_DAY_LIMITS.proLifetime,
    defaultDays: FORECAST_DAY_LIMITS.proLifetime,
  },
  environmentalVariables: {
    availableGroups: ['standard', 'extended'],
  },
  notifications: {
    availableGroups: ['basic_transition_notifications', 'advanced_environment_notifications'],
  },
  widgets: {
    availableWidgets: ['compact_home_widget', 'advanced_home_widget'],
  },
};

export function capabilitiesForEntitlement(entitlement: EntitlementState): AppCapabilities {
  return entitlement.kind === 'pro_lifetime' ? PRO_LIFETIME_CAPABILITIES : FREE_CAPABILITIES;
}

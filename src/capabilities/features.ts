import { FORECAST_DAY_LIMITS } from './config';
import { forecastDayLimit } from './forecast';
import type {
  AppCapabilities,
  FeatureDefinition,
  FeatureId,
  NotificationCapabilityId,
} from './types';

function hasNotificationCapability(
  capabilities: AppCapabilities,
  capability: NotificationCapabilityId,
): boolean {
  return capabilities.notifications.availableGroups.includes(capability);
}

export function featureDefinitions(capabilities: AppCapabilities): FeatureDefinition[] {
  return [
    {
      id: 'environmental_burden',
      displayName: 'Environmental burden',
      category: 'environmentalVariables',
      available: true,
    },
    {
      id: 'personalized_risk',
      displayName: 'Personalized risk',
      category: 'environmentalVariables',
      available: true,
    },
    {
      id: 'current_readings',
      displayName: 'Current readings',
      category: 'environmentalVariables',
      available: capabilities.environmentalVariables.availableGroups.length > 0,
    },
    {
      id: 'forecast',
      displayName: 'Forecast',
      category: 'forecast',
      available: capabilities.forecast.defaultDays > 0 && capabilities.forecast.maxDays > 0,
    },
    {
      id: 'extended_forecast',
      displayName: 'Extended forecast',
      category: 'forecast',
      available: forecastDayLimit(capabilities) > FORECAST_DAY_LIMITS.free,
      requiredEntitlement: 'pro_lifetime',
      freeBehavior: 'Today plus 2 additional days',
      proBehavior: 'Today plus 3 additional days',
    },
    {
      id: 'extended_environmental_data',
      displayName: 'Extended Environmental Data',
      category: 'environmentalVariables',
      available: capabilities.environmentalVariables.availableGroups.includes('extended'),
      requiredEntitlement: 'pro_lifetime',
      freeBehavior: 'Standard Environmental Data',
      proBehavior: 'Additional atmospheric and weather measurements',
      description: 'Informational measurements for advanced users. These do not affect scores.',
    },
    {
      id: 'best_outdoor_window',
      displayName: 'Best outdoor window',
      category: 'forecast',
      available: capabilities.forecast.defaultDays > 0,
    },
    {
      id: 'automatic_location',
      displayName: 'Automatic location',
      category: 'locations',
      available: capabilities.locations.automaticLocation,
    },
    {
      id: 'manual_location',
      displayName: 'Manual location',
      category: 'locations',
      available: capabilities.locations.manualLocation,
    },
    {
      id: 'daily_summary',
      displayName: 'Daily summary',
      category: 'sharing',
      available: capabilities.sharing.dailySummary && capabilities.sharing.nativeShareSheet,
    },
    {
      id: 'basic_transition_notifications',
      displayName: 'Risk transition notifications',
      category: 'notifications',
      available: hasNotificationCapability(capabilities, 'basic_transition_notifications'),
      freeBehavior: 'Active headline score transition notifications',
      proBehavior: 'Active headline score transition notifications',
      description: 'Notifies when the selected headline score enters a configured high category.',
    },
    {
      id: 'advanced_environment_notifications',
      displayName: 'Advanced environmental notifications',
      category: 'notifications',
      available: hasNotificationCapability(capabilities, 'advanced_environment_notifications'),
      requiredEntitlement: 'pro_lifetime',
      freeBehavior: 'Not included',
      proBehavior: 'Available for future advanced environmental alerts',
      description: 'Prepared capability only. No advanced alert types are implemented yet.',
    },
  ];
}

export function isFeatureAvailable(capabilities: AppCapabilities, featureId: FeatureId): boolean {
  return featureDefinitions(capabilities).some(
    (feature) => feature.id === featureId && feature.available,
  );
}

export function featureStatusMessage(feature: FeatureDefinition): string {
  if (feature.id === 'extended_environmental_data') {
    if (feature.available) {
      return `AirAware Pro active. ${feature.displayName} enabled.`;
    }

    return `${feature.displayName}: available with AirAware Pro. AirAware Pro purchasing is not available in this build.`;
  }

  if (feature.id !== 'extended_forecast') {
    return feature.available
      ? `${feature.displayName} enabled.`
      : `${feature.displayName} unavailable.`;
  }

  if (feature.available) {
    return `AirAware Pro active. ${feature.displayName} enabled: ${feature.proBehavior}.`;
  }

  return `${feature.displayName}: ${feature.freeBehavior}. AirAware Pro adds ${feature.proBehavior}. AirAware Pro purchasing is not available in this build.`;
}

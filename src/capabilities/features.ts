import { FORECAST_DAY_LIMITS } from './config';
import { forecastDayLimit } from './forecast';
import type {
  AppCapabilities,
  FeatureDefinition,
  FeatureId,
  NotificationCapabilityId,
  WidgetCapabilityId,
} from './types';

function hasNotificationCapability(
  capabilities: AppCapabilities,
  capability: NotificationCapabilityId,
): boolean {
  return capabilities.notifications.availableGroups.includes(capability);
}

function hasWidgetCapability(
  capabilities: AppCapabilities,
  capability: WidgetCapabilityId,
): boolean {
  return capabilities.widgets.availableWidgets.includes(capability);
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
      displayName: 'Extended Forecast',
      category: 'forecast',
      available: forecastDayLimit(capabilities) > FORECAST_DAY_LIMITS.free,
      requiredEntitlement: 'pro_lifetime',
      freeBehavior: 'Today plus 2 additional days',
      proBehavior: 'Today plus 6 additional days',
      description: 'Plan up to seven days with environmental and personalized forecast summaries.',
    },
    {
      id: 'activities',
      displayName: 'Professional Activities',
      category: 'activities',
      available: capabilities.activities.available,
      requiredEntitlement: 'pro_lifetime',
      freeBehavior: 'Activity catalog visible but locked',
      proBehavior:
        'Activity profiles for photography, astronomy, farming, drone flying, outdoor sports, and outdoor work',
      description:
        'Professional activity-specific environmental intelligence using relevant forecast variables.',
    },
    {
      id: 'nearby_vegetation',
      displayName: 'Nearby vegetation',
      category: 'environmentalVariables',
      available: true,
      freeBehavior: 'OpenStreetMap vegetation and land-use context',
      proBehavior: 'OpenStreetMap vegetation and land-use context',
      description: 'Contextual map data only. This does not affect scores.',
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
      id: 'compact_home_widget',
      displayName: 'Compact home-screen widget',
      category: 'widgets',
      available: hasWidgetCapability(capabilities, 'compact_home_widget'),
      freeBehavior: 'Current score and main factor',
      proBehavior: 'Current score and main factor',
      description: 'Small Android widget using the latest locally cached AirAware snapshot.',
    },
    {
      id: 'advanced_home_widget',
      displayName: 'Advanced home-screen widget',
      category: 'widgets',
      available: hasWidgetCapability(capabilities, 'advanced_home_widget'),
      requiredEntitlement: 'pro_lifetime',
      freeBehavior: 'Locked informational state',
      proBehavior: 'Current score, best outdoor window, and forecast summaries',
      description: 'Richer Android widget using the active forecast capability.',
    },
    {
      id: 'basic_transition_notifications',
      displayName: 'Risk transition notifications',
      category: 'notifications',
      available: hasNotificationCapability(capabilities, 'basic_transition_notifications'),
      freeBehavior: 'Active headline score transition notifications',
      proBehavior: 'Active headline score transition notifications',
      description: 'Notifies when the active headline score enters a configured high category.',
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
  if (feature.id === 'activities') {
    if (feature.available) {
      return `AirAware Pro active. ${feature.displayName} enabled.`;
    }

    return `${feature.displayName}: available with AirAware Pro.`;
  }

  if (feature.id === 'advanced_home_widget') {
    if (feature.available) {
      return `AirAware Pro active. ${feature.displayName} enabled.`;
    }

    return `${feature.displayName}: available with AirAware Pro.`;
  }

  if (feature.id !== 'extended_forecast') {
    return feature.available
      ? `${feature.displayName} enabled.`
      : `${feature.displayName} unavailable.`;
  }

  if (feature.available) {
    return `AirAware Pro active. ${feature.displayName} enabled: ${feature.proBehavior}.`;
  }

  return `${feature.displayName}: ${feature.freeBehavior}. AirAware Pro adds ${feature.proBehavior}.`;
}

import type {
  AtmosphericIrritants,
  PollenReadings,
  RegulatedPollutants,
} from '../models/environment';
import type { EntitlementKind } from './entitlements';
import type { ProfileFactorId } from '../models/profile';

type CapabilityCategory =
  | 'forecast'
  | 'environmentalVariables'
  | 'notifications'
  | 'locations'
  | 'widgets'
  | 'history'
  | 'providers'
  | 'sharing';

type EnvironmentalVariableGroupId = 'standard' | 'extended';
export type NotificationCapabilityId =
  'basic_transition_notifications' | 'advanced_environment_notifications';
export type WidgetCapabilityId = 'compact_home_widget' | 'advanced_home_widget';

export type ProviderId = 'open-meteo';

type PollenVariableId = `pollen_${keyof PollenReadings}`;
type RegulatedPollutantVariableId = keyof RegulatedPollutants;
type AtmosphericIrritantVariableId = keyof AtmosphericIrritants;
export type ExtendedEnvironmentalVariableId =
  | 'carbonDioxide'
  | 'ammonia'
  | 'methane'
  | 'nitrogenMonoxide'
  | 'formaldehyde'
  | 'nonMethaneVolatileOrganicCompounds'
  | 'pressureMsl'
  | 'surfacePressure'
  | 'extendedVisibility'
  | 'cloudCover'
  | 'cloudCoverLow'
  | 'cloudCoverMid'
  | 'cloudCoverHigh'
  | 'extendedDewPoint'
  | 'wetBulbTemperature'
  | 'extendedWindGusts'
  | 'shortwaveRadiation'
  | 'directNormalIrradiance'
  | 'diffuseRadiation'
  | 'sunshineDuration'
  | 'cape';
export type EnvironmentalVariableId =
  | PollenVariableId
  | RegulatedPollutantVariableId
  | AtmosphericIrritantVariableId
  | ExtendedEnvironmentalVariableId
  | 'moldPotential'
  | 'uvIndex';

export type FeatureId =
  | 'environmental_burden'
  | 'personalized_risk'
  | 'current_readings'
  | 'forecast'
  | 'extended_forecast'
  | 'extended_environmental_data'
  | 'best_outdoor_window'
  | 'automatic_location'
  | 'manual_location'
  | 'daily_summary'
  | WidgetCapabilityId
  | NotificationCapabilityId;

interface ForecastCapability {
  maxDays: number;
  defaultDays: number;
  configurable: boolean;
}

interface EnvironmentalVariableCapability {
  availableGroups: readonly EnvironmentalVariableGroupId[];
}

interface NotificationCapability {
  availableGroups: readonly NotificationCapabilityId[];
}

interface LocationCapability {
  automaticLocation: boolean;
  manualLocation: boolean;
  maxSavedLocations: number;
}

interface HistoryCapability {
  retentionDays: number;
}

interface WidgetCapability {
  availableWidgets: readonly WidgetCapabilityId[];
}

interface ProviderCapability {
  availableProviders: readonly ProviderId[];
  defaultProvider: ProviderId;
}

interface SharingCapability {
  dailySummary: boolean;
  nativeShareSheet: boolean;
}

export interface AppCapabilities {
  forecast: ForecastCapability;
  environmentalVariables: EnvironmentalVariableCapability;
  notifications: NotificationCapability;
  locations: LocationCapability;
  history: HistoryCapability;
  widgets: WidgetCapability;
  providers: ProviderCapability;
  sharing: SharingCapability;
}

export interface FeatureDefinition {
  id: FeatureId;
  displayName: string;
  category: CapabilityCategory;
  available: boolean;
  requiredEntitlement?: EntitlementKind;
  freeBehavior?: string;
  proBehavior?: string;
  description?: string;
}

export interface EnvironmentalVariableDefinition {
  id: EnvironmentalVariableId;
  displayName: string;
  group: EnvironmentalVariableGroupId;
  profileFactorId?: ProfileFactorId;
}

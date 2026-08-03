import type { NormalizedEnvironment } from '../models/environment';
import type { AppCapabilities } from '../capabilities/types';
import type { EntitlementState } from '../capabilities/entitlements';
import type { AppSettings } from '../models/profile';
import { forecastDayLimit } from '../capabilities/forecast';
import { isFeatureAvailable } from '../capabilities/features';

function hasExtendedCurrentReadings(environment: NormalizedEnvironment): boolean {
  const extended = environment.current.extended;

  if (!extended) return false;

  return [...Object.values(extended.airQuality), ...Object.values(extended.weather)].some(
    (value) => typeof value === 'number' && Number.isFinite(value),
  );
}

export function shouldRefreshAfterHydration(input: {
  hydrated: boolean;
  environment: NormalizedEnvironment | null;
  locationOnboardingComplete: boolean;
  capabilities?: AppCapabilities;
  extendedRefreshAttempted?: boolean;
}): boolean {
  if (!input.hydrated || !input.locationOnboardingComplete) return false;
  if (!input.environment) return true;
  if (!input.capabilities) return false;

  return (
    input.environment.forecastDays.length < forecastDayLimit(input.capabilities) ||
    (isFeatureAvailable(input.capabilities, 'extended_environmental_data') &&
      input.extendedRefreshAttempted !== true &&
      !hasExtendedCurrentReadings(input.environment))
  );
}

export function shouldRunScheduledRefresh(input: {
  hydrated: boolean;
  locationOnboardingComplete: boolean;
}): boolean {
  return input.hydrated && input.locationOnboardingComplete;
}

export function shouldRefreshAfterEntitlementChange(input: {
  previousEntitlement: EntitlementState;
  nextEntitlement: EntitlementState;
  locationOnboardingComplete: boolean;
}): boolean {
  return (
    input.locationOnboardingComplete &&
    input.previousEntitlement.kind !== input.nextEntitlement.kind
  );
}

export function shouldRefreshAfterLocationSettingsChange(input: {
  previousSettings: AppSettings;
  nextSettings: AppSettings;
}): boolean {
  if (!input.nextSettings.locationOnboardingComplete) return false;

  const locationModeChanged =
    input.previousSettings.locationMode !== input.nextSettings.locationMode;
  const activeManualCoordinatesChanged =
    input.nextSettings.locationMode === 'manual' &&
    (input.previousSettings.manualLatitude !== input.nextSettings.manualLatitude ||
      input.previousSettings.manualLongitude !== input.nextSettings.manualLongitude);

  return locationModeChanged || activeManualCoordinatesChanged;
}

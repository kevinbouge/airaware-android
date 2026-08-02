import type { NormalizedEnvironment } from '../models/environment';
import type { AppCapabilities } from '../capabilities/types';
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

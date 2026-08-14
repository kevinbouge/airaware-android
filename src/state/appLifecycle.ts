import type { AppSettings } from '../models/profile';

export function shouldRefreshAfterHydration(input: {
  hydrated: boolean;
  locationOnboardingComplete: boolean;
}): boolean {
  return input.hydrated && input.locationOnboardingComplete;
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

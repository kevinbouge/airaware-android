import type { NormalizedEnvironment } from '../models/environment';

export function shouldRefreshAfterHydration(input: {
  hydrated: boolean;
  environment: NormalizedEnvironment | null;
  locationOnboardingComplete: boolean;
}): boolean {
  return input.hydrated && !input.environment && input.locationOnboardingComplete;
}

export function shouldRunScheduledRefresh(input: {
  hydrated: boolean;
  locationOnboardingComplete: boolean;
}): boolean {
  return input.hydrated && input.locationOnboardingComplete;
}

export function shouldRefreshAfterHydration(input: {
  hydrated: boolean;
  locationOnboardingComplete: boolean;
}): boolean {
  return input.hydrated && input.locationOnboardingComplete;
}

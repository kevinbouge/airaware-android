import { shouldRefreshAfterHydration, shouldRunScheduledRefresh } from '../src/state/appLifecycle';

describe('app lifecycle refresh policy', () => {
  it('does not refresh before the location explanation has been accepted', () => {
    expect(
      shouldRefreshAfterHydration({
        hydrated: true,
        environment: null,
        locationOnboardingComplete: false,
      }),
    ).toBe(false);
  });

  it('refreshes empty state only after onboarding is complete', () => {
    expect(
      shouldRefreshAfterHydration({
        hydrated: true,
        environment: null,
        locationOnboardingComplete: true,
      }),
    ).toBe(true);
  });

  it('does not start scheduled refresh before onboarding is complete', () => {
    expect(
      shouldRunScheduledRefresh({
        hydrated: true,
        locationOnboardingComplete: false,
      }),
    ).toBe(false);
  });

  it('starts scheduled refresh after onboarding is complete', () => {
    expect(
      shouldRunScheduledRefresh({
        hydrated: true,
        locationOnboardingComplete: true,
      }),
    ).toBe(true);
  });
});

import { shouldRefreshAfterHydration } from '../src/state/appLifecycle';

describe('app lifecycle refresh policy', () => {
  it('does not refresh before the location explanation has been accepted', () => {
    expect(
      shouldRefreshAfterHydration({
        hydrated: true,
        locationOnboardingComplete: false,
      }),
    ).toBe(false);
  });

  it('refreshes empty state only after onboarding is complete', () => {
    expect(
      shouldRefreshAfterHydration({
        hydrated: true,
        locationOnboardingComplete: true,
      }),
    ).toBe(true);
  });
});

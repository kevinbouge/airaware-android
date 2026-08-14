import {
  shouldRefreshAfterHydration,
  shouldRefreshAfterLocationSettingsChange,
} from '../src/state/appLifecycle';
import { DEFAULT_SETTINGS } from '../src/models/profile';

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

  it('runs the centralized freshness check after hydrated launch with cached data', () => {
    expect(
      shouldRefreshAfterHydration({
        hydrated: true,
        locationOnboardingComplete: true,
      }),
    ).toBe(true);
  });

  it('refreshes after changing the active location mode or manual coordinates', () => {
    const manualSettings = {
      ...DEFAULT_SETTINGS,
      locationOnboardingComplete: true,
      locationMode: 'manual' as const,
      manualLatitude: '50.07550',
      manualLongitude: '14.43780',
    };
    const automaticSettings = {
      ...manualSettings,
      locationMode: 'automatic' as const,
    };

    expect(
      shouldRefreshAfterLocationSettingsChange({
        previousSettings: manualSettings,
        nextSettings: automaticSettings,
      }),
    ).toBe(true);
    expect(
      shouldRefreshAfterLocationSettingsChange({
        previousSettings: automaticSettings,
        nextSettings: manualSettings,
      }),
    ).toBe(true);
    expect(
      shouldRefreshAfterLocationSettingsChange({
        previousSettings: manualSettings,
        nextSettings: { ...manualSettings, manualLatitude: '49.19510' },
      }),
    ).toBe(true);
  });

  it('does not refresh for inactive manual coordinates, unrelated settings, or before onboarding', () => {
    const automaticSettings = {
      ...DEFAULT_SETTINGS,
      locationOnboardingComplete: true,
      locationMode: 'automatic' as const,
      manualLatitude: '50.07550',
      manualLongitude: '14.43780',
    };

    expect(
      shouldRefreshAfterLocationSettingsChange({
        previousSettings: automaticSettings,
        nextSettings: { ...automaticSettings, manualLatitude: '49.19510' },
      }),
    ).toBe(false);
    expect(
      shouldRefreshAfterLocationSettingsChange({
        previousSettings: automaticSettings,
        nextSettings: { ...automaticSettings, summaryLocation: 'hidden' },
      }),
    ).toBe(false);
    expect(
      shouldRefreshAfterLocationSettingsChange({
        previousSettings: { ...automaticSettings, locationOnboardingComplete: false },
        nextSettings: { ...automaticSettings, locationOnboardingComplete: false },
      }),
    ).toBe(false);
  });
});

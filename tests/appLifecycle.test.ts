import {
  shouldRefreshAfterHydration,
  shouldRefreshAfterLocationSettingsChange,
  shouldRunScheduledRefresh,
} from '../src/state/appLifecycle';
import { FREE_CAPABILITIES, PRO_LIFETIME_CAPABILITIES } from '../src/capabilities/config';
import { DEFAULT_SETTINGS } from '../src/models/profile';
import type { NormalizedEnvironment } from '../src/models/environment';

function environmentWithForecastDays(
  dayCount: number,
  hasExtendedData = true,
): NormalizedEnvironment {
  return {
    forecastDays: Array.from({ length: dayCount }, (_, index) => ({
      date: `2026-08-0${index + 1}`,
      label: `Day ${index + 1}`,
      score: null,
    })),
    current: {
      extended: {
        airQuality: {
          carbonDioxide: hasExtendedData ? 418 : null,
          ammonia: null,
          methane: null,
          nitrogenMonoxide: null,
          formaldehyde: null,
          nonMethaneVolatileOrganicCompounds: null,
        },
        weather: {
          pressureMsl: null,
          surfacePressure: null,
          visibility: null,
          cloudCover: null,
          cloudCoverLow: null,
          cloudCoverMid: null,
          cloudCoverHigh: null,
          dewPoint: null,
          wetBulbTemperature: null,
          windGusts: null,
          shortwaveRadiation: null,
          directNormalIrradiance: null,
          diffuseRadiation: null,
          sunshineDuration: null,
          cape: null,
        },
      },
    },
  } as NormalizedEnvironment;
}

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

  it('refreshes a cached forecast when the active capability needs more days', () => {
    expect(
      shouldRefreshAfterHydration({
        hydrated: true,
        environment: environmentWithForecastDays(3),
        locationOnboardingComplete: true,
        capabilities: PRO_LIFETIME_CAPABILITIES,
      }),
    ).toBe(true);
  });

  it('does not refresh a cached forecast that satisfies the active capability limit', () => {
    expect(
      shouldRefreshAfterHydration({
        hydrated: true,
        environment: environmentWithForecastDays(3),
        locationOnboardingComplete: true,
        capabilities: FREE_CAPABILITIES,
      }),
    ).toBe(false);
  });

  it('refreshes a Pro cache that predates extended current readings', () => {
    expect(
      shouldRefreshAfterHydration({
        hydrated: true,
        environment: environmentWithForecastDays(7, false),
        locationOnboardingComplete: true,
        capabilities: PRO_LIFETIME_CAPABILITIES,
      }),
    ).toBe(true);
  });

  it('does not repeatedly refresh a Pro cache when extended values remain unavailable', () => {
    expect(
      shouldRefreshAfterHydration({
        hydrated: true,
        environment: environmentWithForecastDays(7, false),
        locationOnboardingComplete: true,
        capabilities: PRO_LIFETIME_CAPABILITIES,
        extendedRefreshAttempted: true,
      }),
    ).toBe(false);
  });

  it('does not refresh a Free cache solely because extended readings are absent', () => {
    expect(
      shouldRefreshAfterHydration({
        hydrated: true,
        environment: environmentWithForecastDays(3, false),
        locationOnboardingComplete: true,
        capabilities: FREE_CAPABILITIES,
      }),
    ).toBe(false);
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
        nextSettings: { ...automaticSettings, refreshIntervalMinutes: 120 },
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

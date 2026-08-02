import {
  FORECAST_DAY_LIMITS,
  FREE_CAPABILITIES,
  PRO_LIFETIME_CAPABILITIES,
  capabilitiesForEntitlement,
} from '../src/capabilities/config';
import { FREE_ENTITLEMENT, PRO_LIFETIME_ENTITLEMENT } from '../src/capabilities/entitlements';
import {
  featureDefinitions,
  featureStatusMessage,
  isFeatureAvailable,
} from '../src/capabilities/features';
import {
  forecastDayLimit,
  forecastDaysForCapabilities,
  isForecastHorizonConfigurable,
} from '../src/capabilities/forecast';
import {
  availableEnvironmentalVariables,
  availableProfileFactorOptions,
  isEnvironmentalVariableAvailable,
  profileForCapabilities,
} from '../src/capabilities/variables';
import { DEFAULT_PROFILE } from '../src/models/profile';
import { activeEnvironmentalProvider } from '../src/services/environmentProviders';

describe('capabilities', () => {
  it('exposes every capability required by the current application', () => {
    expect(forecastDayLimit(FREE_CAPABILITIES)).toBe(FORECAST_DAY_LIMITS.free);
    expect(isForecastHorizonConfigurable(FREE_CAPABILITIES)).toBe(false);
    expect(isFeatureAvailable(FREE_CAPABILITIES, 'forecast')).toBe(true);
    expect(isFeatureAvailable(FREE_CAPABILITIES, 'extended_forecast')).toBe(false);
    expect(isFeatureAvailable(FREE_CAPABILITIES, 'manual_location')).toBe(true);
    expect(isFeatureAvailable(FREE_CAPABILITIES, 'daily_summary')).toBe(true);
    expect(isFeatureAvailable(FREE_CAPABILITIES, 'basic_transition_notifications')).toBe(true);
    expect(isFeatureAvailable(FREE_CAPABILITIES, 'advanced_environment_notifications')).toBe(false);
    expect(isFeatureAvailable(FREE_CAPABILITIES, 'extended_environmental_data')).toBe(false);
  });

  it('models Free and Pro lifetime forecast horizons centrally', () => {
    expect(forecastDayLimit(capabilitiesForEntitlement(FREE_ENTITLEMENT))).toBe(
      FORECAST_DAY_LIMITS.free,
    );
    expect(forecastDayLimit(capabilitiesForEntitlement(PRO_LIFETIME_ENTITLEMENT))).toBe(
      FORECAST_DAY_LIMITS.proLifetime,
    );
    expect(FORECAST_DAY_LIMITS.providerRequest).toBe(FORECAST_DAY_LIMITS.proLifetime);
  });

  it('limits visible forecast days without changing provider forecast calculations', () => {
    const providerDays = [
      { date: '2026-08-01', score: 10 },
      { date: '2026-08-02', score: 20 },
      { date: '2026-08-03', score: 30 },
      { date: '2026-08-04', score: 40 },
      { date: '2026-08-05', score: 50 },
    ];

    expect(forecastDaysForCapabilities(providerDays, FREE_CAPABILITIES)).toEqual(
      providerDays.slice(0, 3),
    );
    expect(forecastDaysForCapabilities(providerDays, PRO_LIFETIME_CAPABILITIES)).toEqual(
      providerDays.slice(0, 4),
    );
    expect(
      forecastDaysForCapabilities(providerDays.slice(0, 2), PRO_LIFETIME_CAPABILITIES),
    ).toEqual(providerDays.slice(0, 2));
  });

  it('filters environmental variables by capability group', () => {
    const standardOnly = {
      ...FREE_CAPABILITIES,
      environmentalVariables: {
        availableGroups: ['standard' as const],
      },
    };

    expect(isEnvironmentalVariableAvailable(standardOnly, 'pm25')).toBe(true);
    expect(isEnvironmentalVariableAvailable(standardOnly, 'aerosolOpticalDepth')).toBe(true);
    expect(isEnvironmentalVariableAvailable(standardOnly, 'moldPotential')).toBe(false);
    expect(isEnvironmentalVariableAvailable(standardOnly, 'uvIndex')).toBe(false);
    expect(isEnvironmentalVariableAvailable(standardOnly, 'carbonDioxide')).toBe(false);
    expect(
      availableEnvironmentalVariables(standardOnly).some((item) => item.id === 'uvIndex'),
    ).toBe(false);
  });

  it('filters profile factors through variable capabilities', () => {
    const standardOnly = {
      ...FREE_CAPABILITIES,
      environmentalVariables: {
        availableGroups: ['standard' as const],
      },
    };

    expect(
      availableProfileFactorOptions(standardOnly, ['pm25', 'aerosol_optical_depth', 'uv_index']),
    ).toEqual(['pm25', 'aerosol_optical_depth']);
  });

  it('removes Pro-only profile factors from Free personalized calculations', () => {
    const profile = {
      enabled: true,
      factors: {
        ...DEFAULT_PROFILE.factors,
        mold: true,
        uv_index: true,
      },
    };
    const freeProfile = profileForCapabilities(FREE_CAPABILITIES, profile);
    const proProfile = profileForCapabilities(PRO_LIFETIME_CAPABILITIES, profile);

    expect(freeProfile.factors.mold).toBe(false);
    expect(freeProfile.factors.uv_index).toBe(false);
    expect(proProfile.factors.mold).toBe(true);
    expect(proProfile.factors.uv_index).toBe(true);
  });

  it('keeps feature metadata focused on implemented features', () => {
    const features = featureDefinitions(FREE_CAPABILITIES);

    expect(features.map((feature) => feature.id)).toEqual([
      'environmental_burden',
      'personalized_risk',
      'current_readings',
      'forecast',
      'extended_forecast',
      'extended_environmental_data',
      'best_outdoor_window',
      'automatic_location',
      'manual_location',
      'daily_summary',
      'basic_transition_notifications',
      'advanced_environment_notifications',
    ]);
    expect(features.find((feature) => feature.id === 'extended_forecast')).toMatchObject({
      available: false,
      requiredEntitlement: 'pro_lifetime',
      freeBehavior: 'Today plus 2 additional days',
      proBehavior: 'Today plus 3 additional days',
    });
    expect(features.find((feature) => feature.id === 'extended_environmental_data')).toMatchObject({
      available: false,
      requiredEntitlement: 'pro_lifetime',
      freeBehavior: 'Standard Environmental Data',
      proBehavior: 'Additional atmospheric and weather measurements',
    });
    expect(
      features
        .filter(
          (feature) =>
            feature.id !== 'extended_forecast' &&
            feature.id !== 'extended_environmental_data' &&
            feature.id !== 'advanced_environment_notifications',
        )
        .every((feature) => feature.available),
    ).toBe(true);
  });

  it('splits Free and Pro notification capabilities', () => {
    expect(isFeatureAvailable(FREE_CAPABILITIES, 'basic_transition_notifications')).toBe(true);
    expect(isFeatureAvailable(PRO_LIFETIME_CAPABILITIES, 'basic_transition_notifications')).toBe(
      true,
    );
    expect(isFeatureAvailable(FREE_CAPABILITIES, 'advanced_environment_notifications')).toBe(false);
    expect(
      isFeatureAvailable(PRO_LIFETIME_CAPABILITIES, 'advanced_environment_notifications'),
    ).toBe(true);
  });

  it('formats extended forecast status from centralized feature metadata', () => {
    const freeFeature = featureDefinitions(FREE_CAPABILITIES).find(
      (feature) => feature.id === 'extended_forecast',
    );
    const proFeature = featureDefinitions(PRO_LIFETIME_CAPABILITIES).find(
      (feature) => feature.id === 'extended_forecast',
    );

    expect(freeFeature).toBeDefined();
    expect(proFeature).toBeDefined();
    expect(featureStatusMessage(freeFeature!)).toContain('Today plus 2 additional days');
    expect(featureStatusMessage(freeFeature!)).toContain('Today plus 3 additional days');
    expect(featureStatusMessage(freeFeature!)).toContain('purchasing is not available');
    expect(featureStatusMessage(proFeature!)).toContain('AirAware Pro active');
    expect(featureStatusMessage(proFeature!)).toContain('Today plus 3 additional days');
  });

  it('selects the configured environmental provider through the provider catalog', () => {
    expect(activeEnvironmentalProvider(FREE_CAPABILITIES).id).toBe('open-meteo');
    expect(() =>
      activeEnvironmentalProvider({
        ...FREE_CAPABILITIES,
        providers: {
          defaultProvider: 'open-meteo',
          availableProviders: [],
        },
      }),
    ).toThrow('unavailable');
  });

  it('keeps all Free behavior in Pro lifetime while extending configured Pro capabilities', () => {
    expect(PRO_LIFETIME_CAPABILITIES.environmentalVariables).toEqual(
      expect.objectContaining({
        availableGroups: ['standard', 'extended'],
      }),
    );
    expect(FREE_CAPABILITIES.environmentalVariables.availableGroups).toEqual(['standard']);
    expect(PRO_LIFETIME_CAPABILITIES.locations).toEqual(FREE_CAPABILITIES.locations);
    expect(PRO_LIFETIME_CAPABILITIES.providers).toEqual(FREE_CAPABILITIES.providers);
    expect(PRO_LIFETIME_CAPABILITIES.sharing).toEqual(FREE_CAPABILITIES.sharing);
    expect(PRO_LIFETIME_CAPABILITIES.notifications.availableGroups).toContain(
      'basic_transition_notifications',
    );
    expect(PRO_LIFETIME_CAPABILITIES.notifications.availableGroups).toContain(
      'advanced_environment_notifications',
    );
    expect(forecastDayLimit(PRO_LIFETIME_CAPABILITIES)).toBe(
      forecastDayLimit(FREE_CAPABILITIES) + 1,
    );
    expect(isFeatureAvailable(PRO_LIFETIME_CAPABILITIES, 'extended_forecast')).toBe(true);
  });
});

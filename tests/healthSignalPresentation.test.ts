import {
  healthSignalDetailDefaultRange,
  healthTimelineFillStyle,
  healthTimelinePointValueLabel,
  selectedHealthSignalDetailRange,
  todayHealthSectionVisibility,
} from '../src/core/healthSignalPresentation';
import { colors } from '../src/theme/theme';
import type { HealthSignal } from '../src/models/healthSignals';

function healthSignal(overrides: Partial<HealthSignal>): HealthSignal {
  return {
    id: 'signal',
    domain: 'biological',
    type: 'influenza',
    geography: { level: 'country', code: 'CZ', name: 'Czech Republic', countryCode: 'CZ' },
    updatedAt: '2026-08-25T00:00:00Z',
    value: 4.2,
    unit: '%',
    category: 'unknown',
    trend: 'unknown',
    source: { provider: 'WHO GISRS / FluNet' },
    freshness: { status: 'fresh' },
    ...overrides,
  };
}

describe('health signal presentation behavior', () => {
  it('shows thermal stress when it is the only health-context signal', () => {
    expect(
      todayHealthSectionVisibility({
        contextualHealthSignalCount: 0,
        hasHealthSignalLocationContext: true,
        healthSignalsError: null,
        healthSignalsLoading: false,
        thermalSignalCount: 1,
      }),
    ).toEqual({
      shouldShowHealthSignals: false,
      shouldShowThermalSignals: true,
    });
  });

  it('hides health-context sections when location context is unavailable', () => {
    expect(
      todayHealthSectionVisibility({
        contextualHealthSignalCount: 1,
        hasHealthSignalLocationContext: false,
        healthSignalsError: 'Provider unavailable',
        healthSignalsLoading: true,
        thermalSignalCount: 1,
      }),
    ).toEqual({
      shouldShowHealthSignals: false,
      shouldShowThermalSignals: false,
    });
  });

  it('defaults weekly, monthly, and yearly health signals to a year timeline', () => {
    expect(
      healthSignalDetailDefaultRange(
        healthSignal({
          reportingPeriod: { type: 'week', year: 2026, week: 31 },
        }),
      ),
    ).toBe('year');
    expect(
      healthSignalDetailDefaultRange(
        healthSignal({
          type: 'excess-mortality',
          domain: 'population-health',
          reportingPeriod: { type: 'month', year: 2026, month: 3 },
        }),
      ),
    ).toBe('year');
    expect(
      healthSignalDetailDefaultRange(
        healthSignal({
          type: 'malaria',
          reportingPeriod: { type: 'year', year: 2024 },
        }),
      ),
    ).toBe('year');
  });

  it('keeps thermal and radiation detail pages on the 24h range by default', () => {
    expect(healthSignalDetailDefaultRange(healthSignal({ type: 'thermal-stress' }))).toBe('24h');
    expect(
      healthSignalDetailDefaultRange(
        healthSignal({
          domain: 'radiological',
          type: 'ambient-dose-rate',
          unit: 'µSv/h',
        }),
      ),
    ).toBe('24h');
  });

  it('resets the selected range when moving to a different health signal', () => {
    const weekly = healthSignal({
      id: 'influenza:CZ:2026-W31',
      reportingPeriod: { type: 'week', year: 2026, week: 31 },
    });
    const thermal = healthSignal({ id: 'thermal:CZ', type: 'thermal-stress' });

    expect(selectedHealthSignalDetailRange(weekly, { signalId: weekly.id, rangeId: 'month' })).toBe(
      'month',
    );
    expect(
      selectedHealthSignalDetailRange(thermal, { signalId: weekly.id, rangeId: 'month' }),
    ).toBe('24h');
  });

  it('preserves positive excess-mortality signs in timeline values', () => {
    const mortality = healthSignal({
      domain: 'population-health',
      type: 'excess-mortality',
      unit: '%',
    });

    expect(healthTimelinePointValueLabel({ value: 4.2, unit: '%' }, mortality)).toBe('+4.2%');
    expect(healthTimelinePointValueLabel({ value: -5.9, unit: '%' }, mortality)).toBe('-5.9%');
  });

  it('anchors excess-mortality bars around the zero baseline', () => {
    expect(
      healthTimelineFillStyle({
        value: 4,
        min: -5,
        max: 5,
        signalType: 'excess-mortality',
      }),
    ).toMatchObject({
      backgroundColor: colors.high,
      left: '50%',
      position: 'absolute',
      width: '40%',
    });
    expect(
      healthTimelineFillStyle({
        value: -2.5,
        min: -5,
        max: 5,
        signalType: 'excess-mortality',
      }),
    ).toMatchObject({
      backgroundColor: colors.low,
      left: '25%',
      position: 'absolute',
      width: '25%',
    });
  });
});

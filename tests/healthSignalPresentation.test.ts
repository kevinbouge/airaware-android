import {
  healthSignalDetailDefaultRange,
  healthSignalDetailMetadataRows,
  healthSignalDetailPrimaryLabel,
  healthSignalDetailRangeLabel,
  healthSignalDetailRangeOptions,
  healthSignalDetailRangeSupported,
  healthSignalHasTimelineDetail,
  healthSignalInlineDetailRows,
  healthTimelineFillStyle,
  healthTimelinePointsForRange,
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

function point(time: string, period?: HealthSignal['reportingPeriod']) {
  return {
    period,
    time: Date.parse(time),
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
    expect(selectedHealthSignalDetailRange(weekly, { signalId: weekly.id, rangeId: 'week' })).toBe(
      'year',
    );
    expect(
      selectedHealthSignalDetailRange(thermal, { signalId: weekly.id, rangeId: 'month' }),
    ).toBe('24h');
  });

  it('supports only ranges that match the signal reporting cadence', () => {
    const weekly = healthSignal({
      reportingPeriod: { type: 'week', year: 2026, week: 31 },
    });
    const monthly = healthSignal({
      reportingPeriod: { type: 'month', year: 2026, month: 3 },
    });
    const yearly = healthSignal({
      reportingPeriod: { type: 'year', year: 2024 },
    });
    const thermal = healthSignal({ type: 'thermal-stress' });

    expect(healthSignalDetailRangeSupported(weekly, '24h')).toBe(false);
    expect(healthSignalDetailRangeSupported(weekly, 'week')).toBe(false);
    expect(healthSignalDetailRangeSupported(weekly, 'month')).toBe(true);
    expect(healthSignalDetailRangeSupported(weekly, 'year')).toBe(true);
    expect(healthSignalDetailRangeSupported(monthly, 'month')).toBe(false);
    expect(healthSignalDetailRangeSupported(monthly, 'year')).toBe(true);
    expect(healthSignalDetailRangeSupported(yearly, 'year')).toBe(true);
    expect(healthSignalDetailRangeSupported(thermal, '24h')).toBe(true);
    expect(healthSignalDetailRangeSupported(thermal, 'week')).toBe(false);
  });

  it('offers only supported product ranges with cadence-specific labels', () => {
    const weekly = healthSignal({
      reportingPeriod: { type: 'week', year: 2026, week: 31 },
    });
    const monthly = healthSignal({
      domain: 'population-health',
      type: 'excess-mortality',
      reportingPeriod: { type: 'month', year: 2026, month: 3 },
    });
    const thermal = healthSignal({ type: 'thermal-stress' });

    expect(healthSignalDetailRangeOptions(weekly)).toEqual([
      { id: 'month', label: 'Last 5 reporting weeks' },
      { id: 'year', label: 'Last 52 reporting weeks' },
    ]);
    expect(healthSignalDetailRangeOptions(monthly)).toEqual([
      { id: 'year', label: 'Last 12 reporting months' },
    ]);
    expect(healthSignalDetailRangeOptions(thermal)).toEqual([
      { id: '24h', label: 'Next 24 hours' },
    ]);
    expect(healthSignalDetailRangeLabel(weekly, 'year')).toBe('Last 52 reporting weeks');
    expect(healthSignalDetailRangeLabel(weekly, '24h')).toBe('24h');
  });

  it('labels delayed health signals as latest data rather than current readings', () => {
    expect(
      healthSignalDetailPrimaryLabel(
        healthSignal({
          type: 'influenza',
          domain: 'biological',
        }),
      ),
    ).toBe('Latest surveillance');
    expect(
      healthSignalDetailPrimaryLabel(
        healthSignal({
          type: 'wastewater-covid-19',
          domain: 'biological',
        }),
      ),
    ).toBe('Latest wastewater observation');
    expect(
      healthSignalDetailPrimaryLabel(
        healthSignal({
          type: 'malaria',
          domain: 'biological',
        }),
      ),
    ).toBe('Latest annual context');
    expect(
      healthSignalDetailPrimaryLabel(
        healthSignal({
          type: 'excess-mortality',
          domain: 'population-health',
        }),
      ),
    ).toBe('Latest available');
  });

  it('identifies health signals that have enough observations for a timeline', () => {
    const unavailable = healthSignal({
      metadata: { unavailable: true },
      history: [
        { value: 1, unit: '%', updatedAt: '2026-08-01T00:00:00Z' },
        { value: 2, unit: '%', updatedAt: '2026-08-08T00:00:00Z' },
      ],
    });
    const singlePoint = healthSignal({
      history: [{ value: 1, unit: '%', updatedAt: '2026-08-01T00:00:00Z' }],
    });
    const usefulTimeline = healthSignal({
      history: [
        { value: 1, unit: '%', updatedAt: '2026-08-01T00:00:00Z' },
        { value: 2, unit: '%', updatedAt: '2026-08-08T00:00:00Z' },
      ],
    });
    const staleTimeline = healthSignal({
      freshness: { status: 'stale', ageMs: 140 * 24 * 60 * 60 * 1000 },
      history: [
        { value: 1, unit: '%', updatedAt: '2026-03-01T00:00:00Z' },
        { value: 2, unit: '%', updatedAt: '2026-03-31T00:00:00Z' },
      ],
    });

    expect(healthSignalHasTimelineDetail(unavailable)).toBe(false);
    expect(healthSignalHasTimelineDetail(singlePoint)).toBe(false);
    expect(healthSignalHasTimelineDetail(staleTimeline)).toBe(false);
    expect(healthSignalHasTimelineDetail(usefulTimeline)).toBe(true);
  });

  it('builds inline details for unavailable health rows without hiding provenance', () => {
    const unavailable = healthSignal({
      value: undefined,
      unit: undefined,
      freshness: { status: 'stale', ageMs: 12 * 24 * 60 * 60 * 1000 },
      metadata: { unavailable: true },
      source: {
        provider: 'WHO GISRS / FluNet',
        dataset: 'VIW_FNT',
        measure: 'Influenza positivity',
      },
    });

    expect(healthSignalInlineDetailRows(unavailable)).toEqual([
      { label: 'Reason', value: 'No recent data' },
      { label: 'Source', value: 'WHO GISRS / FluNet · VIW_FNT' },
      { label: 'Geography', value: 'Czechia' },
      { label: 'Period', value: 'Latest surveillance' },
      { label: 'Freshness', value: 'Stale · 12 days ago' },
      { label: 'Measure', value: 'Influenza positivity' },
    ]);
  });

  it('uses a value label instead of reason for available inline health rows', () => {
    expect(
      healthSignalInlineDetailRows(
        healthSignal({
          domain: 'population-health',
          type: 'excess-mortality',
          reportingPeriod: { type: 'week', year: 2026, week: 31 },
          source: {
            provider: 'Our World in Data',
            dataset: 'excess-mortality-p-scores-average-baseline',
          },
          value: 4.2,
          unit: '%',
        }),
      )[0],
    ).toEqual({ label: 'Latest available', value: '+4.2%' });
  });

  it('expands stale health rows inline with reason and latest available value', () => {
    expect(
      healthSignalInlineDetailRows(
        healthSignal({
          domain: 'population-health',
          type: 'excess-mortality',
          freshness: { status: 'stale', ageMs: 140 * 24 * 60 * 60 * 1000 },
          reportingPeriod: { type: 'month', year: 2026, month: 3 },
          source: {
            provider: 'Eurostat',
            dataset: 'demo_mexrt',
          },
          value: -5.9,
          unit: '%',
        }),
      ).slice(0, 2),
    ).toEqual([
      { label: 'Reason', value: 'Stale' },
      { label: 'Latest available', value: '-5.9%' },
    ]);
  });

  it('keeps health detail provenance visible even without chart data', () => {
    expect(
      healthSignalDetailMetadataRows(
        healthSignal({
          trend: 'rising',
          reportingPeriod: { type: 'week', year: 2026, week: 34 },
          freshness: { status: 'aging', ageMs: 8 * 24 * 60 * 60 * 1000 },
        }),
      ),
    ).toEqual([
      { label: 'Source', value: 'WHO GISRS / FluNet' },
      { label: 'Geography', value: 'Czechia' },
      { label: 'Period', value: 'Week 34, 2026' },
      { label: 'Freshness', value: 'Aging · 8 days ago' },
      { label: 'Trend', value: 'Rising' },
    ]);
  });

  it('filters weekly surveillance by semantic reporting range instead of hourly windows', () => {
    const weekly = healthSignal({
      reportingPeriod: { type: 'week', year: 2026, week: 31 },
    });
    const points = Array.from({ length: 8 }, (_, index) =>
      point(`2026-0${index + 1}-01T00:00:00Z`, {
        type: 'week',
        year: 2026,
        week: index + 1,
      }),
    );

    expect(
      healthTimelinePointsForRange({
        anchorTime: Date.parse('2026-08-01T00:00:00Z'),
        points,
        rangeId: 'week',
        signal: weekly,
      }),
    ).toHaveLength(0);
    expect(
      healthTimelinePointsForRange({
        anchorTime: Date.parse('2026-08-01T00:00:00Z'),
        points,
        rangeId: 'month',
        signal: weekly,
      }),
    ).toHaveLength(5);
    expect(
      healthTimelinePointsForRange({
        anchorTime: Date.parse('2026-08-01T00:00:00Z'),
        points,
        rangeId: 'year',
        signal: weekly,
      }),
    ).toHaveLength(8);
  });

  it('keeps thermal stress detail constrained to real 24-hour forecast points', () => {
    const thermal = healthSignal({ type: 'thermal-stress' });
    const anchorTime = Date.parse('2026-08-01T12:00:00Z');
    const points = [
      point('2026-08-01T11:00:00Z'),
      point('2026-08-01T12:00:00Z'),
      point('2026-08-02T11:00:00Z'),
      point('2026-08-02T13:00:00Z'),
    ];

    expect(
      healthTimelinePointsForRange({
        anchorTime,
        points,
        rangeId: '24h',
        signal: thermal,
      }),
    ).toEqual([points[1], points[2]]);
    expect(
      healthTimelinePointsForRange({
        anchorTime,
        points,
        rangeId: 'month',
        signal: thermal,
      }),
    ).toHaveLength(0);
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

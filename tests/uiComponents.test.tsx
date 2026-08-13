import React from 'react';
import { StyleSheet, type TextStyle, type ViewStyle } from 'react-native';
import { ActivityForecastTimeline } from '../src/components/ActivityForecastTimeline';
import { ReadingRow } from '../src/components/ReadingRow';
import { DailyForecastSection } from '../src/components/ContextForecast';
import { ForecastBarSection, ForecastTimeline } from '../src/components/ForecastSections';
import { ForecastBarRow } from '../src/components/ui/ForecastBarRow';
import { InsightCard } from '../src/components/InsightCard';
import { RiskForecastTimeline } from '../src/components/RiskForecastTimeline';
import { ScoreCard } from '../src/components/ScoreCard';
import { SectionCard } from '../src/components/SectionCard';
import { SummaryMetricGrid } from '../src/components/ui/SummaryMetricGrid';
import { FREE_CAPABILITIES } from '../src/capabilities/config';

describe('shared UI components', () => {
  it('does not add header spacing to untitled section cards', () => {
    const card = SectionCard({
      children: 'Summary',
    }) as React.ReactElement<{ children?: React.ReactNode }>;
    const children = React.Children.toArray(card.props.children);
    const content = children.at(-1) as React.ReactElement<{ style?: unknown }>;
    const contentStyle = StyleSheet.flatten(content.props.style) as ViewStyle;

    expect(contentStyle.marginTop).toBe(0);
  });

  it('keeps forecast bar rows exposed as one accessible forecast summary', () => {
    const row = ForecastBarRow({
      accent: '#2E7D32',
      accessibilityLabel: 'Today, Low, 22 percent',
      fillPercent: 22,
      label: 'Today',
      value: 'Low · 22%',
    }) as React.ReactElement<{ accessible?: boolean; accessibilityLabel?: string }>;

    expect(row.props.accessible).toBe(true);
    expect(row.props.accessibilityLabel).toBe('Today, Low, 22 percent');
  });

  it('allows summary metrics to wrap instead of forcing a cramped single row', () => {
    const grid = SummaryMetricGrid({
      metrics: [
        { label: 'Score', value: 'Very High · 100%' },
        { label: 'Best window', value: '06:00–08:00 (tomorrow)', compact: true },
      ],
    }) as React.ReactElement<{ children?: React.ReactNode; style?: unknown }>;
    const gridStyle = StyleSheet.flatten(grid.props.style) as ViewStyle;
    const metricRows = React.Children.toArray(grid.props.children) as React.ReactElement<{
      children?: React.ReactNode;
      style?: unknown;
    }>[];
    const firstMetric = metricRows[0];
    if (!firstMetric) {
      throw new Error('SummaryMetricGrid did not render any metrics');
    }

    const itemStyle = StyleSheet.flatten(firstMetric.props.style) as ViewStyle;
    const metricTexts = React.Children.toArray(firstMetric.props.children) as React.ReactElement<{
      style?: unknown;
    }>[];
    const value = metricTexts[1];
    if (!value) {
      throw new Error('SummaryMetricGrid did not render a metric value');
    }

    const valueStyle = StyleSheet.flatten(value.props.style) as TextStyle;
    const secondMetric = metricRows[1];
    if (!secondMetric) {
      throw new Error('SummaryMetricGrid did not render the second metric');
    }
    const secondMetricTexts = React.Children.toArray(
      secondMetric.props.children,
    ) as React.ReactElement<{
      style?: unknown;
    }>[];
    const compactValue = secondMetricTexts[1];
    if (!compactValue) {
      throw new Error('SummaryMetricGrid did not render the compact metric value');
    }
    const compactValueStyle = StyleSheet.flatten(compactValue.props.style) as TextStyle;

    expect(gridStyle.flexWrap).toBe('wrap');
    expect(gridStyle.rowGap).toBe(8);
    expect(itemStyle.flexShrink).toBe(1);
    expect(itemStyle.minWidth).toBeGreaterThan(0);
    expect(valueStyle.flexShrink).toBe(1);
    expect(compactValueStyle.fontSize).toBeLessThan(valueStyle.fontSize as number);
  });

  it('keeps tappable environmental reading rows at a comfortable touch target size', () => {
    const row = ReadingRow({
      label: 'PM2.5',
      onPress: jest.fn(),
      value: '8 µg/m³',
      variableId: 'pm25',
    }) as React.ReactElement<{
      accessibilityLabel?: string;
      style?: (state: { pressed: boolean }) => unknown;
    }>;
    const style = row.props.style?.({ pressed: false });
    const flattened = StyleSheet.flatten(style) as ViewStyle;

    expect(flattened.minHeight).toBeGreaterThanOrEqual(44);
    expect(row.props.accessibilityLabel).toContain('Opens details.');
  });

  it('shows a chevron only for tappable environmental reading rows', () => {
    const tappable = ReadingRow({
      label: 'PM2.5',
      onPress: jest.fn(),
      value: '8 µg/m³',
      variableId: 'pm25',
    }) as React.ReactElement<{ children?: React.ReactNode }>;
    const staticRow = ReadingRow({
      label: 'Woodland',
      value: '1.2 km',
    }) as React.ReactElement<{ children?: React.ReactNode }>;
    const pressableContent = React.Children.only(tappable.props.children) as React.ReactElement<{
      children?: React.ReactNode;
    }>;

    expect(JSON.stringify(pressableContent.props.children)).toContain('›');
    expect(JSON.stringify(staticRow.props.children)).not.toContain('›');
  });

  it('shows a chevron on tappable score cards', () => {
    const card = ScoreCard({
      category: 'moderate',
      onPress: jest.fn(),
      score: 42,
      title: 'Environmental burden',
    }) as React.ReactElement<{ accessibilityLabel?: string }>;

    expect(card.type).toBe(InsightCard);
    expect(card.props.accessibilityLabel).toContain('Opens details.');
  });

  it('shows a forecast empty state instead of an empty contextual forecast card', () => {
    const section = DailyForecastSection({
      capabilities: FREE_CAPABILITIES,
      days: [],
      scoreForDate: () => null,
      title: 'Environmental burden forecast',
    }) as React.ReactElement<{ emptyLabel?: string }>;

    expect(section.type).toBe(ForecastBarSection);
    expect(section.props.emptyLabel).toBe('Forecast data is unavailable.');
  });

  it('shows category labels next to scores in daily risk forecasts', () => {
    const section = DailyForecastSection({
      capabilities: FREE_CAPABILITIES,
      days: [
        { date: '2026-08-13', label: 'Today' },
        { date: '2026-08-14', label: 'Tomorrow' },
      ],
      scoreForDate: (date) =>
        date === '2026-08-14'
          ? { available: true, category: 'low', score: 22 }
          : { available: true, category: 'high', score: 68 },
      title: 'Environmental burden forecast',
    }) as React.ReactElement<{
      rows?: {
        markerLabel?: string;
        reserveMarkerSpace?: boolean;
        value: string;
        valueMinWidth?: number;
      }[];
    }>;

    expect(section.props.rows?.[0]?.value).toBe('High · 68%');
    expect(section.props.rows?.[0]?.valueMinWidth).toBeUndefined();
    expect(section.props.rows?.[0]?.reserveMarkerSpace).toBe(true);
    expect(section.props.rows?.[1]?.markerLabel).toBe('Best');
  });

  it('marks every tied best day in daily risk forecasts', () => {
    const section = DailyForecastSection({
      capabilities: FREE_CAPABILITIES,
      days: [
        { date: '2026-08-13', label: 'Today' },
        { date: '2026-08-14', label: 'Tomorrow' },
        { date: '2026-08-15', label: 'Saturday' },
      ],
      scoreForDate: (date) => {
        if (date === '2026-08-15') {
          return { available: true, category: 'moderate', score: 34 };
        }
        if (date === '2026-08-14') {
          return { available: true, category: 'low', score: 22.4 };
        }
        return { available: true, category: 'low', score: 21.6 };
      },
      title: 'Environmental burden forecast',
    }) as React.ReactElement<{
      rows?: {
        markerLabel?: string;
        reserveMarkerSpace?: boolean;
      }[];
    }>;

    expect(section.props.rows?.map((row) => row.markerLabel)).toEqual(['Best', 'Best', '']);
    expect(section.props.rows?.every((row) => row.reserveMarkerSpace)).toBe(true);
  });

  it('shows category labels next to scores in risk and activity 24-hour timelines', () => {
    const riskTimeline = RiskForecastTimeline({
      bestWindow: null,
      current: {
        category: 'veryHigh',
        score: 84,
        timestamp: '2026-08-13T12:00:00Z',
      },
      hourly: [],
      unavailableLabel: 'Unavailable',
    }) as React.ReactElement<{
      rows?: { value: string; valueMinWidth?: number }[];
    }>;
    const activityTimeline = ActivityForecastTimeline({
      bestWindow: null,
      hours: [
        {
          available: true,
          category: 'excellent',
          displayScore: 91,
          factors: [],
          missingRequiredVariables: [],
          score: 91,
          timestamp: '2026-08-13T12:00:00Z',
        },
      ],
      now: '2026-08-13T12:00:00Z',
      unavailableLabel: 'Unavailable',
    }) as React.ReactElement<{
      rows?: { value: string; valueMinWidth?: number }[];
    }>;

    expect(riskTimeline.props.rows?.[0]?.value).toBe('Very High · 84%');
    expect(riskTimeline.props.rows?.[0]?.valueMinWidth).toBe(96);
    expect(activityTimeline.props.rows?.[0]?.value).toBe('Excellent · 91%');
    expect(activityTimeline.props.rows?.[0]?.valueMinWidth).toBe(96);
  });

  it('uses the same bar section and timeline primitives for forecast graphs', () => {
    const section = ForecastBarSection({
      emptyLabel: 'Forecast data is unavailable.',
      rows: [
        {
          accent: '#2E7D32',
          accessibilityLabel: 'Today Low 22',
          fillPercent: 22,
          key: 'today',
          label: 'Today',
          value: 'Low · 22',
        },
      ],
      title: 'Forecast',
    }) as React.ReactElement<{ children?: React.ReactNode }>;
    const timeline = ForecastTimeline({
      emptyLabel: 'Timeline unavailable.',
      rows: [
        {
          accent: '#2E7D32',
          accessibilityLabel: 'Now 22',
          fillPercent: 22,
          key: 'now',
          label: 'Now',
          reserveMarkerSpace: true,
          value: '22',
        },
      ],
    }) as React.ReactElement<{ children?: React.ReactNode }>;

    expect(JSON.stringify(section.props.children)).toContain('Today');
    expect(JSON.stringify(timeline.props.children)).toContain('Now');
  });
});

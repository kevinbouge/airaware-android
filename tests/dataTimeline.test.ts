import { buildDataDetailTimeline, weekKeyAt } from '../src/core/dataTimeline';
import { dataDetailRange, dataDetailVariable } from '../src/core/dataVariableMetadata';
import type { DataDetailRangeId, RawTimelinePoint } from '../src/models/dataDetail';

const coordinates = { latitude: 50.0755, longitude: 14.4378 };
const now = '2026-08-10T12:00:00Z';

function variable(id: Parameters<typeof dataDetailVariable>[0]) {
  const definition = dataDetailVariable(id);
  if (!definition) throw new Error(`Missing test variable ${id}`);
  return definition;
}

function point(timestamp: string, value: number | null, source: RawTimelinePoint['source']) {
  return { timestamp, value, source };
}

function timeline(
  variableId: Parameters<typeof dataDetailVariable>[0],
  rangeId: DataDetailRangeId,
  history: RawTimelinePoint[],
  forecast: RawTimelinePoint[],
) {
  return buildDataDetailTimeline({
    variable: variable(variableId),
    range: dataDetailRange(rangeId),
    coordinates,
    timezone: 'Europe/Prague',
    now,
    history,
    forecast,
  });
}

describe('data detail timeline', () => {
  it('constructs the 24h range with history above now and forecast below now', () => {
    const result = timeline(
      'pm25',
      '24h',
      [point('2026-08-10T01:00:00Z', 8, 'history'), point('2026-08-10T11:00:00Z', 12, 'history')],
      [
        point('2026-08-10T12:00:00Z', 14, 'forecast'),
        point('2026-08-10T23:00:00Z', 18, 'forecast'),
        point('2026-08-11T02:00:00Z', 30, 'forecast'),
      ],
    );

    expect(result.rangeId).toBe('24h');
    expect(result.granularity).toBe('hourly');
    expect(result.nowOffsetRatio).toBe(0.5);
    expect(result.points.map((item) => item.source)).toEqual([
      'history',
      'history',
      'forecast',
      'forecast',
    ]);
    expect(result.points.map((item) => item.value)).toEqual([8, 12, 14, 18]);
  });

  it('uses daily peak aggregation for pollen over week and month ranges', () => {
    const result = timeline(
      'pollen_grass',
      'week',
      [point('2026-08-09T08:00:00Z', 12, 'history'), point('2026-08-09T18:00:00Z', 41, 'history')],
      [point('2026-08-10T14:00:00Z', 8, 'forecast'), point('2026-08-10T18:00:00Z', 28, 'forecast')],
    );

    expect(result.granularity).toBe('daily');
    expect(result.points.map((item) => item.value)).toEqual([41, 28]);
  });

  it('uses average aggregation for pressure and keeps a range-relative domain', () => {
    const result = timeline(
      'pressureMsl',
      'month',
      [
        point('2026-08-09T08:00:00Z', 1010, 'history'),
        point('2026-08-09T18:00:00Z', 1020, 'history'),
      ],
      [point('2026-08-10T18:00:00Z', 1016, 'forecast')],
    );

    expect(result.points[0]?.value).toBe(1015);
    expect(result.domain?.min).toBe(1015);
    expect(result.domain?.max).toBe(1016);
  });

  it('groups daily buckets by provider-local date instead of UTC date', () => {
    const result = timeline(
      'pressureMsl',
      'week',
      [
        point('2026-08-10T00:30:00+02:00', 1010, 'history'),
        point('2026-08-10T08:00:00+02:00', 1020, 'history'),
      ],
      [],
    );

    expect(result.points).toHaveLength(1);
    expect(result.points[0]?.label).toBe('2026-08-10');
    expect(result.points[0]?.value).toBe(1015);
  });

  it('uses provider-local midnight for daily current summary near UTC boundaries', () => {
    const result = buildDataDetailTimeline({
      variable: variable('uvIndex'),
      range: dataDetailRange('week'),
      coordinates,
      timezone: 'Europe/Prague',
      now: '2026-08-11T00:30:00+02:00',
      history: [point('2026-08-11T00:00:00+02:00', 7, 'history')],
      forecast: [],
    });

    expect(result.summary.current).toBe(7);
  });

  it('uses sum aggregation for sunshine duration', () => {
    const result = timeline(
      'sunshineDuration',
      'week',
      [
        point('2026-08-09T08:00:00Z', 900, 'history'),
        point('2026-08-09T09:00:00Z', 1200, 'history'),
      ],
      [],
    );

    expect(result.points[0]?.value).toBe(2100);
  });

  it('keeps missing hourly values missing rather than converting them to zero', () => {
    const result = timeline(
      'ozone',
      '24h',
      [point('2026-08-10T10:00:00Z', null, 'history')],
      [point('2026-08-10T12:00:00Z', 55, 'forecast')],
    );

    expect(result.points[0]?.value).toBeNull();
    expect(result.points[1]?.value).toBe(55);
    expect(result.domain).toEqual({ min: 0, max: 55 });
  });

  it('supports partial forecast availability without fabricating future points', () => {
    const result = timeline(
      'uvIndex',
      'month',
      [point('2026-08-09T12:00:00Z', 6, 'history')],
      [point('2026-08-10T12:00:00Z', 7, 'forecast')],
    );

    expect(result.points).toHaveLength(2);
    expect(result.forecastAvailable).toBe(true);
  });

  it('marks forecast tails as truncated when Open-Meteo ends before the selected range', () => {
    const result = timeline(
      'pollen_grass',
      'month',
      [point('2026-08-09T12:00:00Z', 6, 'history')],
      [point('2026-08-11T12:00:00Z', 7, 'forecast')],
    );

    expect(result.forecastAvailable).toBe(true);
    expect(result.forecastTruncated).toBe(true);
    expect(result.partial).toBe(true);
  });

  it('uses weekly aggregation for the year range and allows a partial final forecast week', () => {
    const result = timeline(
      'dust',
      'year',
      [point('2026-08-03T12:00:00Z', 12, 'history'), point('2026-08-04T12:00:00Z', 18, 'history')],
      [point('2026-08-10T12:00:00Z', 21, 'forecast')],
    );

    expect(result.granularity).toBe('weekly');
    expect(result.points[0]?.id).toContain(weekKeyAt(Date.parse('2026-08-03T12:00:00Z')));
    expect(result.points[1]?.source).toBe('forecast');
    expect(result.points[1]?.value).toBe(21);
  });
});

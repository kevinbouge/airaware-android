import { buildRiskTimelineRows, type TimelineScorePoint } from '../src/core/riskTimeline';

function point(index: number, score: number | null): TimelineScorePoint {
  const category = score === null || score > 70 ? 'high' : 'low';
  return {
    timestamp: new Date(Date.UTC(2026, 7, 1, index, 0, 0)).toISOString(),
    score,
    category: score === null ? 'unavailable' : category,
  };
}

describe('risk timeline', () => {
  it('keeps only available forecast hours', () => {
    const rows = buildRiskTimelineRows(null, [point(0, 20), point(1, null), point(2, 40)], null);

    expect(rows).toHaveLength(2);
    expect(rows.map((row) => row.displayScore)).toEqual([20, 40]);
  });

  it('uses the current score as the Now row and omits duplicate older forecast hours', () => {
    const rows = buildRiskTimelineRows(
      point(1, 55),
      [point(0, 20), point(1, 40), point(2, 70)],
      null,
    );

    expect(rows.map((row) => row.displayScore)).toEqual([55, 70]);
    expect(rows[0]?.now).toBe(true);
  });

  it('marks every row inside the best outdoor window range', () => {
    const source = [point(0, 80), point(1, 35), point(2, 30), point(3, 70)];
    const rows = buildRiskTimelineRows(null, source, {
      available: true,
      startTime: source[1]?.timestamp ?? null,
      endTime: source[3]?.timestamp ?? null,
      durationHours: 2,
      averageScore: 32.5,
      maximumScore: 35,
      category: 'low',
      completeness: 1,
    });

    expect(rows.map((row) => row.inBestWindow)).toEqual([false, true, true, false]);
    expect(rows.map((row) => row.markerLabel)).toEqual(['', 'Best', 'Best', '']);
  });
});

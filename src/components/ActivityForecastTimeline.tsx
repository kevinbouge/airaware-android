import { buildActivityTimelineRows } from '../core/activityTimeline';
import { activityCategoryLabel } from '../core/activityEvaluator';
import { ForecastTimeline } from './ForecastSections';
import type {
  ActivityHourResult,
  ActivitySuitabilityCategory,
  ActivityWindowResult,
} from '../models/activities';
import { colors } from '../theme/theme';
import { formatScore, formatShortTime } from '../utils/format';

interface ActivityForecastTimelineProps {
  hours: readonly ActivityHourResult[];
  now: string;
  bestWindow: ActivityWindowResult | null;
  unavailableLabel: string;
}

function activityColor(category: ActivitySuitabilityCategory): string {
  switch (category) {
    case 'excellent':
      return colors.low;
    case 'good':
      return colors.primary;
    case 'fair':
      return colors.moderate;
    case 'poor':
      return colors.high;
    case 'unsuitable':
      return colors.veryHigh;
    case 'insufficientData':
      return colors.unavailable;
  }
}

export function ActivityForecastTimeline({
  hours,
  now,
  bestWindow,
  unavailableLabel,
}: ActivityForecastTimelineProps) {
  const rows = buildActivityTimelineRows(hours, now, bestWindow);
  const timelineRows = rows.map((row) => {
    const accent = activityColor(row.category);
    const value = `${activityCategoryLabel(row.category)} · ${formatScore(row.score)}`;

    return {
      accessibilityLabel: `${row.now ? 'Now' : formatShortTime(row.timestamp)} ${value}`,
      accent,
      fillPercent: row.displayScore,
      highlighted: row.inBestWindow,
      key: row.timestamp,
      label: row.now ? 'Now' : formatShortTime(row.timestamp),
      markerLabel: row.markerLabel,
      reserveMarkerSpace: true,
      value,
      valueMinWidth: 96,
    };
  });

  return <ForecastTimeline rows={timelineRows} emptyLabel={unavailableLabel} />;
}

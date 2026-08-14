import { buildActivityTimelineRows } from '../core/activityTimeline';
import { activityCategoryLabel } from '../core/activityEvaluator';
import { ForecastTimeline } from './ForecastSections';
import type { ForecastTimelineItem } from './ForecastSections';
import type {
  ActivityHourResult,
  ActivitySemanticType,
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
  semanticType?: ActivitySemanticType | undefined;
  forecastHours?: number | undefined;
}

function activityColor(
  category: ActivitySuitabilityCategory,
  semanticType: ActivitySemanticType,
): string {
  if (semanticType === 'risk') {
    switch (category) {
      case 'excellent':
        return colors.veryHigh;
      case 'good':
        return colors.high;
      case 'fair':
        return colors.moderate;
      case 'poor':
        return colors.primary;
      case 'unsuitable':
        return colors.low;
      case 'insufficientData':
        return colors.unavailable;
    }
  }

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
  semanticType = 'suitability',
  forecastHours = 24,
}: ActivityForecastTimelineProps) {
  const rows = buildActivityTimelineRows(hours, now, bestWindow, forecastHours);
  const timelineRows: ForecastTimelineItem[] = rows.map((row) => {
    const accent = activityColor(row.category, semanticType);
    const value = `${activityCategoryLabel(row.category, semanticType)} · ${formatScore(row.score)}`;

    return {
      accessibilityLabel: `${row.now ? 'Now' : formatShortTime(row.timestamp)} ${value}`,
      accent,
      fillPercent: row.displayScore,
      highlighted: row.inBestWindow,
      highlightTone: semanticType === 'risk' ? 'worst' : 'best',
      key: row.timestamp,
      label: row.now ? 'Now' : formatShortTime(row.timestamp),
      markerLabel:
        semanticType === 'risk' && row.markerLabel === 'Best' ? 'Worst' : row.markerLabel,
      reserveMarkerSpace: true,
      value,
      valueMinWidth: 96,
    };
  });

  return <ForecastTimeline rows={timelineRows} emptyLabel={unavailableLabel} />;
}

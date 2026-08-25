import { buildRiskTimelineRows, type TimelineScorePoint } from '../core/riskTimeline';
import { ForecastTimeline } from './ForecastSections';
import { categoryLabel } from '../core/categories';
import { translate } from '../i18n';
import type { OutdoorWindow } from '../models/environment';
import { riskColor } from '../theme/theme';
import { formatScore, formatShortTime } from '../utils/format';

interface RiskForecastTimelineProps {
  current: TimelineScorePoint | null;
  hourly: TimelineScorePoint[];
  bestWindow: OutdoorWindow | null;
  unavailableLabel: string;
}

export function RiskForecastTimeline({
  current,
  hourly,
  bestWindow,
  unavailableLabel,
}: RiskForecastTimelineProps) {
  const rows = buildRiskTimelineRows(current, hourly, bestWindow);
  const timelineRows = rows.map((row) => {
    const value = `${categoryLabel(row.category)} · ${formatScore(row.score)}`;
    const label = row.now ? translate('common.now') : formatShortTime(row.timestamp);

    return {
      accessibilityLabel: `${label} ${value}`,
      accent: riskColor(row.category),
      fillPercent: row.displayScore,
      highlighted: row.inBestWindow,
      key: row.timestamp,
      label,
      markerLabel: row.markerLabel,
      reserveMarkerSpace: true,
      value,
      valueMinWidth: 96,
    };
  });

  return <ForecastTimeline rows={timelineRows} emptyLabel={unavailableLabel} />;
}

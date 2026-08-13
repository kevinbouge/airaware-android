import { forecastDaysForCapabilities } from '../capabilities/forecast';
import { categoryLabel } from '../core/categories';
import { RiskForecastTimeline } from './RiskForecastTimeline';
import { ForecastBarSection } from './ForecastSections';
import { SectionCard } from './SectionCard';
import type { AppCapabilities } from '../capabilities/types';
import type { OutdoorWindow, RiskCategoryId } from '../models/environment';
import { colors, riskColor } from '../theme/theme';
import { displayScore } from '../utils/number';
import { formatScore } from '../utils/format';

export interface ContextForecastScore {
  available: boolean;
  category: RiskCategoryId;
  score: number | null;
}

interface ForecastDayInput {
  date: string;
  label: string;
}

interface TimelinePointInput {
  timestamp: string;
  score: number | null;
  category: RiskCategoryId;
}

function buildDailyForecastRow({
  label,
  date,
  score,
}: {
  label: string;
  date: string;
  score: ContextForecastScore | null | undefined;
}) {
  const available =
    score?.available === true &&
    score.category !== 'unavailable' &&
    typeof score.score === 'number' &&
    Number.isFinite(score.score);
  const accent = available ? riskColor(score.category) : colors.unavailable;
  const value = available
    ? `${categoryLabel(score.category)} · ${formatScore(score.score)}`
    : 'Unavailable';
  const accessibilityLabel = available ? `${label} ${value}` : `${label} unavailable`;

  return {
    accessibilityLabel,
    accent,
    fillPercent: available ? score.score : null,
    key: date,
    label,
    value,
  };
}

function bestRiskForecastDates(
  rows: {
    date: string;
    score: ContextForecastScore | null | undefined;
  }[],
): Set<string> {
  const availableRows = rows.filter(
    (row): row is { date: string; score: ContextForecastScore & { score: number } } =>
      row.score?.available === true &&
      row.score.category !== 'unavailable' &&
      typeof row.score.score === 'number' &&
      Number.isFinite(row.score.score),
  );
  const bestScore = availableRows
    .map((row) => displayScore(row.score.score) ?? 0)
    .sort((left, right) => left - right)[0];

  if (bestScore === undefined) return new Set();

  return new Set(
    availableRows
      .filter((row) => (displayScore(row.score.score) ?? 0) === bestScore)
      .map((row) => row.date),
  );
}

export function DailyForecastSection({
  title,
  days,
  capabilities,
  scoreForDate,
}: {
  title: string;
  days: readonly ForecastDayInput[];
  capabilities: AppCapabilities;
  scoreForDate: (date: string) => ContextForecastScore | null | undefined;
}) {
  const visibleDays = forecastDaysForCapabilities(days, capabilities);
  const scoredDays = visibleDays.map((day) => ({
    date: day.date,
    score: scoreForDate(day.date),
  }));
  const bestDates = bestRiskForecastDates(scoredDays);
  const rows = visibleDays.map((day) => {
    const isBest = bestDates.has(day.date);
    return {
      ...buildDailyForecastRow({
        date: day.date,
        label: day.label,
        score: scoreForDate(day.date),
      }),
      highlighted: isBest,
      markerLabel: isBest ? 'Best' : '',
      reserveMarkerSpace: bestDates.size > 0,
    };
  });

  return (
    <ForecastBarSection title={title} rows={rows} emptyLabel="Forecast data is unavailable." />
  );
}

export function RiskTimelineSection({
  title,
  subtitle,
  current,
  hourly,
  bestWindow,
  unavailableLabel,
}: {
  title: string;
  subtitle: string;
  current: TimelinePointInput | null;
  hourly: TimelinePointInput[];
  bestWindow: OutdoorWindow | null;
  unavailableLabel: string;
}) {
  return (
    <SectionCard title={title} subtitle={subtitle}>
      <RiskForecastTimeline
        current={current}
        hourly={hourly}
        bestWindow={bestWindow}
        unavailableLabel={unavailableLabel}
      />
    </SectionCard>
  );
}

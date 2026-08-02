import { categoryLabel } from './categories';
import { calculateEnvironmentalScore } from './scoring';
import type {
  DailySummary,
  EnvironmentalScoreResult,
  NormalizedEnvironment,
  OutdoorWindow,
  PersonalizedScoreResult,
  RiskCategoryId,
} from '../models/environment';
import type { AppSettings } from '../models/profile';
import { contributorFromScore } from '../utils/contributorLabels';
import { formatDateLabel, formatShortTime, headlineWithEmoji } from '../utils/format';

function scoreChoice(input: {
  environment: NormalizedEnvironment;
  environmentalScore: EnvironmentalScoreResult;
  personalizedScore: PersonalizedScoreResult;
  settings: AppSettings;
}): {
  label: DailySummary['scoreLabel'];
  score: EnvironmentalScoreResult | PersonalizedScoreResult;
} {
  if (input.settings.summaryScore === 'personalized' && input.personalizedScore.available) {
    return { label: 'Personalized risk', score: input.personalizedScore };
  }

  return { label: 'Environmental burden', score: input.environmentalScore };
}

function mainFactor(
  environmentalScore: EnvironmentalScoreResult,
  personalizedScore: PersonalizedScoreResult,
): Pick<DailySummary, 'mainFactorLabel' | 'mainFactorGroup'> {
  const contributor = contributorFromScore(
    personalizedScore.available ? personalizedScore : environmentalScore,
  );

  return {
    mainFactorLabel: contributor.label,
    mainFactorGroup: contributor.group,
  };
}

function uvPeak(environment: NormalizedEnvironment, referenceTime: string): DailySummary['uvPeak'] {
  const start = Date.parse(referenceTime);
  if (!Number.isFinite(start)) return null;
  const end = start + 24 * 60 * 60 * 1000;
  const peak = environment.hourly
    .filter((hour) => {
      const timestamp = Date.parse(hour.timestamp);
      return (
        typeof hour.uvIndex === 'number' &&
        Number.isFinite(hour.uvIndex) &&
        Number.isFinite(timestamp) &&
        timestamp >= start &&
        timestamp < end
      );
    })
    .sort((left, right) => (right.uvIndex ?? 0) - (left.uvIndex ?? 0))[0];

  if (!peak || peak.uvIndex === null) return null;
  let category: RiskCategoryId = 'low';
  if (peak.uvIndex > 10) category = 'veryHigh';
  else if (peak.uvIndex > 7) category = 'veryHigh';
  else if (peak.uvIndex > 5) category = 'high';
  else if (peak.uvIndex > 2) category = 'moderate';

  return {
    category,
    value: peak.uvIndex,
    timeLabel: formatShortTime(peak.timestamp),
  };
}

export function buildDailySummary(input: {
  environment: NormalizedEnvironment | null;
  personalizedScore: PersonalizedScoreResult;
  bestOutdoorWindow: OutdoorWindow | null;
  settings: AppSettings;
  stale: boolean;
}): DailySummary | null {
  if (!input.environment) return null;

  const environmentalScore = calculateEnvironmentalScore(input.environment.current);
  if (!environmentalScore.available) return null;

  const selectedScore = scoreChoice({
    environment: input.environment,
    environmentalScore,
    personalizedScore: input.personalizedScore,
    settings: input.settings,
  });
  const factor = mainFactor(environmentalScore, input.personalizedScore);
  const title =
    input.settings.summaryLocation === 'place' && input.environment.placeName
      ? `AirAware — ${input.environment.placeName}`
      : 'AirAware';
  const referenceTime = input.environment.current.timestamp ?? input.environment.fetchedAt;

  return {
    title,
    dateLabel: formatDateLabel(referenceTime),
    scoreLabel: selectedScore.label,
    score: selectedScore.score,
    mainFactorLabel: factor.mainFactorLabel,
    mainFactorGroup: factor.mainFactorGroup,
    bestOutdoorWindow: input.bestOutdoorWindow,
    uvPeak: uvPeak(input.environment, referenceTime),
    stale: input.stale,
    attribution: ['Open-Meteo'],
  };
}

function factorEmoji(group: DailySummary['mainFactorGroup']): string {
  switch (group) {
    case 'pollen':
      return '🌾';
    case 'pollution':
      return '🌬️';
    case 'mold':
      return '🍄';
    case 'uv':
      return '☀️';
    default:
      return '🔎';
  }
}

export function formatDailySummary(summary: DailySummary): string {
  const lines: string[] = [
    `😷 ${summary.title}`,
    `📅 ${summary.dateLabel}`,
    '',
    `🎯 ${summary.scoreLabel}`,
    headlineWithEmoji(summary.score.category, summary.score.score),
  ];

  if (summary.mainFactorLabel) {
    lines.push('', `${factorEmoji(summary.mainFactorGroup)} Main factor`, summary.mainFactorLabel);
  }

  if (summary.bestOutdoorWindow?.available) {
    lines.push(
      '',
      '🌤️ Best outdoor window',
      `${formatShortTime(summary.bestOutdoorWindow.startTime)}–${formatShortTime(summary.bestOutdoorWindow.endTime)}`,
    );
  }

  if (summary.uvPeak) {
    lines.push(
      '',
      '☀️ UV peak',
      `${categoryLabel(summary.uvPeak.category)} at ${summary.uvPeak.timeLabel}`,
    );
  }

  if (summary.stale) {
    lines.push('', '💾 Cached data');
  }

  lines.push('', 'ℹ️ Environmental conditions only — not medical advice.');
  lines.push(`📡 Data: ${summary.attribution.join(', ')}`);

  return lines.join('\n').trim();
}

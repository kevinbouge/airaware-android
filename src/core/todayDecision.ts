import { categoryLabel } from './categories';
import { translate } from '../i18n';
import type {
  EnvironmentalScoreResult,
  OutdoorWindow,
  PersonalizedScoreResult,
  RiskCategoryId,
  ScoreComponent,
} from '../models/environment';
import { formatTimeRangeWithTomorrow } from '../utils/format';
import { contributorFromScore } from '../utils/contributorLabels';

type HeadlineScore = EnvironmentalScoreResult | PersonalizedScoreResult;

export interface TodayDecisionSummary {
  score: HeadlineScore;
  scoreKind: 'environmental' | 'personalized';
  title: string;
  interpretation: string;
  mainConcern: string;
  bestWindow: string;
}

function conditionTitle(category: RiskCategoryId): string {
  switch (category) {
    case 'low':
      return translate('today.decision.condition.low');
    case 'moderate':
      return translate('today.decision.condition.moderate');
    case 'high':
      return translate('today.decision.condition.high');
    case 'veryHigh':
      return translate('today.decision.condition.veryHigh');
    case 'unavailable':
      return translate('today.decision.condition.unavailable');
  }
}

function conditionInterpretation(category: RiskCategoryId): string {
  switch (category) {
    case 'low':
      return translate('today.decision.interpretation.low');
    case 'moderate':
      return translate('today.decision.interpretation.moderate');
    case 'high':
      return translate('today.decision.interpretation.high');
    case 'veryHigh':
      return translate('today.decision.interpretation.veryHigh');
    case 'unavailable':
      return translate('today.decision.interpretation.unavailable');
  }
}

function componentForDominantConcern(score: HeadlineScore): ScoreComponent | null {
  if (!score.dominantComponent) return null;
  const components = score.components as Record<string, ScoreComponent>;
  return components[score.dominantComponent] ?? null;
}

function todayMainConcernLabel(score: HeadlineScore): string {
  const contributor = contributorFromScore(score);
  const component = componentForDominantConcern(score);
  const factor = contributor.label ?? translate('common.unavailable');
  if (!component?.available) return factor;
  return `${factor} · ${categoryLabel(component.category)}`;
}

function todayBestOutdoorWindowLabel(
  window: OutdoorWindow | null,
  referenceTime: string | null,
): string {
  if (!window?.available || !window.startTime || !window.endTime) {
    return translate('today.decision.bestWindowUnavailable');
  }
  return formatTimeRangeWithTomorrow(window.startTime, window.endTime, referenceTime);
}

export function todayDecisionSummary(input: {
  environmentalScore: EnvironmentalScoreResult | null;
  environmentalBestOutdoorWindow: OutdoorWindow | null;
  personalizedScore: PersonalizedScoreResult;
  personalizedBestOutdoorWindow: OutdoorWindow | null;
  referenceTime: string | null;
}): TodayDecisionSummary | null {
  const usePersonalized = input.personalizedScore.available;
  const score = usePersonalized ? input.personalizedScore : input.environmentalScore;
  if (!score?.available) return null;

  return {
    score,
    scoreKind: usePersonalized ? 'personalized' : 'environmental',
    title: conditionTitle(score.category),
    interpretation: conditionInterpretation(score.category),
    mainConcern: todayMainConcernLabel(score),
    bestWindow: todayBestOutdoorWindowLabel(
      usePersonalized ? input.personalizedBestOutdoorWindow : input.environmentalBestOutdoorWindow,
      input.referenceTime,
    ),
  };
}

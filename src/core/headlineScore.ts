import type { EnvironmentalScoreResult, PersonalizedScoreResult } from '../models/environment';
import type { HeadlineScoreType } from '../models/notifications';

export interface ActiveHeadlineScore {
  scoreType: HeadlineScoreType;
  score: EnvironmentalScoreResult | PersonalizedScoreResult | null;
}

export function activeHeadlineScore(input: {
  environmentalScore: EnvironmentalScoreResult | null;
  personalizedScore: PersonalizedScoreResult;
}): ActiveHeadlineScore {
  if (input.personalizedScore.available) {
    return {
      scoreType: 'personalized',
      score: input.personalizedScore,
    };
  }

  return {
    scoreType: 'environmental',
    score: input.environmentalScore,
  };
}

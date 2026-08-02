import { SCORE_THRESHOLDS } from './constants';
import type { RiskCategoryId } from '../models/environment';
import { isFiniteNumber } from '../utils/number';

export function categoryFromScore(score: number | null): RiskCategoryId {
  if (!isFiniteNumber(score)) {
    return 'unavailable';
  }

  for (const threshold of SCORE_THRESHOLDS) {
    if (score <= threshold.max) {
      return threshold.category;
    }
  }

  return 'veryHigh';
}

export function categoryLabel(category: RiskCategoryId): string {
  switch (category) {
    case 'low':
      return 'Low';
    case 'moderate':
      return 'Moderate';
    case 'high':
      return 'High';
    case 'veryHigh':
      return 'Very High';
    case 'unavailable':
      return 'Unavailable';
  }
}

export function categoryEmoji(category: RiskCategoryId): string {
  switch (category) {
    case 'low':
      return '🟢';
    case 'moderate':
      return '🟡';
    case 'high':
      return '🟠';
    case 'veryHigh':
      return '🔴';
    case 'unavailable':
      return '⚪';
  }
}

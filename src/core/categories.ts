import { SCORE_THRESHOLDS } from './constants';
import { translate } from '../i18n';
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
      return translate('risk.categories.low');
    case 'moderate':
      return translate('risk.categories.moderate');
    case 'high':
      return translate('risk.categories.high');
    case 'veryHigh':
      return translate('risk.categories.veryHigh');
    case 'unavailable':
      return translate('risk.categories.unavailable');
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

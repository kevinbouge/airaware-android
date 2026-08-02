import type {
  EnvironmentalScoreResult,
  PersonalizedScoreResult,
  ScoreComponent,
} from '../models/environment';
import { IRRITANT_LABELS, POLLEN_LABELS, POLLUTANT_LABELS } from './readingLabels';

type ContributorGroup = 'pollen' | 'pollution' | 'mold' | 'uv' | 'unknown';

export interface ContributorLabel {
  label: string | null;
  group: ContributorGroup;
}

function labelForPollenId(id: string | undefined): string {
  const type = id?.replace(/^pollen_/, '') as keyof typeof POLLEN_LABELS;
  return POLLEN_LABELS[type] ? `${POLLEN_LABELS[type]} pollen` : 'Pollen';
}

function labelForPollutantId(id: string | undefined): string {
  const type = id as keyof typeof POLLUTANT_LABELS;
  return POLLUTANT_LABELS[type] ?? 'Regulated pollution';
}

function labelForIrritantId(id: string | undefined): string {
  const type = id as keyof typeof IRRITANT_LABELS;
  return IRRITANT_LABELS[type] ?? 'Atmospheric irritants';
}

export function contributorFromScore(
  score: EnvironmentalScoreResult | PersonalizedScoreResult | null,
): ContributorLabel {
  if (!score?.dominantComponent) {
    return { label: null, group: 'unknown' };
  }

  const components = score.components as Record<string, ScoreComponent>;
  const component = components[score.dominantComponent];

  switch (score.dominantComponent) {
    case 'pollen':
      return { label: labelForPollenId(component?.dominantId), group: 'pollen' };
    case 'regulatedPollution':
      return { label: labelForPollutantId(component?.dominantId), group: 'pollution' };
    case 'atmosphericIrritants':
      return { label: labelForIrritantId(component?.dominantId), group: 'pollution' };
    case 'mold':
      return { label: 'Mold potential', group: 'mold' };
    case 'uv':
      return { label: 'UV index', group: 'uv' };
    default:
      return { label: null, group: 'unknown' };
  }
}

import { todayDecisionSummary } from '../src/core/todayDecision';
import type {
  EnvironmentalScoreResult,
  OutdoorWindow,
  ScoreComponent,
} from '../src/models/environment';

function component(overrides: Partial<ScoreComponent> = {}): ScoreComponent {
  return {
    available: true,
    score: 42,
    displayScore: 42,
    category: 'moderate',
    missing: [],
    completeness: 1,
    ...overrides,
  };
}

function environmentalScore(): EnvironmentalScoreResult {
  return {
    available: true,
    score: 24,
    displayScore: 24,
    category: 'low',
    components: {
      pollen: component({ dominantId: 'pollen_grass' }),
      regulatedPollution: component({ score: 12, displayScore: 12, category: 'low' }),
      atmosphericIrritants: component({ score: 8, displayScore: 8, category: 'low' }),
      mold: component({ score: 4, displayScore: 4, category: 'low' }),
    },
    effectiveWeights: {},
    missingComponents: [],
    completeness: 1,
    dominantComponent: 'pollen',
  };
}

function outdoorWindow(): OutdoorWindow {
  return {
    available: true,
    startTime: '2026-08-31T18:00:00Z',
    endTime: '2026-08-31T21:00:00Z',
    durationHours: 3,
    averageScore: 18,
    maximumScore: 22,
    category: 'low',
    completeness: 1,
  };
}

describe('Today decision presentation', () => {
  it('summarizes Now, Why, and When from existing environmental semantics', () => {
    const decision = todayDecisionSummary({
      environmentalScore: environmentalScore(),
      environmentalBestOutdoorWindow: outdoorWindow(),
      personalizedScore: {
        available: false,
        score: null,
        displayScore: null,
        category: 'unavailable',
        components: {},
        effectiveWeights: {},
        missingComponents: [],
        selectedGroupCount: 0,
        availableGroupCount: 0,
        dominantComponent: null,
        reason: 'disabled',
      },
      personalizedBestOutdoorWindow: null,
      referenceTime: '2026-08-31T10:00:00Z',
    });

    expect(decision).toMatchObject({
      scoreKind: 'environmental',
      title: 'Good conditions',
      interpretation: 'Good conditions for being outside.',
      mainConcern: 'Grass pollen · Moderate',
      bestWindow: '18:00–21:00',
    });
  });

  it('does not invent a better outdoor window when forecast data is insufficient', () => {
    const decision = todayDecisionSummary({
      environmentalScore: environmentalScore(),
      environmentalBestOutdoorWindow: { ...outdoorWindow(), available: false },
      personalizedScore: {
        available: false,
        score: null,
        displayScore: null,
        category: 'unavailable',
        components: {},
        effectiveWeights: {},
        missingComponents: [],
        selectedGroupCount: 0,
        availableGroupCount: 0,
        dominantComponent: null,
        reason: 'disabled',
      },
      personalizedBestOutdoorWindow: null,
      referenceTime: '2026-08-31T10:00:00Z',
    });

    expect(decision?.bestWindow).toBe('No better window available');
  });
});

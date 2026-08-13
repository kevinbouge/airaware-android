import { isFeatureAvailable } from '../capabilities/features';
import { forecastDaysForCapabilities, forecastDayLimit } from '../capabilities/forecast';
import type { AppCapabilities } from '../capabilities/types';
import { categoryLabel } from './categories';
import { activeHeadlineScore } from './headlineScore';
import type {
  EnvironmentalScoreResult,
  NormalizedEnvironment,
  PersonalizedScoreResult,
} from '../models/environment';
import type { AppSettings } from '../models/profile';
import type {
  WidgetForecastDaySnapshot,
  WidgetRenderModel,
  WidgetScoreSnapshot,
  WidgetSnapshot,
} from '../models/widgets';
import type { EntitlementState } from '../capabilities/entitlements';
import type { DerivedEnvironmentState } from '../state/derivedEnvironment';
import { contributorFromScore } from '../utils/contributorLabels';
import { formatScore, formatTimeRangeWithTomorrow } from '../utils/format';
import { isFiniteNumber } from '../utils/number';

const ADVANCED_WIDGET_FORECAST_DISPLAY_DAYS = 4;

type SelectedWidgetHeadlineScore = {
  type: WidgetScoreSnapshot['type'];
  label: WidgetScoreSnapshot['label'];
  score: EnvironmentalScoreResult | PersonalizedScoreResult | null;
};
type WidgetScoreResult = EnvironmentalScoreResult | PersonalizedScoreResult;

function selectedHeadlineScore(input: {
  environmentalScore: EnvironmentalScoreResult | null;
  personalizedScore: PersonalizedScoreResult;
}): SelectedWidgetHeadlineScore {
  const active = activeHeadlineScore(input);

  if (active.scoreType === 'personalized') {
    return {
      type: 'personalized',
      label: 'Personalized risk',
      score: active.score,
    };
  }

  return {
    type: 'environmental',
    label: 'Environmental burden',
    score: active.score,
  };
}

function forecastScoreForDay(input: {
  day: NormalizedEnvironment['forecastDays'][number];
  currentDate: string | null;
  headlineScoreResult: WidgetScoreResult | null;
  headlineType: WidgetScoreSnapshot['type'];
  personalizedByDate: Map<string, PersonalizedScoreResult | null>;
}): WidgetScoreResult | null | undefined {
  if (input.day.date === input.currentDate && input.headlineScoreResult) {
    return input.headlineScoreResult;
  }

  if (input.headlineType === 'personalized') {
    return input.personalizedByDate.get(input.day.date);
  }

  return input.day.score;
}

function scoreSnapshot(
  type: WidgetScoreSnapshot['type'],
  label: WidgetScoreSnapshot['label'],
  score: EnvironmentalScoreResult | PersonalizedScoreResult | null,
): WidgetScoreSnapshot | null {
  if (!score?.available || !isFiniteNumber(score.score) || score.category === 'unavailable') {
    return null;
  }

  return {
    type,
    label,
    category: score.category,
    categoryLabel: categoryLabel(score.category),
    score: Math.round(score.score),
    scoreLabel: formatScore(score.score),
  };
}

function uvCategoryLabel(value: number | null): string | null {
  if (!isFiniteNumber(value) || value < 0) return null;
  if (value <= 2) return 'Low';
  if (value <= 5) return 'Moderate';
  if (value <= 7) return 'High';
  if (value <= 10) return 'Very High';
  return 'Extreme';
}

function bestOutdoorWindowLabel(
  derived: DerivedEnvironmentState,
  headlineType: WidgetScoreSnapshot['type'],
  referenceTime: string | null,
): string | null {
  const window =
    headlineType === 'personalized'
      ? derived.personalizedBestOutdoorWindow
      : derived.environmentalBestOutdoorWindow;

  if (!window?.available || !window.startTime || !window.endTime) return null;
  return formatTimeRangeWithTomorrow(window.startTime, window.endTime, referenceTime);
}

function forecastDaySnapshots(input: {
  environment: NormalizedEnvironment;
  derived: DerivedEnvironmentState;
  capabilities: AppCapabilities;
  headlineType: WidgetScoreSnapshot['type'];
  headlineScoreResult: EnvironmentalScoreResult | PersonalizedScoreResult | null;
}): WidgetForecastDaySnapshot[] {
  const currentDate = input.environment.current.timestamp?.slice(0, 10) ?? null;
  const personalizedByDate = new Map(
    input.derived.personalizedForecastDays.map((day) => [day.date, day.score]),
  );

  return forecastDaysForCapabilities(input.environment.forecastDays, input.capabilities).flatMap(
    (day) => {
      const score = forecastScoreForDay({
        day,
        currentDate,
        headlineScoreResult: input.headlineScoreResult,
        headlineType: input.headlineType,
        personalizedByDate,
      });

      if (!score?.available || !isFiniteNumber(score.score) || score.category === 'unavailable') {
        return [];
      }

      return [
        {
          label: day.label,
          category: score.category,
          categoryLabel: categoryLabel(score.category),
          scoreLabel: formatScore(score.score),
        },
      ];
    },
  );
}

export function buildWidgetSnapshot(input: {
  environment: NormalizedEnvironment | null;
  derived: DerivedEnvironmentState;
  settings: AppSettings;
  capabilities: AppCapabilities;
  entitlement: EntitlementState;
  stale: boolean;
  generatedAt?: string;
}): WidgetSnapshot {
  const compactAvailable = isFeatureAvailable(input.capabilities, 'compact_home_widget');
  const advancedAvailable = isFeatureAvailable(input.capabilities, 'advanced_home_widget');
  const selected = selectedHeadlineScore({
    environmentalScore: input.derived.environmentalScore,
    personalizedScore: input.derived.personalizedScore,
  });
  const headlineScore = scoreSnapshot(selected.type, selected.label, selected.score);
  const contributor = contributorFromScore(selected.score);

  return {
    version: 1,
    generatedAt: input.generatedAt ?? new Date().toISOString(),
    entitlementKind: input.entitlement.kind,
    compactAvailable,
    advancedAvailable,
    forecastDayLimit: forecastDayLimit(input.capabilities),
    placeName: input.environment?.placeName ?? null,
    showPlaceName: input.settings.summaryLocation === 'place',
    stale: input.stale,
    lastUpdatedAt: input.environment?.fetchedAt ?? null,
    headlineScore,
    mainFactorLabel: contributor.label,
    uvCategoryLabel: uvCategoryLabel(input.environment?.current.uvIndex ?? null),
    bestOutdoorWindowLabel: headlineScore
      ? bestOutdoorWindowLabel(
          input.derived,
          headlineScore.type,
          input.environment?.current.timestamp ?? input.environment?.fetchedAt ?? null,
        )
      : null,
    forecastDays:
      input.environment && headlineScore
        ? forecastDaySnapshots({
            environment: input.environment,
            derived: input.derived,
            capabilities: input.capabilities,
            headlineType: headlineScore.type,
            headlineScoreResult: selected.score,
          })
        : [],
  };
}

function titleFor(snapshot: WidgetSnapshot, pro = false): string {
  const base = pro ? '😷 AirAware Pro' : '😷 AirAware';
  if (snapshot.showPlaceName && snapshot.placeName && !pro)
    return `${base} — ${snapshot.placeName}`;
  if (snapshot.showPlaceName && snapshot.placeName && pro)
    return `😷 AirAware — ${snapshot.placeName}`;
  return base;
}

export function compactWidgetRenderModel(snapshot: WidgetSnapshot | null): WidgetRenderModel {
  if (!snapshot?.compactAvailable) {
    return {
      title: '😷 AirAware',
      destination: 'today',
      locked: false,
      stale: false,
      scoreLine: null,
      mainFactorLine: null,
      uvLine: null,
      bestWindowLine: null,
      forecastLines: [],
      message: 'Open the app to finish setup',
      category: 'unavailable',
    };
  }

  if (!snapshot.headlineScore) {
    return {
      title: titleFor(snapshot),
      destination: 'today',
      locked: false,
      stale: snapshot.stale,
      scoreLine: null,
      mainFactorLine: null,
      uvLine: null,
      bestWindowLine: null,
      forecastLines: [],
      message: 'Open the app to load environmental data',
      category: 'unavailable',
    };
  }

  return {
    title: titleFor(snapshot),
    destination: 'today',
    locked: false,
    stale: snapshot.stale,
    scoreLine: `${snapshot.headlineScore.categoryLabel} · ${snapshot.headlineScore.scoreLabel}`,
    mainFactorLine: snapshot.mainFactorLabel,
    uvLine: snapshot.uvCategoryLabel ? `UV ${snapshot.uvCategoryLabel}` : null,
    bestWindowLine: null,
    forecastLines: [],
    message: snapshot.stale ? 'Cached data' : null,
    category: snapshot.headlineScore.category,
  };
}

export function advancedWidgetRenderModel(snapshot: WidgetSnapshot | null): WidgetRenderModel {
  if (!snapshot?.advancedAvailable) {
    return {
      title: '😷 AirAware Pro',
      destination: 'settings',
      locked: true,
      stale: false,
      scoreLine: null,
      mainFactorLine: null,
      uvLine: null,
      bestWindowLine: null,
      forecastLines: [],
      message: 'Extended home widget\nOpen AirAware to learn more',
      category: 'unavailable',
    };
  }

  if (!snapshot.headlineScore) {
    return {
      title: titleFor(snapshot, true),
      destination: 'forecast',
      locked: false,
      stale: snapshot.stale,
      scoreLine: null,
      mainFactorLine: null,
      uvLine: null,
      bestWindowLine: null,
      forecastLines: [],
      message: 'Open the app to load environmental data',
      category: 'unavailable',
    };
  }

  return {
    title: titleFor(snapshot, true),
    destination: 'forecast',
    locked: false,
    stale: snapshot.stale,
    scoreLine: `${snapshot.headlineScore.label}\n${snapshot.headlineScore.categoryLabel} · ${snapshot.headlineScore.scoreLabel}`,
    mainFactorLine: snapshot.mainFactorLabel ? `Main factor\n${snapshot.mainFactorLabel}` : null,
    uvLine: null,
    bestWindowLine: snapshot.bestOutdoorWindowLabel
      ? `Best outdoor window\n${snapshot.bestOutdoorWindowLabel}`
      : null,
    forecastLines: snapshot.forecastDays
      .slice(0, ADVANCED_WIDGET_FORECAST_DISPLAY_DAYS)
      .map((day) => `${day.label} ${day.categoryLabel} · ${day.scoreLabel}`),
    message: snapshot.stale ? 'Cached data' : null,
    category: snapshot.headlineScore.category,
  };
}

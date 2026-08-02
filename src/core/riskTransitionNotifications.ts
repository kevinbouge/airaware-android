import { categoryLabel } from './categories';
import type {
  Coordinates,
  EnvironmentalScoreResult,
  PersonalizedScoreResult,
  RiskCategoryId,
} from '../models/environment';
import type {
  HeadlineScoreType,
  NotificationPermissionStatus,
  RiskNotificationTransitionState,
  RiskTransition,
} from '../models/notifications';
import type { AppSettings, PersonalAllergyProfile } from '../models/profile';
import { displayScore, isFiniteNumber } from '../utils/number';

interface HeadlineScoreSelection {
  scoreType: HeadlineScoreType;
  score: EnvironmentalScoreResult | PersonalizedScoreResult | null;
  fallbackUsed: boolean;
}

interface TransitionContext {
  locationKey: string;
  profileFingerprint: string | null;
}

interface EvaluateRiskTransitionInput {
  settings: AppSettings;
  capabilityAvailable: boolean;
  permissionStatus: NotificationPermissionStatus;
  environmentalScore: EnvironmentalScoreResult | null;
  personalizedScore: PersonalizedScoreResult;
  previousState: RiskNotificationTransitionState | null;
  coordinates: Coordinates;
  placeName: string | null;
  profile: PersonalAllergyProfile;
  observationKey: string;
  now: string;
}

export interface RiskTransitionEvaluation {
  transition: RiskTransition | null;
  nextState: RiskNotificationTransitionState | null;
  reason:
    | 'disabled'
    | 'capability_unavailable'
    | 'permission_not_granted'
    | 'unavailable_score'
    | 'baseline_created'
    | 'context_changed'
    | 'duplicate_observation'
    | 'unchanged'
    | 'not_escalation'
    | 'below_threshold'
    | 'transition';
}

export interface RiskNotificationContent {
  title: string;
  body: string;
}

function validCategory(
  category: RiskCategoryId,
): category is Exclude<RiskCategoryId, 'unavailable'> {
  return category !== 'unavailable';
}

function enteredConfiguredThreshold(
  category: RiskCategoryId,
  threshold: AppSettings['riskTransitionNotificationThreshold'],
): boolean {
  if (threshold === 'veryHighOnly') return category === 'veryHigh';
  return category === 'high' || category === 'veryHigh';
}

function categoryRank(category: Exclude<RiskCategoryId, 'unavailable'>): number {
  switch (category) {
    case 'low':
      return 1;
    case 'moderate':
      return 2;
    case 'high':
      return 3;
    case 'veryHigh':
      return 4;
  }
}

export function riskNotificationLocationKey(coordinates: Coordinates): string {
  return `${coordinates.latitude.toFixed(3)},${coordinates.longitude.toFixed(3)}`;
}

export function riskNotificationObservationKey(input: {
  fetchedAt: string;
  currentTimestamp: string | null;
  airQualityFetchedAt: string | null;
  weatherFetchedAt: string | null;
}): string {
  return [
    input.fetchedAt,
    input.currentTimestamp ?? 'no-current-time',
    input.airQualityFetchedAt ?? 'no-air-quality',
    input.weatherFetchedAt ?? 'no-weather',
  ].join('|');
}

export function personalAllergyProfileFingerprint(profile: PersonalAllergyProfile): string {
  const factors = Object.keys(profile.factors)
    .sort()
    .map(
      (factor) =>
        `${factor}:${profile.factors[factor as keyof typeof profile.factors] ? '1' : '0'}`,
    )
    .join('|');

  return `v1|enabled:${profile.enabled ? '1' : '0'}|${factors}`;
}

export function activeHeadlineScore(input: {
  settings: Pick<AppSettings, 'headlineScore'>;
  environmentalScore: EnvironmentalScoreResult | null;
  personalizedScore: PersonalizedScoreResult;
}): HeadlineScoreSelection {
  if (input.settings.headlineScore === 'personalized' && input.personalizedScore.available) {
    return {
      scoreType: 'personalized',
      score: input.personalizedScore,
      fallbackUsed: false,
    };
  }

  return {
    scoreType: 'environmental',
    score: input.environmentalScore,
    fallbackUsed: input.settings.headlineScore === 'personalized',
  };
}

function transitionContext(input: {
  scoreType: HeadlineScoreType;
  coordinates: Coordinates;
  profile: PersonalAllergyProfile;
}): TransitionContext {
  return {
    locationKey: riskNotificationLocationKey(input.coordinates),
    profileFingerprint:
      input.scoreType === 'personalized' ? personalAllergyProfileFingerprint(input.profile) : null,
  };
}

function stateFor(input: {
  category: Exclude<RiskCategoryId, 'unavailable'>;
  scoreType: HeadlineScoreType;
  context: TransitionContext;
  observationKey: string;
  lastDeliveredObservationKey: string | null;
  now: string;
}): RiskNotificationTransitionState {
  return {
    version: 1,
    previousCategory: input.category,
    previousScoreType: input.scoreType,
    locationKey: input.context.locationKey,
    profileFingerprint: input.context.profileFingerprint,
    lastObservationKey: input.observationKey,
    lastDeliveredObservationKey: input.lastDeliveredObservationKey,
    evaluatedAt: input.now,
  };
}

function compatible(
  previousState: RiskNotificationTransitionState,
  scoreType: HeadlineScoreType,
  context: TransitionContext,
): boolean {
  return (
    previousState.version === 1 &&
    previousState.previousScoreType === scoreType &&
    previousState.locationKey === context.locationKey &&
    previousState.profileFingerprint === context.profileFingerprint
  );
}

export function evaluateRiskTransition(
  input: EvaluateRiskTransitionInput,
): RiskTransitionEvaluation {
  if (!input.settings.riskTransitionNotificationsEnabled) {
    return { transition: null, nextState: input.previousState, reason: 'disabled' };
  }

  if (!input.capabilityAvailable) {
    return { transition: null, nextState: input.previousState, reason: 'capability_unavailable' };
  }

  const active = activeHeadlineScore(input);
  const score = active.score?.score ?? null;
  const category = active.score?.category ?? 'unavailable';

  if (!active.score?.available || !isFiniteNumber(score) || !validCategory(category)) {
    return { transition: null, nextState: input.previousState, reason: 'unavailable_score' };
  }

  const context = transitionContext({
    scoreType: active.scoreType,
    coordinates: input.coordinates,
    profile: input.profile,
  });
  const nextState = stateFor({
    category,
    scoreType: active.scoreType,
    context,
    observationKey: input.observationKey,
    lastDeliveredObservationKey: input.previousState?.lastDeliveredObservationKey ?? null,
    now: input.now,
  });

  if (!input.previousState) {
    return { transition: null, nextState, reason: 'baseline_created' };
  }

  if (!compatible(input.previousState, active.scoreType, context)) {
    return { transition: null, nextState, reason: 'context_changed' };
  }

  if (input.previousState.lastObservationKey === input.observationKey) {
    return { transition: null, nextState: input.previousState, reason: 'duplicate_observation' };
  }

  if (input.previousState.previousCategory === category) {
    return { transition: null, nextState, reason: 'unchanged' };
  }

  if (!enteredConfiguredThreshold(category, input.settings.riskTransitionNotificationThreshold)) {
    return { transition: null, nextState, reason: 'below_threshold' };
  }

  if (categoryRank(category) <= categoryRank(input.previousState.previousCategory)) {
    return { transition: null, nextState, reason: 'not_escalation' };
  }

  if (input.previousState.lastDeliveredObservationKey === input.observationKey) {
    return { transition: null, nextState: input.previousState, reason: 'duplicate_observation' };
  }

  if (input.permissionStatus !== 'granted') {
    return { transition: null, nextState, reason: 'permission_not_granted' };
  }

  const transition: RiskTransition = {
    scoreType: active.scoreType,
    previousCategory: input.previousState.previousCategory,
    currentCategory: category,
    currentScore: score,
    occurredAt: input.now,
  };

  if (input.placeName) {
    transition.locationLabel = input.placeName;
  }

  return {
    transition,
    nextState: {
      ...nextState,
      lastDeliveredObservationKey: input.observationKey,
    },
    reason: 'transition',
  };
}

export function formatRiskTransitionNotification(
  transition: RiskTransition,
): RiskNotificationContent {
  const category = categoryLabel(transition.currentCategory);
  const score = displayScore(transition.currentScore);
  const locationSuffix = transition.locationLabel ? ` in ${transition.locationLabel}` : '';

  if (transition.scoreType === 'personalized') {
    return {
      title: `Personalized risk is now ${category}`,
      body: `Personalized environmental risk reached ${score}%${locationSuffix}.`,
    };
  }

  return {
    title: `AirAware risk is now ${category}`,
    body: `Environmental burden reached ${score}%${locationSuffix}.`,
  };
}

export function riskTransitionStateAfterDeliveryAttempt(input: {
  nextState: RiskNotificationTransitionState | null;
  previousState: RiskNotificationTransitionState | null;
  transition: RiskTransition | null;
  delivered: boolean;
}): RiskNotificationTransitionState | null {
  if (!input.nextState) return null;
  if (!input.transition || input.delivered) return input.nextState;

  return input.previousState;
}

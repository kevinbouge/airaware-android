import {
  activeHeadlineScore,
  evaluateRiskTransition,
  formatRiskTransitionNotification,
  personalAllergyProfileFingerprint,
  riskNotificationObservationKey,
  riskNotificationLocationKey,
  riskTransitionStateAfterDeliveryAttempt,
} from '../src/core/riskTransitionNotifications';
import type {
  EnvironmentalScoreResult,
  PersonalizedScoreResult,
  RiskCategoryId,
} from '../src/models/environment';
import type { RiskNotificationTransitionState } from '../src/models/notifications';
import { DEFAULT_PROFILE, DEFAULT_SETTINGS } from '../src/models/profile';

const coordinates = { latitude: 50.0755, longitude: 14.4378 };
const now = '2026-08-01T12:00:00Z';
const observationKey = riskNotificationObservationKey({
  fetchedAt: '2026-08-01T12:00:00Z',
  currentTimestamp: '2026-08-01T14:00:00+02:00',
  airQualityFetchedAt: '2026-08-01T12:00:00Z',
  weatherFetchedAt: '2026-08-01T12:00:00Z',
});

function score(category: RiskCategoryId, value: number): EnvironmentalScoreResult {
  return {
    available: true,
    score: value,
    displayScore: Math.round(value),
    category,
    components: {} as EnvironmentalScoreResult['components'],
    effectiveWeights: {},
    missingComponents: [],
    completeness: 1,
    dominantComponent: null,
  };
}

function personalized(category: RiskCategoryId, value: number): PersonalizedScoreResult {
  return {
    available: true,
    score: value,
    displayScore: Math.round(value),
    category,
    components: {},
    effectiveWeights: {},
    missingComponents: [],
    selectedGroupCount: 1,
    availableGroupCount: 1,
    dominantComponent: null,
  };
}

function state(category: Exclude<RiskCategoryId, 'unavailable'>): RiskNotificationTransitionState {
  return {
    version: 1,
    previousCategory: category,
    previousScoreType: 'environmental',
    locationKey: riskNotificationLocationKey(coordinates),
    profileFingerprint: null,
    lastObservationKey: 'previous-observation',
    lastDeliveredObservationKey: null,
    evaluatedAt: '2026-08-01T11:00:00Z',
  };
}

function evaluate(
  input: Partial<Parameters<typeof evaluateRiskTransition>[0]> & {
    environmentalScore?: EnvironmentalScoreResult | null;
    personalizedScore?: PersonalizedScoreResult;
  },
) {
  return evaluateRiskTransition({
    settings: { ...DEFAULT_SETTINGS, riskTransitionNotificationsEnabled: true },
    capabilityAvailable: true,
    permissionStatus: 'granted',
    environmentalScore: score('high', 72),
    personalizedScore: { ...personalized('high', 72), available: false },
    previousState: state('moderate'),
    coordinates,
    placeName: 'Prague',
    profile: DEFAULT_PROFILE,
    observationKey,
    now,
    ...input,
  });
}

describe('risk transition notifications', () => {
  it('does not notify when notifications are disabled', () => {
    const result = evaluate({
      settings: DEFAULT_SETTINGS,
    });

    expect(result.transition).toBeNull();
    expect(result.reason).toBe('disabled');
  });

  it('creates a baseline without notifying on first valid score', () => {
    const result = evaluate({
      previousState: null,
    });

    expect(result.transition).toBeNull();
    expect(result.reason).toBe('baseline_created');
    expect(result.nextState?.previousCategory).toBe('high');
  });

  it('notifies when the headline score enters High from a different category', () => {
    const result = evaluate({});

    expect(result.reason).toBe('transition');
    expect(result.transition).toMatchObject({
      scoreType: 'environmental',
      previousCategory: 'moderate',
      currentCategory: 'high',
      locationLabel: 'Prague',
    });
  });

  it('does not repeatedly notify while the category is unchanged', () => {
    const result = evaluate({
      environmentalScore: score('high', 76),
      previousState: state('high'),
    });

    expect(result.transition).toBeNull();
    expect(result.reason).toBe('unchanged');
  });

  it('honors the Very High only threshold', () => {
    const settings = {
      ...DEFAULT_SETTINGS,
      riskTransitionNotificationsEnabled: true,
      riskTransitionNotificationThreshold: 'veryHighOnly' as const,
    };

    expect(
      evaluate({
        settings,
        environmentalScore: score('high', 76),
        placeName: null,
      }).reason,
    ).toBe('below_threshold');

    expect(
      evaluate({
        settings,
        environmentalScore: score('veryHigh', 90),
        placeName: null,
      }).reason,
    ).toBe('transition');
  });

  it('resets the baseline when the effective location changes', () => {
    const result = evaluate({
      coordinates: { latitude: 40.7128, longitude: -74.006 },
      placeName: 'New York',
    });

    expect(result.transition).toBeNull();
    expect(result.reason).toBe('context_changed');
    expect(result.nextState?.previousCategory).toBe('high');
  });

  it('uses personalized transitions when personalized is the active headline score', () => {
    const profile = { ...DEFAULT_PROFILE, enabled: true };
    const previousState: RiskNotificationTransitionState = {
      version: 1,
      previousCategory: 'moderate',
      previousScoreType: 'personalized',
      locationKey: riskNotificationLocationKey(coordinates),
      profileFingerprint: personalAllergyProfileFingerprint(profile),
      lastObservationKey: 'previous-observation',
      lastDeliveredObservationKey: null,
      evaluatedAt: '2026-08-01T11:00:00Z',
    };
    const result = evaluate({
      settings: {
        ...DEFAULT_SETTINGS,
        headlineScore: 'personalized',
        riskTransitionNotificationsEnabled: true,
      },
      environmentalScore: score('low', 20),
      personalizedScore: personalized('high', 72),
      previousState,
      profile,
    });

    expect(result.transition?.scoreType).toBe('personalized');
    expect(result.reason).toBe('transition');
  });

  it('falls back to environmental headline score when personalized is unavailable', () => {
    const result = activeHeadlineScore({
      settings: { ...DEFAULT_SETTINGS, headlineScore: 'personalized' },
      environmentalScore: score('moderate', 52),
      personalizedScore: { ...personalized('high', 72), available: false },
    });

    expect(result.scoreType).toBe('environmental');
    expect(result.fallbackUsed).toBe(true);
  });

  it('does not notify for Low to Moderate or Very High to High transitions', () => {
    expect(
      evaluate({
        environmentalScore: score('moderate', 45),
        previousState: state('low'),
      }).reason,
    ).toBe('below_threshold');

    expect(
      evaluate({
        environmentalScore: score('high', 76),
        previousState: state('veryHigh'),
      }).reason,
    ).toBe('not_escalation');
  });

  it('does not notify for missing or unavailable scores', () => {
    expect(
      evaluate({
        environmentalScore: null,
      }).reason,
    ).toBe('unavailable_score');

    expect(
      evaluate({
        environmentalScore: { ...score('unavailable', 0), available: false, score: null },
      }).reason,
    ).toBe('unavailable_score');
  });

  it('does not notify for entry into High when permission is denied, but advances baseline', () => {
    const result = evaluate({ permissionStatus: 'denied' });

    expect(result.transition).toBeNull();
    expect(result.reason).toBe('permission_not_granted');
    expect(result.nextState?.previousCategory).toBe('high');
  });

  it('does not evaluate when the basic notification capability is unavailable', () => {
    const result = evaluate({ capabilityAvailable: false });

    expect(result.transition).toBeNull();
    expect(result.reason).toBe('capability_unavailable');
    expect(result.nextState).toEqual(state('moderate'));
  });

  it('does not notify twice for the same successful observation', () => {
    const previousState = {
      ...state('moderate'),
      lastObservationKey: observationKey,
    };
    const result = evaluate({ previousState });

    expect(result.transition).toBeNull();
    expect(result.reason).toBe('duplicate_observation');
    expect(result.nextState).toEqual(previousState);
  });

  it('resets baseline when headline score mode changes', () => {
    const previousState = {
      ...state('moderate'),
      previousScoreType: 'personalized' as const,
    };
    const result = evaluate({ previousState });

    expect(result.transition).toBeNull();
    expect(result.reason).toBe('context_changed');
    expect(result.nextState?.previousScoreType).toBe('environmental');
  });

  it('resets personalized baseline when profile context changes', () => {
    const oldProfile = { ...DEFAULT_PROFILE, enabled: true };
    const newProfile = {
      ...oldProfile,
      factors: {
        ...oldProfile.factors,
        pollen_grass: false,
      },
    };
    const previousState: RiskNotificationTransitionState = {
      version: 1,
      previousCategory: 'moderate',
      previousScoreType: 'personalized',
      locationKey: riskNotificationLocationKey(coordinates),
      profileFingerprint: personalAllergyProfileFingerprint(oldProfile),
      lastObservationKey: 'previous-observation',
      lastDeliveredObservationKey: null,
      evaluatedAt: '2026-08-01T11:00:00Z',
    };
    const result = evaluate({
      settings: {
        ...DEFAULT_SETTINGS,
        headlineScore: 'personalized',
        riskTransitionNotificationsEnabled: true,
      },
      personalizedScore: personalized('high', 72),
      previousState,
      profile: newProfile,
    });

    expect(result.transition).toBeNull();
    expect(result.reason).toBe('context_changed');
    expect(result.nextState?.profileFingerprint).toBe(
      personalAllergyProfileFingerprint(newProfile),
    );
  });

  it('does not suppress a genuine High to Very High escalation', () => {
    const result = evaluate({
      environmentalScore: score('veryHigh', 88),
      previousState: state('high'),
    });

    expect(result.reason).toBe('transition');
    expect(result.transition?.previousCategory).toBe('high');
    expect(result.transition?.currentCategory).toBe('veryHigh');
  });

  it('formats notification text without coordinates or medical claims', () => {
    const message = formatRiskTransitionNotification({
      scoreType: 'environmental',
      previousCategory: 'moderate',
      currentCategory: 'high',
      currentScore: 68.2,
      occurredAt: now,
      locationLabel: 'Prague',
    });

    expect(message.title).toBe('AirAware risk is now High');
    expect(message.body).toBe('Environmental burden reached 68% in Prague.');
    expect(message.body).not.toContain('50.0755');
    expect(message.body).not.toMatch(/symptom|diagnos|medical/i);
  });

  it('does not mark an observation delivered when local delivery fails', () => {
    const previousState = state('moderate');
    const result = evaluate({ previousState });
    const nextState = riskTransitionStateAfterDeliveryAttempt({
      nextState: result.nextState,
      previousState,
      transition: result.transition,
      delivered: false,
    });

    expect(result.reason).toBe('transition');
    expect(result.nextState?.lastDeliveredObservationKey).toBe(observationKey);
    expect(nextState).toEqual(previousState);
  });

  it('marks an observation delivered only after local delivery succeeds', () => {
    const previousState = state('moderate');
    const result = evaluate({ previousState });
    const nextState = riskTransitionStateAfterDeliveryAttempt({
      nextState: result.nextState,
      previousState,
      transition: result.transition,
      delivered: true,
    });

    expect(nextState?.lastDeliveredObservationKey).toBe(observationKey);
  });
});

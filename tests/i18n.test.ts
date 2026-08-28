import { appLocale, i18n, resources, setAppLanguagePreference, translate } from '../src/i18n';
import {
  effectiveLocaleForPreference,
  resolveSupportedLocale,
  validLanguagePreference,
} from '../src/i18n/locale';
import {
  environmentalEventBody,
  environmentalEventCategoryLabel,
  environmentalEventNotificationStateAfterDelivery,
  environmentalEventNeedsNotification,
  environmentalEventTitle,
} from '../src/core/environmentalEvents';
import { formatRiskTransitionNotification } from '../src/core/riskTransitionNotifications';
import { categoryLabel } from '../src/core/categories';
import { activityProfile } from '../src/core/activityDefinitions';
import { formatMeasurement } from '../src/utils/format';
import { DEFAULT_SETTINGS } from '../src/models/profile';
import type { EnvironmentalEvent } from '../src/models/environmentalEvents';

function flattenKeys(value: unknown, prefix = ''): string[] {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return [prefix];

  return Object.entries(value).flatMap(([key, nested]) =>
    flattenKeys(nested, prefix ? `${prefix}.${key}` : key),
  );
}

const pollenEvent: EnvironmentalEvent = {
  id: 'current:pollen:grass:very-high:2026-08-25T13:00:00.000Z',
  type: 'pollen',
  severity: 'very-high',
  locationId: 'current',
  startTime: '2026-08-25T13:00:00.000Z',
  endTime: '2026-08-25T13:00:00.000Z',
  peakTime: '2026-08-25T13:00:00.000Z',
  factor: 'grass',
  evidence: [],
  title: 'Grass pollen',
  body: 'Grass pollen is expected to become Very High around 13:00.',
};

describe('i18n locale resolution', () => {
  afterEach(async () => {
    setAppLanguagePreference('en');
    await i18n.changeLanguage('en');
  });

  it('resolves supported regional locales and falls back to English', () => {
    expect(resolveSupportedLocale('fr-FR')).toBe('fr');
    expect(resolveSupportedLocale('fr-CA')).toBe('fr');
    expect(resolveSupportedLocale('en-US')).toBe('en');
    expect(resolveSupportedLocale('es-ES')).toBe('en');
  });

  it('respects manual language preferences over the detected device locale', () => {
    expect(effectiveLocaleForPreference('en', 'fr')).toBe('en');
    expect(effectiveLocaleForPreference('fr', 'en')).toBe('fr');
    expect(effectiveLocaleForPreference('system', 'fr')).toBe('fr');
  });

  it('validates persisted language preferences safely', () => {
    expect(validLanguagePreference('system')).toBe('system');
    expect(validLanguagePreference('fr')).toBe('fr');
    expect(validLanguagePreference('es')).toBe('system');
    expect(validLanguagePreference(null)).toBe('system');
  });
});

describe('i18n resources', () => {
  it('keeps English and French translation keys in parity', () => {
    const enKeys = flattenKeys(resources.en.translation).sort();
    const frKeys = flattenKeys(resources.fr.translation).sort();

    expect(frKeys).toEqual(enKeys);
  });

  it('translates core risk, activity and health terminology', async () => {
    setAppLanguagePreference('fr');
    await i18n.changeLanguage('fr');

    expect(appLocale()).toBe('fr');
    expect(categoryLabel('veryHigh')).toBe('Très élevé');
    expect(translate('activities.droneOperations')).toBe('Opérations de drone');
    expect(translate('health.influenza')).toBe('Grippe');
    expect(translate('health.rsv')).toBe('VRS');
    expect(translate('health.ambientDoseRate')).toBe('Rayonnement ambiant');
    expect(translate('health.radiological.status.normalBackground')).toBe(
      'Conforme au niveau de fond local',
    );
  });

  it('localizes Activity rule labels and copy through covered keys', async () => {
    setAppLanguagePreference('fr');
    await i18n.changeLanguage('fr');

    const spraying = activityProfile('agriculture_spraying');

    expect(spraying?.label).toBe('Pulvérisation');
    expect(spraying?.rules[0]?.label).toBe('Vent');
    expect(spraying?.rules[0]?.positiveText).toBe('Vent léger');
    expect(spraying?.rules[0]?.negativeText).toBe('Vent trop fort');
  });

  it('formats percentages with locale-aware spacing', async () => {
    setAppLanguagePreference('en');
    await i18n.changeLanguage('en');
    expect(formatMeasurement(12.5, '%', 1)).toBe('12.5%');

    setAppLanguagePreference('fr');
    await i18n.changeLanguage('fr');
    expect(formatMeasurement(12.5, '%', 1)).toBe('12,5 %');
  });
});

describe('localized event and notification presentation', () => {
  afterEach(async () => {
    setAppLanguagePreference('en');
    await i18n.changeLanguage('en');
  });

  it('formats environmental events in English and French', async () => {
    setAppLanguagePreference('en');
    await i18n.changeLanguage('en');
    expect(environmentalEventTitle(pollenEvent)).toBe('Grass pollen');
    expect(environmentalEventBody(pollenEvent)).toContain('Grass pollen is expected');
    expect(environmentalEventCategoryLabel(pollenEvent)).toBe('Very High');

    setAppLanguagePreference('fr');
    await i18n.changeLanguage('fr');
    expect(environmentalEventTitle(pollenEvent)).toBe('Pollen de graminées');
    expect(environmentalEventBody(pollenEvent)).toContain('Pollen de graminées');
    expect(environmentalEventCategoryLabel(pollenEvent)).toBe('Très élevé');
  });

  it('localizes risk notification copy without changing semantic notification deduplication', async () => {
    setAppLanguagePreference('fr');
    await i18n.changeLanguage('fr');

    const notification = formatRiskTransitionNotification({
      scoreType: 'personalized',
      previousCategory: 'moderate',
      currentCategory: 'veryHigh',
      currentScore: 82,
      occurredAt: '2026-08-25T12:00:00.000Z',
      locationLabel: 'Prague',
    });

    expect(notification.title).toContain('Risque personnalisé');
    expect(notification.body).toContain('82 %');

    const state = environmentalEventNotificationStateAfterDelivery({
      event: pollenEvent,
      state: null,
      deliveredAt: '2026-08-25T12:10:00.000Z',
    });

    setAppLanguagePreference('en');
    await i18n.changeLanguage('en');

    expect(
      environmentalEventNeedsNotification({
        event: pollenEvent,
        settings: {
          ...DEFAULT_SETTINGS,
          environmentalEventNotifications: {
            ...DEFAULT_SETTINGS.environmentalEventNotifications,
            pollen: true,
          },
        },
        state,
        now: new Date('2026-08-25T12:15:00.000Z'),
      }),
    ).toBe(false);
  });
});

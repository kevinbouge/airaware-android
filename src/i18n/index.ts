import i18next from 'i18next';
import { initReactI18next } from 'react-i18next';
import { en } from './locales/en';
import { fr } from './locales/fr';
import {
  FALLBACK_LOCALE,
  SUPPORTED_LOCALES,
  deviceLocale,
  effectiveLocaleForPreference,
} from './locale';
import type { LanguagePreference, SupportedLocale } from './types';

export const resources = {
  en: { translation: en },
  fr: { translation: fr },
} as const;

let currentPreference: LanguagePreference = 'system';
let currentLocale: SupportedLocale = deviceLocale();
const i18nInstance = i18next;

void i18nInstance.use(initReactI18next).init({
  compatibilityJSON: 'v4',
  fallbackLng: FALLBACK_LOCALE,
  interpolation: { escapeValue: false },
  lng: currentLocale,
  resources,
  supportedLngs: [...SUPPORTED_LOCALES],
});

export { i18nInstance as i18n };

export function appLocale(): SupportedLocale {
  return currentLocale;
}

export function setAppLanguagePreference(
  preference: LanguagePreference,
  detectedLocale = deviceLocale(),
): SupportedLocale {
  currentPreference = preference;
  currentLocale = effectiveLocaleForPreference(preference, detectedLocale);
  void i18nInstance.changeLanguage(currentLocale);
  return currentLocale;
}

export function refreshSystemLocale(): SupportedLocale {
  if (currentPreference !== 'system') return currentLocale;
  currentLocale = deviceLocale();
  void i18nInstance.changeLanguage(currentLocale);
  return currentLocale;
}

export function translate(key: string, options?: Record<string, unknown>): string {
  if (options) return i18nInstance.t(key, options);
  return i18nInstance.t(key);
}

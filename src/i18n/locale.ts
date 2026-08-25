import { getLocales } from 'expo-localization';
import type { LanguagePreference, SupportedLocale } from './types';

export const FALLBACK_LOCALE: SupportedLocale = 'en';
export const SUPPORTED_LOCALES: readonly SupportedLocale[] = ['en', 'fr'];

export function resolveSupportedLocale(locale: string | null | undefined): SupportedLocale {
  const language = locale?.trim().split(/[-_]/)[0]?.toLowerCase();
  if (language === 'fr') return 'fr';
  if (language === 'en') return 'en';
  return FALLBACK_LOCALE;
}

export function deviceLocale(): SupportedLocale {
  try {
    return resolveSupportedLocale(getLocales()[0]?.languageTag ?? getLocales()[0]?.languageCode);
  } catch {
    return FALLBACK_LOCALE;
  }
}

export function effectiveLocaleForPreference(
  preference: LanguagePreference,
  detectedLocale = deviceLocale(),
): SupportedLocale {
  if (preference === 'system') return detectedLocale;
  return resolveSupportedLocale(preference);
}

export function validLanguagePreference(value: unknown): LanguagePreference {
  return value === 'system' || value === 'en' || value === 'fr' ? value : 'system';
}

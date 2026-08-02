export const GOOGLE_PLAY_PRIVACY_DISCLOSURE = [
  'AirAware does not use analytics, advertising identifiers, accounts, telemetry, or cloud sync.',
  'AirAware uses approximate foreground location or manual coordinates to retrieve local environmental conditions.',
  'Coordinates are sent to Open-Meteo over HTTPS for environmental data.',
  'When the manual map picker is shown, OpenStreetMap tile servers receive requests for the visible map area.',
  'Personal Allergy Profile selections, cached environmental data, and settings stay on this device.',
  'Shared summaries are generated locally and passed only to the Android share sheet when you choose to share.',
  'Android widgets display locally cached AirAware data and do not fetch environmental providers independently.',
  'AirAware does not sell personal or sensitive user data.',
  'AirAware does not predict symptoms, diagnose allergies, provide medical advice, or guarantee safe conditions.',
  'AirAware does not request background location.',
  'Because AirAware has no account or server-side user profile, clearing app storage or uninstalling the app removes locally stored settings, cache, and profile selections.',
] as const;

export function googlePlayPrivacyDisclosureText(): string {
  return GOOGLE_PLAY_PRIVACY_DISCLOSURE.join('\n\n');
}

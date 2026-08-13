export const APP_DISCLAIMER_LINES = [
  'AirAware reports environmental conditions only.',
  'AirAware does not predict symptoms, diagnose allergies, provide medical advice, or guarantee safe conditions.',
  'Personalized risk uses only the environmental factors selected in the Personal Allergy Profile.',
  'Activity profiles provide environmental guidance only and do not replace local rules, manufacturer limits, professional judgment, crop-specific guidance, occupational safety certification, or observatory-grade forecasts.',
  'Nearby vegetation reflects mapped OpenStreetMap context. Missing mapped features do not mean vegetation is absent.',
] as const;

export function appDisclaimerText(): string {
  return APP_DISCLAIMER_LINES.join('\n\n');
}

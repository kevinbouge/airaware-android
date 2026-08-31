export const APP_DISCLAIMER_LINES = [
  'AirAware reports environmental conditions and public population-level health context only.',
  'AirAware does not predict symptoms, diagnose allergies, estimate individual infection or mortality risk, provide medical advice, or guarantee safe conditions.',
  'Personalized risk uses only the environmental factors selected in the Personal Allergy Profile.',
  'Health context signals are delayed public surveillance or monitoring data and are not personal medical, outbreak, or safety determinations.',
  'Activity profiles provide environmental guidance only and do not replace local rules, manufacturer limits, professional judgment, crop-specific guidance, occupational safety certification, or observatory-grade forecasts.',
  'Nearby vegetation reflects mapped OpenStreetMap context. Missing mapped features do not mean vegetation is absent.',
] as const;

export function appDisclaimerText(): string {
  return APP_DISCLAIMER_LINES.join('\n\n');
}

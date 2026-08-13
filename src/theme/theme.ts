import type { RiskCategoryId } from '../models/environment';

export const colors = {
  background: '#F4F6F3',
  surface: '#FFFFFF',
  text: '#17201A',
  muted: '#617166',
  border: '#D9E0DA',
  bestHighlight: '#F2E8CF',
  forecastTrack: '#E6ECE7',
  pressedSurface: '#EEF3EF',
  primary: '#2F6F4F',
  low: '#2E7D32',
  moderate: '#B68B00',
  high: '#C45F12',
  veryHigh: '#C62828',
  unavailable: '#6F7470',
};

export function riskColor(category: RiskCategoryId): string {
  return colors[category] ?? colors.unavailable;
}

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
};

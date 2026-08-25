import type {
  AtmosphericIrritants,
  PollenReadings,
  RegulatedPollutants,
} from '../models/environment';
import { translate } from '../i18n';

export const POLLEN_LABELS: Record<keyof PollenReadings, string> = {
  alder: 'Alder',
  birch: 'Birch',
  grass: 'Grass',
  mugwort: 'Mugwort',
  olive: 'Olive',
  ragweed: 'Ragweed',
};

export const POLLUTANT_LABELS: Record<keyof RegulatedPollutants, string> = {
  pm25: 'PM2.5',
  pm10: 'PM10',
  nitrogenDioxide: 'NO₂',
  ozone: 'O₃',
  sulphurDioxide: 'SO₂',
};

export const IRRITANT_LABELS: Record<keyof AtmosphericIrritants, string> = {
  carbonMonoxide: 'Carbon monoxide',
  aerosolOpticalDepth: 'Atmospheric haze',
  dust: 'Dust',
  wildfirePm10: 'Smoke-related PM10',
};

export function pollenLabel(id: keyof PollenReadings): string {
  return translate(`environment.pollen.${id}`);
}

export function pollutantLabel(id: keyof RegulatedPollutants): string {
  return translate(`environment.pollutants.${id}`);
}

export function irritantLabel(id: keyof AtmosphericIrritants): string {
  return translate(`environment.irritants.${id}`);
}

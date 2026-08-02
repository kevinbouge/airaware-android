import { MOLD_WEIGHTS } from './constants';
import { categoryFromScore } from './categories';
import type { MoldPotential, WeatherInputs } from '../models/environment';
import { clamp, displayScore, isFiniteNumber, weightedAverage } from '../utils/number';

function scale(
  value: number,
  inMin: number,
  inMax: number,
  outMin: number,
  outMax: number,
): number {
  if (value <= inMin) {
    return outMin;
  }
  if (value >= inMax) {
    return outMax;
  }
  return outMin + ((value - inMin) / (inMax - inMin)) * (outMax - outMin);
}

function humidityBurden(relativeHumidity: number | null): number | null {
  if (!isFiniteNumber(relativeHumidity)) return null;
  if (relativeHumidity < 50) return 0;
  if (relativeHumidity <= 65) return scale(relativeHumidity, 50, 65, 0, 40);
  if (relativeHumidity <= 80) return scale(relativeHumidity, 65, 80, 40, 80);
  return scale(Math.min(relativeHumidity, 100), 80, 100, 80, 100);
}

function precipitationBurden(precipitationMm: number | null): number | null {
  if (!isFiniteNumber(precipitationMm)) return null;
  if (precipitationMm <= 0) return 0;
  if (precipitationMm <= 2) return scale(precipitationMm, 0.1, 2, 10, 40);
  if (precipitationMm <= 10) return scale(precipitationMm, 2, 10, 40, 80);
  return scale(Math.min(precipitationMm, 30), 10, 30, 80, 100);
}

function temperatureBurden(temperatureC: number | null): number | null {
  if (!isFiniteNumber(temperatureC)) return null;
  if (temperatureC < 5 || temperatureC > 40) return 0;
  if (temperatureC < 15) return scale(temperatureC, 5, 15, 0, 70);
  if (temperatureC <= 30) return 100;
  return scale(temperatureC, 30, 40, 100, 30);
}

function windBurden(windSpeedMs: number | null): number | null {
  if (!isFiniteNumber(windSpeedMs)) return null;
  if (windSpeedMs < 2) return 100;
  if (windSpeedMs <= 5) return scale(windSpeedMs, 2, 5, 100, 50);
  if (windSpeedMs <= 10) return scale(windSpeedMs, 5, 10, 50, 0);
  return 0;
}

function dewPointModifier(input: WeatherInputs): { modifier: number; confidence: number } {
  if (!isFiniteNumber(input.temperature) || !isFiniteNumber(input.dewPoint)) {
    return { modifier: 0, confidence: 0.75 };
  }

  const depression = input.temperature - input.dewPoint;

  if (depression <= 2) return { modifier: 5, confidence: 1 };
  if (depression <= 5) return { modifier: 2, confidence: 0.9 };
  return { modifier: -3, confidence: 0.8 };
}

export function calculateMoldPotential(input: WeatherInputs): MoldPotential {
  const humidity = humidityBurden(input.relativeHumidity);

  if (!isFiniteNumber(humidity)) {
    return {
      available: false,
      score: null,
      displayScore: null,
      category: 'unavailable',
      completeness: 0,
      confidence: 0,
      components: {
        relativeHumidity: null,
        leafWetness: null,
        precipitation: null,
        temperature: null,
        wind: null,
      },
      missingComponents: ['relativeHumidity'],
    };
  }

  const leafWetness = isFiniteNumber(input.leafWetnessProbability)
    ? clamp(input.leafWetnessProbability)
    : null;
  const precipitation = precipitationBurden(input.precipitation);
  const temperature = temperatureBurden(input.temperature);
  const wind = windBurden(input.windSpeed);
  const base = weightedAverage([
    { id: 'relativeHumidity', score: humidity, weight: MOLD_WEIGHTS.relativeHumidity },
    { id: 'leafWetness', score: leafWetness, weight: MOLD_WEIGHTS.leafWetness },
    { id: 'precipitation', score: precipitation, weight: MOLD_WEIGHTS.precipitation },
    { id: 'temperature', score: temperature, weight: MOLD_WEIGHTS.temperature },
    { id: 'wind', score: wind, weight: MOLD_WEIGHTS.wind },
  ]);
  const dewPoint = dewPointModifier(input);
  const score = clamp((base.score ?? 0) + dewPoint.modifier);

  return {
    available: true,
    score,
    displayScore: displayScore(score),
    category: categoryFromScore(score),
    completeness: base.completeness,
    confidence: Math.min(base.completeness, dewPoint.confidence),
    components: {
      relativeHumidity: humidity,
      leafWetness,
      precipitation,
      temperature,
      wind,
    },
    missingComponents: base.missing,
  };
}

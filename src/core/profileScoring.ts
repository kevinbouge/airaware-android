import { PERSONALIZED_WEIGHTS } from './constants';
import { categoryFromScore } from './categories';
import {
  calculateAtmosphericIrritantsComponent,
  calculatePollenComponent,
  calculateRegulatedPollutionComponent,
  componentFromMold,
} from './scoring';
import type {
  CurrentEnvironmentalReadings,
  PersonalizedScoreResult,
  PollenReadings,
  RegulatedPollutants,
  ScoreComponent,
} from '../models/environment';
import type { PersonalAllergyProfile, ProfileFactorId } from '../models/profile';
import { clamp, displayScore, isFiniteNumber, weightedAverage } from '../utils/number';

const POLLEN_FACTOR_MAP: Record<string, keyof PollenReadings> = {
  pollen_alder: 'alder',
  pollen_birch: 'birch',
  pollen_grass: 'grass',
  pollen_mugwort: 'mugwort',
  pollen_olive: 'olive',
  pollen_ragweed: 'ragweed',
};

const POLLUTION_FACTOR_MAP: Record<string, keyof RegulatedPollutants> = {
  pm25: 'pm25',
  pm10: 'pm10',
  nitrogen_dioxide: 'nitrogenDioxide',
  ozone: 'ozone',
  sulphur_dioxide: 'sulphurDioxide',
};

export function calculateUvBurden(uvIndex: number | null): number | null {
  if (!isFiniteNumber(uvIndex) || uvIndex < 0) {
    return null;
  }

  if (uvIndex <= 2) return clamp((uvIndex / 2) * 25);
  if (uvIndex <= 5) return clamp(25 + ((uvIndex - 2) / 3) * 25);
  if (uvIndex <= 7) return clamp(50 + ((uvIndex - 5) / 2) * 20);
  if (uvIndex <= 10) return clamp(70 + ((uvIndex - 7) / 3) * 20);
  return clamp(90 + Math.min(uvIndex - 10, 3) * 3.33);
}

function enabledFactor(profile: PersonalAllergyProfile, factor: ProfileFactorId): boolean {
  return profile.enabled && profile.factors[factor] === true;
}

function selectedPollenTypes(profile: PersonalAllergyProfile): (keyof PollenReadings)[] {
  return Object.entries(POLLEN_FACTOR_MAP)
    .filter(([factor]) => enabledFactor(profile, factor as ProfileFactorId))
    .map(([, type]) => type);
}

function selectedPollutants(profile: PersonalAllergyProfile): (keyof RegulatedPollutants)[] {
  return Object.entries(POLLUTION_FACTOR_MAP)
    .filter(([factor]) => enabledFactor(profile, factor as ProfileFactorId))
    .map(([, type]) => type);
}

function selectedIrritants(profile: PersonalAllergyProfile) {
  const selected: ('carbonMonoxide' | 'aerosolOpticalDepth' | 'dust' | 'wildfirePm10')[] = [];

  if (enabledFactor(profile, 'carbon_monoxide')) selected.push('carbonMonoxide');
  if (enabledFactor(profile, 'aerosol_optical_depth')) selected.push('aerosolOpticalDepth');
  if (enabledFactor(profile, 'dust')) selected.push('dust');
  if (enabledFactor(profile, 'wildfire_pm10')) selected.push('wildfirePm10');

  return selected;
}

function uvComponent(readings: CurrentEnvironmentalReadings): ScoreComponent {
  const score = calculateUvBurden(readings.uvIndex);
  const available = isFiniteNumber(score);

  return {
    available,
    score,
    displayScore: displayScore(score),
    category: available ? categoryFromScore(score) : 'unavailable',
    dominantId: 'uv_index',
    missing: available ? [] : ['uv_index'],
    completeness: available ? 1 : 0,
  };
}

function emptyUnavailable(reason: PersonalizedScoreResult['reason']): PersonalizedScoreResult {
  return {
    available: false,
    score: null,
    displayScore: null,
    category: 'unavailable',
    components: {},
    effectiveWeights: {},
    missingComponents: [],
    selectedGroupCount: 0,
    availableGroupCount: 0,
    dominantComponent: null,
    reason,
  };
}

function dominantComponent(components: Record<string, ScoreComponent>): string | null {
  let dominant: { id: string; score: number } | null = null;

  for (const id of Object.keys(components)) {
    const score = components[id]?.score;
    if (!isFiniteNumber(score)) continue;
    if (!dominant || score > dominant.score) dominant = { id, score };
  }

  return dominant?.id ?? null;
}

export function calculatePersonalizedScore(
  readings: CurrentEnvironmentalReadings,
  profile: PersonalAllergyProfile,
): PersonalizedScoreResult {
  if (!profile.enabled) {
    return emptyUnavailable('disabled');
  }

  const components: Record<string, ScoreComponent> = {};
  const selectedPollen = selectedPollenTypes(profile);
  const selectedPollutantTypes = selectedPollutants(profile);
  const selectedIrritantTypes = selectedIrritants(profile);

  if (selectedPollen.length > 0) {
    components.pollen = calculatePollenComponent(readings.pollen, selectedPollen);
  }
  if (selectedPollutantTypes.length > 0) {
    components.regulatedPollution = calculateRegulatedPollutionComponent(
      readings.pollutantAqi,
      readings.regulatedPollutants,
      selectedPollutantTypes,
    );
  }
  if (selectedIrritantTypes.length > 0) {
    components.atmosphericIrritants = calculateAtmosphericIrritantsComponent(
      readings.atmosphericIrritants,
      selectedIrritantTypes,
    );
  }
  if (enabledFactor(profile, 'mold')) {
    components.mold = componentFromMold(readings.moldPotential);
  }
  if (enabledFactor(profile, 'uv_index')) {
    components.uv = uvComponent(readings);
  }

  const selected = Object.entries(components);

  if (selected.length === 0) {
    return emptyUnavailable('no_selected_values');
  }

  const weighted = weightedAverage(
    selected.map(([id, scoreComponent]) => ({
      id,
      score: scoreComponent.score,
      weight: PERSONALIZED_WEIGHTS[id as keyof typeof PERSONALIZED_WEIGHTS],
    })),
  );

  if (!isFiniteNumber(weighted.score)) {
    return {
      ...emptyUnavailable('no_selected_values'),
      selectedGroupCount: selected.length,
      missingComponents: weighted.missing,
      components,
    };
  }

  return {
    available: true,
    score: weighted.score,
    displayScore: displayScore(weighted.score),
    category: categoryFromScore(weighted.score),
    components,
    effectiveWeights: weighted.effectiveWeights,
    missingComponents: weighted.missing,
    selectedGroupCount: selected.length,
    availableGroupCount: selected.length - weighted.missing.length,
    dominantComponent: dominantComponent(components),
  };
}

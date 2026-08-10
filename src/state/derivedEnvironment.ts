import {
  calculateEnvironmentalForecast,
  calculatePersonalizedForecast,
  type EnvironmentalForecast,
  type PersonalizedForecast,
} from '../core/outdoorWindow';
import type { AppCapabilities } from '../capabilities/types';
import { profileForCapabilities } from '../capabilities/variables';
import { calculatePersonalizedScore } from '../core/profileScoring';
import { calculateEnvironmentalScore } from '../core/scoring';
import type {
  CurrentEnvironmentalReadings,
  EnvironmentalScoreResult,
  HourlyEnvironmentalReading,
  NormalizedEnvironment,
  OutdoorWindow,
  PersonalizedScoreResult,
} from '../models/environment';
import type { PersonalAllergyProfile } from '../models/profile';

const unavailablePersonalized: PersonalizedScoreResult = {
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
  reason: 'disabled',
};

export interface DerivedEnvironmentState {
  environmentalScore: EnvironmentalScoreResult | null;
  personalizedScore: PersonalizedScoreResult;
  environmentalForecast: EnvironmentalForecast | null;
  personalizedForecast: PersonalizedForecast | null;
  personalizedForecastDays: PersonalizedForecastDay[];
  environmentalBestOutdoorWindow: OutdoorWindow | null;
  personalizedBestOutdoorWindow: OutdoorWindow | null;
}

interface PersonalizedForecastDay {
  date: string;
  label: string;
  score: PersonalizedScoreResult | null;
}

function toCurrentReading(hour: HourlyEnvironmentalReading): CurrentEnvironmentalReadings {
  return {
    timestamp: hour.timestamp,
    pollen: hour.pollen,
    regulatedPollutants: hour.regulatedPollutants,
    pollutantAqi: hour.pollutantAqi,
    aqiLabel: hour.aqiLabel,
    atmosphericIrritants: hour.atmosphericIrritants,
    weather: hour.weather,
    extended: hour.extended,
    moldPotential: hour.moldPotential,
    uvIndex: hour.uvIndex,
  };
}

function calculatePersonalizedForecastDays(
  environment: NormalizedEnvironment,
  profile: PersonalAllergyProfile,
): PersonalizedForecastDay[] {
  const currentDate = environment.current.timestamp?.slice(0, 10) ?? null;
  const currentTime = environment.current.timestamp
    ? Date.parse(environment.current.timestamp)
    : null;

  return environment.forecastDays.map((day) => {
    const peak = environment.hourly
      .filter((hour) => {
        if (hour.timestamp.slice(0, 10) !== day.date) return false;
        const hourTime = Date.parse(hour.timestamp);
        return !(
          currentDate &&
          day.date === currentDate &&
          currentTime !== null &&
          Number.isFinite(currentTime) &&
          Number.isFinite(hourTime) &&
          hourTime < currentTime
        );
      })
      .map((hour) => calculatePersonalizedScore(toCurrentReading(hour), profile))
      .filter((score) => score.available)
      .sort((left, right) => (right.score ?? 0) - (left.score ?? 0))[0];

    return {
      date: day.date,
      label: day.label,
      score: peak ?? null,
    };
  });
}

export function deriveEnvironmentState(
  environment: NormalizedEnvironment | null,
  profile: PersonalAllergyProfile,
  duration: 1 | 2 | 3,
  capabilities?: AppCapabilities,
): DerivedEnvironmentState {
  const effectiveProfile = capabilities ? profileForCapabilities(capabilities, profile) : profile;
  const environmentalScore = environment ? calculateEnvironmentalScore(environment.current) : null;
  const personalizedScore = environment
    ? calculatePersonalizedScore(environment.current, effectiveProfile)
    : unavailablePersonalized;
  const environmentalForecast = environment
    ? calculateEnvironmentalForecast(environment.hourly, duration)
    : null;
  const personalizedForecast = environment
    ? calculatePersonalizedForecast(environment.hourly, effectiveProfile, duration)
    : null;
  const personalizedForecastDays = environment
    ? calculatePersonalizedForecastDays(environment, effectiveProfile)
    : [];
  const environmentalBestOutdoorWindow = environmentalForecast?.bestWindow ?? null;
  const personalizedBestOutdoorWindow =
    personalizedForecast?.bestWindow.available === true ? personalizedForecast.bestWindow : null;

  return {
    environmentalScore,
    personalizedScore,
    environmentalForecast,
    personalizedForecast,
    personalizedForecastDays,
    environmentalBestOutdoorWindow,
    personalizedBestOutdoorWindow,
  };
}

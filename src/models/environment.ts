import type { ActivityDomainId } from './activities';

export type RiskCategoryId = 'low' | 'moderate' | 'high' | 'veryHigh' | 'unavailable';

export interface Coordinates {
  latitude: number;
  longitude: number;
}

export type AtmosphericModel = 'auto' | 'cams-europe' | 'cams-global';

export interface LocationInfo {
  activeLocationId: string;
  activeLocationName: string;
  coordinates: Coordinates | null;
  placeName: string | null;
  mode: 'automatic' | 'manual';
  permissionStatus: 'unknown' | 'granted' | 'denied' | 'unavailable';
}

export interface PollenReadings {
  alder: number | null;
  birch: number | null;
  grass: number | null;
  mugwort: number | null;
  olive: number | null;
  ragweed: number | null;
}

export interface RegulatedPollutants {
  pm25: number | null;
  pm10: number | null;
  nitrogenDioxide: number | null;
  ozone: number | null;
  sulphurDioxide: number | null;
}

export interface PollutantAqi {
  pm25: number | null;
  pm10: number | null;
  nitrogenDioxide: number | null;
  ozone: number | null;
  sulphurDioxide: number | null;
}

export interface AtmosphericIrritants {
  carbonMonoxide: number | null;
  aerosolOpticalDepth: number | null;
  dust: number | null;
  wildfirePm10: number | null;
}

export interface ExtendedAirQualityReadings {
  carbonDioxide: number | null;
  ammonia: number | null;
  methane: number | null;
  nitrogenMonoxide: number | null;
  formaldehyde: number | null;
  glyoxal?: number | null;
  nonMethaneVolatileOrganicCompounds: number | null;
  peroxyacylNitrates?: number | null;
  secondaryInorganicAerosol?: number | null;
  residentialElementaryCarbon?: number | null;
  totalElementaryCarbon?: number | null;
  pm25TotalOrganicMatter?: number | null;
  seaSaltAerosol?: number | null;
  uvIndexClearSky?: number | null;
}

export interface ExtendedWeatherReadings {
  apparentTemperature?: number | null;
  precipitationProbability?: number | null;
  pressureMsl: number | null;
  surfacePressure: number | null;
  visibility: number | null;
  cloudCover: number | null;
  cloudCoverLow: number | null;
  cloudCoverMid: number | null;
  cloudCoverHigh: number | null;
  dewPoint: number | null;
  wetBulbTemperature: number | null;
  windGusts: number | null;
  shortwaveRadiation: number | null;
  directNormalIrradiance: number | null;
  diffuseRadiation: number | null;
  sunshineDuration: number | null;
  cape: number | null;
  soilMoisture0To1cm?: number | null;
  soilTemperature0cm?: number | null;
  et0FaoEvapotranspiration?: number | null;
  vapourPressureDeficit?: number | null;
}

export interface ExtendedEnvironmentalReadings {
  airQuality: ExtendedAirQualityReadings;
  weather: ExtendedWeatherReadings;
}

export interface WeatherInputs {
  temperature: number | null;
  relativeHumidity: number | null;
  dewPoint: number | null;
  precipitation: number | null;
  windSpeed: number | null;
  leafWetnessProbability: number | null;
}

export interface WeatherContext extends WeatherInputs {
  windDirection: number | null;
  windGusts: number | null;
  visibility: number | null;
}

export interface MoldPotential {
  available: boolean;
  score: number | null;
  displayScore: number | null;
  category: RiskCategoryId;
  completeness: number;
  confidence: number;
  components: Record<string, number | null>;
  missingComponents: string[];
}

export interface CurrentEnvironmentalReadings {
  timestamp: string | null;
  pollen: PollenReadings;
  regulatedPollutants: RegulatedPollutants;
  pollutantAqi: PollutantAqi;
  aqiLabel: 'US AQI' | 'EU AQI';
  atmosphericIrritants: AtmosphericIrritants;
  weather: WeatherContext;
  extended?: ExtendedEnvironmentalReadings | undefined;
  moldPotential: MoldPotential;
  uvIndex: number | null;
}

export interface HourlyEnvironmentalReading {
  timestamp: string;
  pollen: PollenReadings;
  regulatedPollutants: RegulatedPollutants;
  pollutantAqi: PollutantAqi;
  aqiLabel: 'US AQI' | 'EU AQI';
  atmosphericIrritants: AtmosphericIrritants;
  weather: WeatherContext;
  extended?: ExtendedEnvironmentalReadings | undefined;
  moldPotential: MoldPotential;
  uvIndex: number | null;
}

export interface ScoreComponent {
  available: boolean;
  score: number | null;
  displayScore: number | null;
  category: RiskCategoryId;
  source?: string | undefined;
  dominantId?: string | undefined;
  missing: string[];
  completeness: number;
}

export interface EnvironmentalScoreResult {
  available: boolean;
  score: number | null;
  displayScore: number | null;
  category: RiskCategoryId;
  components: {
    pollen: ScoreComponent;
    regulatedPollution: ScoreComponent;
    atmosphericIrritants: ScoreComponent;
    mold: ScoreComponent;
  };
  effectiveWeights: Record<string, number>;
  missingComponents: string[];
  completeness: number;
  dominantComponent: string | null;
}

export interface PersonalizedScoreResult {
  available: boolean;
  score: number | null;
  displayScore: number | null;
  category: RiskCategoryId;
  components: Record<string, ScoreComponent>;
  effectiveWeights: Record<string, number>;
  missingComponents: string[];
  selectedGroupCount: number;
  availableGroupCount: number;
  dominantComponent: string | null;
  reason?: 'disabled' | 'no_selected_values' | undefined;
}

export interface ForecastDay {
  date: string;
  label: string;
  score: EnvironmentalScoreResult | null;
}

export interface OutdoorWindow {
  available: boolean;
  startTime: string | null;
  endTime: string | null;
  durationHours: number;
  averageScore: number | null;
  maximumScore: number | null;
  category: RiskCategoryId;
  completeness: number;
  reason?: 'personalization_disabled' | 'insufficient_forecast_data' | undefined;
}

export interface NormalizedEnvironment {
  provider: 'open-meteo';
  coordinates: Coordinates;
  placeName: string | null;
  fetchedAt: string;
  current: CurrentEnvironmentalReadings;
  hourly: HourlyEnvironmentalReading[];
  forecastDays: ForecastDay[];
  metadata: {
    timezone: string | null;
    airQualityFetchedAt: string | null;
    weatherFetchedAt: string | null;
    airQualityModel?: AtmosphericModel | undefined;
    airQualitySource: 'fresh' | 'cached' | 'unavailable';
    weatherSource: 'fresh' | 'cached' | 'unavailable';
    requestedActivityDomains?: ActivityDomainId[] | undefined;
    requestedAirQualityVariables?: string[] | undefined;
    requestedWeatherVariables?: string[] | undefined;
    partial: boolean;
  };
}

interface CacheMetadata {
  version: number;
  savedAt: string;
  stale: boolean;
}

export interface CachedEnvironment {
  metadata: CacheMetadata;
  data: NormalizedEnvironment;
}

export interface DailySummary {
  title: string;
  dateLabel: string;
  referenceTime: string;
  scoreLabel: 'Environmental burden' | 'Personalized risk';
  score: EnvironmentalScoreResult | PersonalizedScoreResult;
  mainFactorLabel: string | null;
  mainFactorGroup: 'pollen' | 'pollution' | 'mold' | 'uv' | 'unknown';
  bestOutdoorWindow: OutdoorWindow | null;
  uvPeak: { category: RiskCategoryId; value: number; timeLabel: string } | null;
  stale: boolean;
  attribution: string[];
}

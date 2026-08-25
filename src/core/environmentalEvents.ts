import { addHours, differenceInMilliseconds } from 'date-fns';
import { categoryLabel } from './categories';
import { calculateEnvironmentalScore } from './scoring';
import { calculatePersonalizedScore } from './profileScoring';
import {
  POLLEN_THRESHOLDS,
  RAW_POLLUTANT_THRESHOLDS,
  ENVIRONMENT_PROVIDER_FRESHNESS_MS,
} from './constants';
import type {
  CurrentEnvironmentalReadings,
  HourlyEnvironmentalReading,
  NormalizedEnvironment,
  RiskCategoryId,
} from '../models/environment';
import type {
  EnvironmentalEvent,
  EnvironmentalEventConfidence,
  EnvironmentalEventEvidence,
  EnvironmentalEventNotificationCategory,
  EnvironmentalEventNotificationState,
  EnvironmentalEventSeverity,
  EnvironmentalEventType,
} from '../models/environmentalEvents';
import type { AppSettings, PersonalAllergyProfile } from '../models/profile';
import { translate } from '../i18n';
import { formatShortTime, formatTimeRangeWithTomorrow } from '../utils/format';
import { isFiniteNumber, normalizeByThresholds } from '../utils/number';
import { irritantLabel, pollenLabel, pollutantLabel } from '../utils/readingLabels';

const DETECTION_HORIZON_HOURS = 24;
const MAX_EPISODE_GAP_MS = 90 * 60 * 1000;
const EVENT_NOTIFICATION_TTL_MS = 48 * 60 * 60 * 1000;

// Initial dust/wildfire thresholds reuse AirAware's existing deterministic burden thresholds.
// Events require High-or-higher category and persistence, not merely non-zero source values.
const DUST_SUPPORT = {
  aodElevated: 0.3,
  pm10Elevated: 50,
  pm25Elevated: 25,
} as const;

const WILDFIRE_SUPPORT = {
  pm10Elevated: 50,
  pm25Elevated: 25,
  aodElevated: 0.3,
  organicMatterElevated: 10,
  carbonElevated: 2,
} as const;

type SeverityRankable = EnvironmentalEventSeverity | RiskCategoryId;

interface EpisodePoint {
  timestamp: string;
  value: number;
  score: number;
  severity: EnvironmentalEventSeverity;
}

interface Episode {
  points: EpisodePoint[];
  startTime: string;
  endTime: string;
  peak: EpisodePoint;
  severity: EnvironmentalEventSeverity;
}

interface CandidateEvent extends EnvironmentalEvent {
  priority: number;
}

interface DetectionOptions {
  locationId: string;
  profile: PersonalAllergyProfile;
  settings: AppSettings;
  horizonHours?: number | undefined;
  generatedAt?: string | undefined;
}

const SEVERITY_RANK: Record<EnvironmentalEventSeverity, number> = {
  moderate: 2,
  high: 3,
  'very-high': 4,
};

const CATEGORY_RANK: Record<RiskCategoryId, number> = {
  low: 1,
  moderate: 2,
  high: 3,
  veryHigh: 4,
  unavailable: 0,
};

const POLLEN = [
  ['alder', 'Alder pollen'],
  ['birch', 'Birch pollen'],
  ['grass', 'Grass pollen'],
  ['mugwort', 'Mugwort pollen'],
  ['olive', 'Olive pollen'],
  ['ragweed', 'Ragweed pollen'],
] as const;

const POLLUTANTS = [
  ['pm25', 'PM2.5'],
  ['pm10', 'PM10'],
  ['nitrogenDioxide', 'Nitrogen dioxide'],
  ['ozone', 'Ozone'],
  ['sulphurDioxide', 'Sulphur dioxide'],
] as const;

function severityRank(severity: SeverityRankable): number {
  if (severity === 'very-high') return SEVERITY_RANK['very-high'];
  if (severity === 'high') return SEVERITY_RANK.high;
  if (severity === 'moderate') return SEVERITY_RANK.moderate;
  return CATEGORY_RANK[severity];
}

function severityFromCategory(category: RiskCategoryId): EnvironmentalEventSeverity | null {
  if (category === 'veryHigh') return 'very-high';
  if (category === 'high') return 'high';
  if (category === 'moderate') return 'moderate';
  return null;
}

function eventCategoryLabel(severity: EnvironmentalEventSeverity): string {
  if (severity === 'very-high') return 'Very High';
  return categoryLabel(severity);
}

function localizedEventCategoryLabel(severity: EnvironmentalEventSeverity): string {
  if (severity === 'very-high') return translate('risk.categories.veryHigh');
  return categoryLabel(severity);
}

function eventId(input: {
  locationId: string;
  type: EnvironmentalEventType;
  factor?: string | undefined;
  severity: EnvironmentalEventSeverity;
  startTime: string;
}): string {
  return [input.locationId, input.type, input.factor ?? '', input.severity, input.startTime].join(
    ':',
  );
}

function sortCandidateEvents(events: CandidateEvent[]): CandidateEvent[] {
  return [...events].sort((left, right) => {
    const severityDelta = SEVERITY_RANK[right.severity] - SEVERITY_RANK[left.severity];
    if (severityDelta !== 0) return severityDelta;
    const priorityDelta = right.priority - left.priority;
    if (priorityDelta !== 0) return priorityDelta;
    return Date.parse(left.startTime) - Date.parse(right.startTime);
  });
}

function stripPriority(event: CandidateEvent): EnvironmentalEvent {
  return {
    id: event.id,
    type: event.type,
    severity: event.severity,
    locationId: event.locationId,
    startTime: event.startTime,
    endTime: event.endTime,
    peakTime: event.peakTime,
    factor: event.factor,
    previousCategory: event.previousCategory,
    category: event.category,
    currentValue: event.currentValue,
    peakValue: event.peakValue,
    confidence: event.confidence,
    evidence: event.evidence,
    title: event.title,
    body: event.body,
  };
}

function forecastWindow(
  environment: NormalizedEnvironment,
  horizonHours = DETECTION_HORIZON_HOURS,
): HourlyEnvironmentalReading[] {
  const reference = environment.current.timestamp ?? environment.fetchedAt;
  const start = Date.parse(reference);
  if (!Number.isFinite(start)) return environment.hourly.slice(0, horizonHours);
  const end = addHours(new Date(start), horizonHours).getTime();

  return environment.hourly.filter((hour) => {
    const timestamp = Date.parse(hour.timestamp);
    return Number.isFinite(timestamp) && timestamp >= start && timestamp < end;
  });
}

function groupEpisodes(points: EpisodePoint[]): Episode[] {
  const sorted = [...points].sort(
    (left, right) => Date.parse(left.timestamp) - Date.parse(right.timestamp),
  );
  const groups: EpisodePoint[][] = [];

  for (const point of sorted) {
    const previousGroup = groups[groups.length - 1];
    const previousPoint = previousGroup?.[previousGroup.length - 1];
    if (
      previousPoint &&
      differenceInMilliseconds(new Date(point.timestamp), new Date(previousPoint.timestamp)) <=
        MAX_EPISODE_GAP_MS
    ) {
      previousGroup.push(point);
    } else {
      groups.push([point]);
    }
  }

  return groups.map((group) => {
    const peak = group.reduce((best, point) => (point.score > best.score ? point : best));
    const severity = group.reduce(
      (best, point) =>
        SEVERITY_RANK[point.severity] > SEVERITY_RANK[best] ? point.severity : best,
      group[0]!.severity,
    );

    return {
      points: group,
      startTime: group[0]!.timestamp,
      endTime: group[group.length - 1]!.timestamp,
      peak,
      severity,
    };
  });
}

function firstMeaningfulEpisode(points: EpisodePoint[]): Episode | null {
  const episodes = groupEpisodes(points);
  return (
    episodes
      .filter((episode) => episode.points.length >= 2 || episode.severity === 'very-high')
      .sort((left, right) => {
        const severityDelta = SEVERITY_RANK[right.severity] - SEVERITY_RANK[left.severity];
        if (severityDelta !== 0) return severityDelta;
        return right.peak.score - left.peak.score;
      })[0] ?? null
  );
}

function timePhrase(event: EnvironmentalEvent, referenceTime: string | null): string {
  if (event.startTime === event.endTime || !event.endTime) {
    return translate('events.body.expectedAround', {
      time: formatShortTime(event.peakTime ?? event.startTime),
    });
  }

  return translate('events.body.expectedRange', {
    range: formatTimeRangeWithTomorrow(event.startTime, event.endTime, referenceTime),
  });
}

function pollenFactorLabel(factor: string | undefined): string {
  switch (factor) {
    case 'alder':
    case 'birch':
    case 'grass':
    case 'mugwort':
    case 'olive':
    case 'ragweed':
      return pollenLabel(factor);
    default:
      return translate('environment.pollen.generic');
  }
}

function pollutantFactorLabel(factor: string | undefined): string {
  switch (factor) {
    case 'pm25':
    case 'pm10':
    case 'nitrogenDioxide':
    case 'ozone':
    case 'sulphurDioxide':
      return pollutantLabel(factor);
    case 'carbonMonoxide':
      return translate('environment.pollutants.carbonMonoxide');
    default:
      return translate('environment.pollutants.regulated');
  }
}

function headlineScoreTypeLabel(factor: string | undefined): string {
  return factor === 'personalized'
    ? translate('risk.personalizedRisk')
    : translate('risk.environmentalBurden');
}

export function environmentalEventTitle(event: EnvironmentalEvent): string {
  switch (event.type) {
    case 'pollen':
      return translate('events.titles.pollen', { factor: pollenFactorLabel(event.factor) });
    case 'pollution':
      return translate('events.titles.pollution', {
        factor: pollutantFactorLabel(event.factor),
      });
    case 'saharan-dust':
      return translate('events.titles.saharanDust');
    case 'wildfire-pollution':
      return translate('events.titles.wildfirePollution');
    case 'aerosol':
      return translate('events.titles.aerosol');
    case 'uv':
      return translate('events.titles.uv');
    case 'mold':
      return translate('events.titles.mold');
    case 'headline-risk':
      return translate('events.titles.headlineRisk', {
        scoreType: headlineScoreTypeLabel(event.factor),
      });
  }
}

export function environmentalEventBody(
  event: EnvironmentalEvent,
  referenceTime: string | null = null,
): string {
  const severity = localizedEventCategoryLabel(event.severity);
  const time = timePhrase(event, referenceTime);

  switch (event.type) {
    case 'pollen':
      return translate('events.body.pollen', {
        factor: pollenFactorLabel(event.factor),
        severity,
        time,
      });
    case 'pollution':
      return translate('events.body.pollution', {
        factor: pollutantFactorLabel(event.factor),
        severity,
        time,
      });
    case 'saharan-dust':
      return translate('events.body.saharanDust', {
        time: formatShortTime(event.peakTime ?? event.startTime),
      });
    case 'wildfire-pollution':
      return translate('events.body.wildfirePollution', { time });
    case 'aerosol':
      return translate('events.body.aerosol', { time });
    case 'uv':
      return translate('events.body.uv', { severity, time });
    case 'mold':
      return translate('events.body.mold', { severity, time });
    case 'headline-risk':
      return translate('events.body.headlineRisk', {
        scoreType: headlineScoreTypeLabel(event.factor),
        severity,
        time,
      });
  }
}

export function environmentalEventCategoryLabel(event: EnvironmentalEvent): string {
  return localizedEventCategoryLabel(event.severity);
}

export function environmentalEventEvidenceLabel(variable: string): string {
  switch (variable) {
    case 'dust':
      return irritantLabel('dust');
    case 'pm10':
      return pollutantLabel('pm10');
    case 'pm2_5':
      return 'PM2.5';
    case 'pm10_wildfires':
      return translate('environment.irritants.wildfirePm10');
    case 'aerosol_optical_depth':
      return translate('environment.irritants.aerosolOpticalDepth');
    case 'pm2_5_total_organic_matter':
      return translate('environment.irritants.pm25OrganicMatter');
    case 'total_elementary_carbon':
      return translate('environment.irritants.totalElementaryCarbon');
    case 'uv_index':
      return translate('environment.uvIndex');
    case 'mold_potential':
      return translate('environment.moldPotential');
    case 'environmental_burden':
      return translate('risk.environmentalBurden');
    case 'personalized_risk':
      return translate('risk.personalizedRisk');
    default:
      return variable.replaceAll('_', ' ');
  }
}

function categoryForScore(score: number | null): RiskCategoryId {
  if (!isFiniteNumber(score)) return 'unavailable';
  if (score <= 25) return 'low';
  if (score <= 50) return 'moderate';
  if (score <= 75) return 'high';
  return 'veryHigh';
}

function pointFromScore(input: {
  timestamp: string;
  value: number;
  score: number | null;
  currentCategory: RiskCategoryId;
}): EpisodePoint | null {
  const category = categoryForScore(input.score);
  const severity = severityFromCategory(category);
  if (!severity || severityRank(severity) < SEVERITY_RANK.high) return null;
  if (CATEGORY_RANK[category] <= CATEGORY_RANK[input.currentCategory]) return null;

  return {
    timestamp: input.timestamp,
    value: input.value,
    score: input.score ?? 0,
    severity,
  };
}

function currentPollenScore(
  reading: CurrentEnvironmentalReadings,
  factor: keyof typeof reading.pollen,
) {
  return normalizeByThresholds(reading.pollen[factor], POLLEN_THRESHOLDS[factor]);
}

function pollenEvents(
  environment: NormalizedEnvironment,
  hours: HourlyEnvironmentalReading[],
  locationId: string,
): CandidateEvent[] {
  const referenceTime = environment.current.timestamp ?? environment.fetchedAt;
  const candidates = POLLEN.flatMap(([factor, label]) => {
    const currentValue = environment.current.pollen[factor];
    const currentScore = currentPollenScore(environment.current, factor);
    const currentCategory = categoryForScore(currentScore);
    const points = hours.flatMap((hour) => {
      const value = hour.pollen[factor];
      if (!isFiniteNumber(value)) return [];
      const point = pointFromScore({
        timestamp: hour.timestamp,
        value,
        score: normalizeByThresholds(value, POLLEN_THRESHOLDS[factor]),
        currentCategory,
      });
      return point ? [point] : [];
    });
    const episode = firstMeaningfulEpisode(points);
    if (!episode) return [];
    const severityLabel = eventCategoryLabel(episode.severity);

    return [
      {
        id: eventId({
          locationId,
          type: 'pollen',
          factor,
          severity: episode.severity,
          startTime: episode.startTime,
        }),
        type: 'pollen' as const,
        severity: episode.severity,
        locationId,
        startTime: episode.startTime,
        endTime: episode.endTime,
        peakTime: episode.peak.timestamp,
        factor,
        previousCategory: categoryLabel(currentCategory),
        category: severityLabel,
        currentValue,
        peakValue: episode.peak.value,
        confidence: 'medium' as const,
        evidence: [
          {
            variable: `${factor}_pollen`,
            value: episode.peak.value,
            previousValue: currentValue,
            unit: 'grains/m³',
            time: episode.peak.timestamp,
            role: 'primary' as const,
          },
        ],
        title: label,
        body: `${label} is expected to become ${severityLabel} ${timePhrase(
          {
            startTime: episode.startTime,
            endTime: episode.endTime,
            peakTime: episode.peak.timestamp,
          } as EnvironmentalEvent,
          referenceTime,
        )}.`,
        priority: 40,
      },
    ];
  });

  return sortCandidateEvents(candidates).slice(0, 1);
}

function pollutantScore(
  reading: CurrentEnvironmentalReadings | HourlyEnvironmentalReading,
  factor: keyof typeof reading.regulatedPollutants,
) {
  return (
    reading.pollutantAqi[factor] ??
    normalizeByThresholds(reading.regulatedPollutants[factor], RAW_POLLUTANT_THRESHOLDS[factor])
  );
}

function pollutionEvents(
  environment: NormalizedEnvironment,
  hours: HourlyEnvironmentalReading[],
  locationId: string,
): CandidateEvent[] {
  const referenceTime = environment.current.timestamp ?? environment.fetchedAt;
  const candidates = POLLUTANTS.flatMap(([factor, label]) => {
    const currentValue = environment.current.regulatedPollutants[factor];
    const currentCategory = categoryForScore(pollutantScore(environment.current, factor));
    const points = hours.flatMap((hour) => {
      const value = hour.regulatedPollutants[factor];
      if (!isFiniteNumber(value)) return [];
      const point = pointFromScore({
        timestamp: hour.timestamp,
        value,
        score: pollutantScore(hour, factor),
        currentCategory,
      });
      return point ? [point] : [];
    });
    const episode = firstMeaningfulEpisode(points);
    if (!episode) return [];
    const severityLabel = eventCategoryLabel(episode.severity);

    return [
      {
        id: eventId({
          locationId,
          type: 'pollution',
          factor,
          severity: episode.severity,
          startTime: episode.startTime,
        }),
        type: 'pollution' as const,
        severity: episode.severity,
        locationId,
        startTime: episode.startTime,
        endTime: episode.endTime,
        peakTime: episode.peak.timestamp,
        factor,
        previousCategory: categoryLabel(currentCategory),
        category: severityLabel,
        currentValue,
        peakValue: episode.peak.value,
        confidence: 'medium' as const,
        evidence: [
          {
            variable: factor,
            value: episode.peak.value,
            previousValue: currentValue,
            unit: 'µg/m³',
            time: episode.peak.timestamp,
            role: 'primary' as const,
          },
        ],
        title: `${label} pollution`,
        body: `${label} pollution is expected to become ${severityLabel} ${timePhrase(
          {
            startTime: episode.startTime,
            endTime: episode.endTime,
            peakTime: episode.peak.timestamp,
          } as EnvironmentalEvent,
          referenceTime,
        )}.`,
        priority: factor === 'ozone' ? 55 : 30,
      },
    ];
  });

  return sortCandidateEvents(candidates).slice(0, 1);
}

function supportEvidence(hour: HourlyEnvironmentalReading): EnvironmentalEventEvidence[] {
  const evidence: EnvironmentalEventEvidence[] = [];
  if ((hour.atmosphericIrritants.aerosolOpticalDepth ?? 0) >= DUST_SUPPORT.aodElevated) {
    evidence.push({
      variable: 'aerosol_optical_depth',
      value: hour.atmosphericIrritants.aerosolOpticalDepth,
      unit: '',
      time: hour.timestamp,
      role: 'supporting',
    });
  }
  if ((hour.regulatedPollutants.pm10 ?? 0) >= DUST_SUPPORT.pm10Elevated) {
    evidence.push({
      variable: 'pm10',
      value: hour.regulatedPollutants.pm10,
      unit: 'µg/m³',
      time: hour.timestamp,
      role: 'supporting',
    });
  }
  if ((hour.regulatedPollutants.pm25 ?? 0) >= DUST_SUPPORT.pm25Elevated) {
    evidence.push({
      variable: 'pm2_5',
      value: hour.regulatedPollutants.pm25,
      unit: 'µg/m³',
      time: hour.timestamp,
      role: 'supporting',
    });
  }
  return evidence;
}

function confidenceFromEvidence(
  primary: Episode,
  evidence: EnvironmentalEventEvidence[],
): EnvironmentalEventConfidence {
  if (primary.severity === 'very-high' && evidence.length >= 2) return 'high';
  if (evidence.length >= 2) return 'high';
  return 'medium';
}

function dustEvent(
  environment: NormalizedEnvironment,
  hours: HourlyEnvironmentalReading[],
  locationId: string,
): CandidateEvent | null {
  const currentDust = environment.current.atmosphericIrritants.dust;
  const currentCategory = categoryForScore(
    normalizeByThresholds(currentDust, RAW_POLLUTANT_THRESHOLDS.dust),
  );
  const points = hours.flatMap((hour) => {
    const value = hour.atmosphericIrritants.dust;
    if (!isFiniteNumber(value) || value < 20) return [];
    const point = pointFromScore({
      timestamp: hour.timestamp,
      value,
      score: normalizeByThresholds(value, RAW_POLLUTANT_THRESHOLDS.dust),
      currentCategory,
    });
    return point ? [point] : [];
  });
  const episode = firstMeaningfulEpisode(points);
  if (!episode) return null;
  const peakHour = hours.find((hour) => hour.timestamp === episode.peak.timestamp);
  const evidence = [
    {
      variable: 'dust',
      value: episode.peak.value,
      previousValue: currentDust,
      unit: 'µg/m³',
      time: episode.peak.timestamp,
      role: 'primary' as const,
    },
    ...(peakHour ? supportEvidence(peakHour) : []),
  ];

  return {
    id: eventId({
      locationId,
      type: 'saharan-dust',
      severity: episode.severity,
      startTime: episode.startTime,
    }),
    type: 'saharan-dust',
    severity: episode.severity,
    locationId,
    startTime: episode.startTime,
    endTime: episode.endTime,
    peakTime: episode.peak.timestamp,
    factor: 'dust',
    previousCategory: categoryLabel(currentCategory),
    category: eventCategoryLabel(episode.severity),
    currentValue: currentDust,
    peakValue: episode.peak.value,
    confidence: confidenceFromEvidence(episode, evidence),
    evidence,
    title: 'Saharan dust',
    body: `A Saharan dust episode is expected to peak around ${formatShortTime(
      episode.peak.timestamp,
    )}.`,
    priority: 80,
  };
}

function wildfireEvent(
  environment: NormalizedEnvironment,
  hours: HourlyEnvironmentalReading[],
  locationId: string,
): CandidateEvent | null {
  const currentValue = environment.current.atmosphericIrritants.wildfirePm10;
  const currentCategory = categoryForScore(
    normalizeByThresholds(currentValue, RAW_POLLUTANT_THRESHOLDS.wildfirePm10),
  );
  const points = hours.flatMap((hour) => {
    const value = hour.atmosphericIrritants.wildfirePm10;
    if (!isFiniteNumber(value) || value < 5) return [];
    const point = pointFromScore({
      timestamp: hour.timestamp,
      value,
      score: normalizeByThresholds(value, RAW_POLLUTANT_THRESHOLDS.wildfirePm10),
      currentCategory,
    });
    return point ? [point] : [];
  });
  const episode = firstMeaningfulEpisode(points);
  if (!episode) return null;
  const peakHour = hours.find((hour) => hour.timestamp === episode.peak.timestamp);
  const evidence: EnvironmentalEventEvidence[] = [
    {
      variable: 'pm10_wildfires',
      value: episode.peak.value,
      previousValue: currentValue,
      unit: 'µg/m³',
      time: episode.peak.timestamp,
      role: 'primary',
    },
  ];
  if (peakHour) {
    evidence.push(...supportEvidence(peakHour));
    if (
      (peakHour.extended?.airQuality.pm25TotalOrganicMatter ?? 0) >=
      WILDFIRE_SUPPORT.organicMatterElevated
    ) {
      evidence.push({
        variable: 'pm2_5_total_organic_matter',
        value: peakHour.extended?.airQuality.pm25TotalOrganicMatter,
        unit: 'µg/m³',
        time: peakHour.timestamp,
        role: 'supporting',
      });
    }
    if (
      (peakHour.extended?.airQuality.totalElementaryCarbon ?? 0) >= WILDFIRE_SUPPORT.carbonElevated
    ) {
      evidence.push({
        variable: 'total_elementary_carbon',
        value: peakHour.extended?.airQuality.totalElementaryCarbon,
        unit: 'µg/m³',
        time: peakHour.timestamp,
        role: 'supporting',
      });
    }
  }

  return {
    id: eventId({
      locationId,
      type: 'wildfire-pollution',
      severity: episode.severity,
      startTime: episode.startTime,
    }),
    type: 'wildfire-pollution',
    severity: episode.severity,
    locationId,
    startTime: episode.startTime,
    endTime: episode.endTime,
    peakTime: episode.peak.timestamp,
    factor: 'pm10_wildfires',
    previousCategory: categoryLabel(currentCategory),
    category: eventCategoryLabel(episode.severity),
    currentValue,
    peakValue: episode.peak.value,
    confidence: confidenceFromEvidence(episode, evidence),
    evidence,
    title: 'Wildfire-related pollution',
    body: `Wildfire-related particulate pollution is expected ${timePhrase(
      {
        startTime: episode.startTime,
        endTime: episode.endTime,
        peakTime: episode.peak.timestamp,
      } as EnvironmentalEvent,
      environment.current.timestamp ?? environment.fetchedAt,
    )}.`,
    priority: 75,
  };
}

function aerosolEvent(
  environment: NormalizedEnvironment,
  hours: HourlyEnvironmentalReading[],
  locationId: string,
): CandidateEvent | null {
  const currentAod = environment.current.atmosphericIrritants.aerosolOpticalDepth;
  const currentCategory = categoryForScore(
    normalizeByThresholds(currentAod, RAW_POLLUTANT_THRESHOLDS.aerosolOpticalDepth),
  );
  const points = hours.flatMap((hour) => {
    const value = hour.atmosphericIrritants.aerosolOpticalDepth;
    if (!isFiniteNumber(value) || value < 0.3) return [];
    const point = pointFromScore({
      timestamp: hour.timestamp,
      value,
      score: normalizeByThresholds(value, RAW_POLLUTANT_THRESHOLDS.aerosolOpticalDepth),
      currentCategory,
    });
    return point ? [point] : [];
  });
  const episode = firstMeaningfulEpisode(points);
  if (!episode) return null;

  return {
    id: eventId({
      locationId,
      type: 'aerosol',
      severity: episode.severity,
      startTime: episode.startTime,
    }),
    type: 'aerosol',
    severity: episode.severity,
    locationId,
    startTime: episode.startTime,
    endTime: episode.endTime,
    peakTime: episode.peak.timestamp,
    factor: 'aerosol_optical_depth',
    previousCategory: categoryLabel(currentCategory),
    category: eventCategoryLabel(episode.severity),
    currentValue: currentAod,
    peakValue: episode.peak.value,
    confidence: 'low',
    evidence: [
      {
        variable: 'aerosol_optical_depth',
        value: episode.peak.value,
        previousValue: currentAod,
        time: episode.peak.timestamp,
        role: 'primary',
      },
    ],
    title: 'Atmospheric aerosols',
    body: `Atmospheric aerosol levels are expected to increase ${timePhrase(
      {
        startTime: episode.startTime,
        endTime: episode.endTime,
        peakTime: episode.peak.timestamp,
      } as EnvironmentalEvent,
      environment.current.timestamp ?? environment.fetchedAt,
    )}.`,
    priority: 15,
  };
}

function uvEvent(
  environment: NormalizedEnvironment,
  hours: HourlyEnvironmentalReading[],
  locationId: string,
): CandidateEvent | null {
  const currentCategory = categoryForScore(
    environment.current.uvIndex === null ? null : uvScore(environment.current.uvIndex),
  );
  const points = hours.flatMap((hour) => {
    if (!isFiniteNumber(hour.uvIndex)) return [];
    const point = pointFromScore({
      timestamp: hour.timestamp,
      value: hour.uvIndex,
      score: uvScore(hour.uvIndex),
      currentCategory,
    });
    return point ? [point] : [];
  });
  const episode = firstMeaningfulEpisode(points);
  if (!episode) return null;

  return {
    id: eventId({
      locationId,
      type: 'uv',
      severity: episode.severity,
      startTime: episode.startTime,
    }),
    type: 'uv',
    severity: episode.severity,
    locationId,
    startTime: episode.startTime,
    endTime: episode.endTime,
    peakTime: episode.peak.timestamp,
    factor: 'uv_index',
    previousCategory: categoryLabel(currentCategory),
    category: eventCategoryLabel(episode.severity),
    currentValue: environment.current.uvIndex,
    peakValue: episode.peak.value,
    confidence: 'medium',
    evidence: [
      {
        variable: 'uv_index',
        value: episode.peak.value,
        previousValue: environment.current.uvIndex,
        time: episode.peak.timestamp,
        role: 'primary',
      },
    ],
    title: 'UV',
    body: `UV is expected to reach ${eventCategoryLabel(episode.severity)} around ${formatShortTime(
      episode.peak.timestamp,
    )}.`,
    priority: 25,
  };
}

function uvScore(value: number): number {
  if (value <= 2) return 20;
  if (value <= 5) return 50;
  if (value <= 7) return 75;
  return 100;
}

function moldEvent(
  environment: NormalizedEnvironment,
  hours: HourlyEnvironmentalReading[],
  locationId: string,
): CandidateEvent | null {
  const currentCategory = environment.current.moldPotential.category;
  const points = hours.flatMap((hour) => {
    if (!hour.moldPotential.available || !isFiniteNumber(hour.moldPotential.score)) return [];
    const point = pointFromScore({
      timestamp: hour.timestamp,
      value: hour.moldPotential.score,
      score: hour.moldPotential.score,
      currentCategory,
    });
    return point ? [point] : [];
  });
  const episode = firstMeaningfulEpisode(points);
  if (!episode) return null;

  return {
    id: eventId({
      locationId,
      type: 'mold',
      severity: episode.severity,
      startTime: episode.startTime,
    }),
    type: 'mold',
    severity: episode.severity,
    locationId,
    startTime: episode.startTime,
    endTime: episode.endTime,
    peakTime: episode.peak.timestamp,
    factor: 'mold_potential',
    previousCategory: categoryLabel(currentCategory),
    category: eventCategoryLabel(episode.severity),
    currentValue: environment.current.moldPotential.score,
    peakValue: episode.peak.value,
    confidence: 'medium',
    evidence: [
      {
        variable: 'mold_potential',
        value: episode.peak.value,
        previousValue: environment.current.moldPotential.score,
        unit: '%',
        time: episode.peak.timestamp,
        role: 'primary',
      },
    ],
    title: 'Mold potential',
    body: `Mold potential is expected to become ${eventCategoryLabel(
      episode.severity,
    )} ${timePhrase(
      {
        startTime: episode.startTime,
        endTime: episode.endTime,
        peakTime: episode.peak.timestamp,
      } as EnvironmentalEvent,
      environment.current.timestamp ?? environment.fetchedAt,
    )}.`,
    priority: 20,
  };
}

function headlineEvent(
  environment: NormalizedEnvironment,
  hours: HourlyEnvironmentalReading[],
  options: DetectionOptions,
): CandidateEvent | null {
  const currentEnvironmental = calculateEnvironmentalScore(environment.current);
  const currentPersonalized = calculatePersonalizedScore(environment.current, options.profile);
  const usePersonalized = currentPersonalized.available;
  const current = usePersonalized ? currentPersonalized : currentEnvironmental;
  if (!current.available || current.category === 'unavailable') return null;

  const points = hours.flatMap((hour) => {
    const score = usePersonalized
      ? calculatePersonalizedScore(hour, options.profile)
      : calculateEnvironmentalScore(hour);
    if (!score.available || !isFiniteNumber(score.score)) return [];
    const point = pointFromScore({
      timestamp: hour.timestamp,
      value: score.score,
      score: score.score,
      currentCategory: current.category,
    });
    return point ? [point] : [];
  });
  const episode = firstMeaningfulEpisode(points);
  if (!episode) return null;
  const title = usePersonalized ? 'Personalized environmental risk' : 'Environmental burden';

  return {
    id: eventId({
      locationId: options.locationId,
      type: 'headline-risk',
      severity: episode.severity,
      startTime: episode.startTime,
    }),
    type: 'headline-risk',
    severity: episode.severity,
    locationId: options.locationId,
    startTime: episode.startTime,
    endTime: episode.endTime,
    peakTime: episode.peak.timestamp,
    factor: usePersonalized ? 'personalized' : 'environmental',
    previousCategory: categoryLabel(current.category),
    category: eventCategoryLabel(episode.severity),
    currentValue: current.score,
    peakValue: episode.peak.value,
    confidence: 'medium',
    evidence: [
      {
        variable: usePersonalized ? 'personalized_risk' : 'environmental_burden',
        value: episode.peak.value,
        previousValue: current.score,
        unit: '%',
        time: episode.peak.timestamp,
        role: 'primary',
      },
    ],
    title,
    body: `${title} is expected to become ${eventCategoryLabel(episode.severity)} ${timePhrase(
      {
        startTime: episode.startTime,
        endTime: episode.endTime,
        peakTime: episode.peak.timestamp,
      } as EnvironmentalEvent,
      environment.current.timestamp ?? environment.fetchedAt,
    )}.`,
    priority: 10,
  };
}

function correlate(events: CandidateEvent[]): EnvironmentalEvent[] {
  const hasDust = events.some((event) => event.type === 'saharan-dust');
  const hasWildfire = events.some((event) => event.type === 'wildfire-pollution');
  const sourceAttributed = hasDust || hasWildfire;

  return sortCandidateEvents(
    events.filter((event) => {
      if (event.type === 'aerosol' && sourceAttributed) return false;
      if (
        event.type === 'pollution' &&
        sourceAttributed &&
        (event.factor === 'pm10' || event.factor === 'pm25')
      ) {
        return false;
      }
      return true;
    }),
  ).map(stripPriority);
}

export function detectEnvironmentalEvents(
  environment: NormalizedEnvironment | null,
  options: DetectionOptions,
): EnvironmentalEvent[] {
  if (!environment) return [];
  const hours = forecastWindow(environment, options.horizonHours);
  if (hours.length === 0) return [];

  const candidates: CandidateEvent[] = [
    ...pollenEvents(environment, hours, options.locationId),
    ...pollutionEvents(environment, hours, options.locationId),
  ];
  const dust = dustEvent(environment, hours, options.locationId);
  if (dust) candidates.push(dust);
  const wildfire = wildfireEvent(environment, hours, options.locationId);
  if (wildfire) candidates.push(wildfire);
  const aerosol = aerosolEvent(environment, hours, options.locationId);
  if (aerosol) candidates.push(aerosol);
  const uv = uvEvent(environment, hours, options.locationId);
  if (uv) candidates.push(uv);
  const mold = moldEvent(environment, hours, options.locationId);
  if (mold) candidates.push(mold);
  const headline = headlineEvent(environment, hours, options);
  if (headline) candidates.push(headline);

  return correlate(candidates).slice(0, 6);
}

function environmentalEventNotificationCategory(
  event: EnvironmentalEvent,
): EnvironmentalEventNotificationCategory {
  switch (event.type) {
    case 'pollen':
      return 'pollen';
    case 'pollution':
    case 'aerosol':
      return 'airPollution';
    case 'saharan-dust':
      return 'saharanDust';
    case 'wildfire-pollution':
      return 'wildfirePollution';
    case 'uv':
      return 'uv';
    case 'mold':
      return 'mold';
    case 'headline-risk':
      return 'headlineRisk';
  }
}

function episodeBucket(timestamp: string): string {
  const time = Date.parse(timestamp);
  if (!Number.isFinite(time)) return timestamp;
  const date = new Date(time);
  date.setUTCMinutes(0, 0, 0);
  return date.toISOString();
}

function environmentalEventFingerprint(event: EnvironmentalEvent): string {
  return [
    event.locationId,
    event.type,
    event.factor ?? '',
    event.severity,
    episodeBucket(event.startTime),
  ].join(':');
}

export function freshEnvironmentalEventNotificationState(
  state: EnvironmentalEventNotificationState | null,
  now = new Date(),
): EnvironmentalEventNotificationState {
  const cutoff = now.getTime() - EVENT_NOTIFICATION_TTL_MS;
  return {
    version: 1,
    records: (state?.records ?? []).filter((record) => Date.parse(record.deliveredAt) >= cutoff),
  };
}

export function environmentalEventNeedsNotification(input: {
  event: EnvironmentalEvent;
  settings: AppSettings;
  state: EnvironmentalEventNotificationState | null;
  now?: Date | undefined;
}): boolean {
  const category = environmentalEventNotificationCategory(input.event);
  if (!input.settings.environmentalEventNotifications[category]) return false;
  const state = freshEnvironmentalEventNotificationState(input.state, input.now);
  const fingerprint = environmentalEventFingerprint(input.event);
  const previous = state.records.find((record) => record.fingerprint === fingerprint);
  if (!previous) return true;
  return SEVERITY_RANK[input.event.severity] > SEVERITY_RANK[previous.severity];
}

export function environmentalEventNotificationStateAfterDelivery(input: {
  event: EnvironmentalEvent;
  state: EnvironmentalEventNotificationState | null;
  deliveredAt?: string | undefined;
}): EnvironmentalEventNotificationState {
  const deliveredAt = input.deliveredAt ?? new Date().toISOString();
  const fingerprint = environmentalEventFingerprint(input.event);
  const fresh = freshEnvironmentalEventNotificationState(input.state, new Date(deliveredAt));

  return {
    version: 1,
    records: [
      { fingerprint, severity: input.event.severity, deliveredAt },
      ...fresh.records.filter((record) => record.fingerprint !== fingerprint),
    ],
  };
}

export function formatEnvironmentalEventNotification(event: EnvironmentalEvent): {
  title: string;
  body: string;
} {
  return {
    title: environmentalEventTitle(event),
    body: environmentalEventBody(event),
  };
}

export function staleForecastCanDisplayEvents(environment: NormalizedEnvironment): boolean {
  if (environment.metadata.partial === true) return false;

  const providerTimestamps = [
    environment.metadata.airQualitySource !== 'unavailable'
      ? environment.metadata.airQualityFetchedAt
      : null,
    environment.metadata.weatherSource !== 'unavailable'
      ? environment.metadata.weatherFetchedAt
      : null,
  ].filter((timestamp): timestamp is string => typeof timestamp === 'string');

  if (providerTimestamps.length === 0) return false;

  const now = Date.now();
  return providerTimestamps.every((timestamp) => {
    const fetchedAt = Date.parse(timestamp);
    return Number.isFinite(fetchedAt) && now - fetchedAt <= ENVIRONMENT_PROVIDER_FRESHNESS_MS;
  });
}

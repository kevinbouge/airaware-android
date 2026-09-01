import { z } from 'zod';
import {
  RADIATION_BASELINE_MIN_SAMPLES,
  RADIATION_BASELINE_PERIOD_DAYS,
  RADIATION_QUERY_LIMIT,
  RADIATION_SEARCH_RADII_METERS,
  calculateRadiationBaseline,
  calculateRadiationTrend,
  interpretRadiation,
  normalizeDoseRate,
  radiologicalObservationToEvidence,
  radiologicalObservationToHistory,
  selectBestRadiologicalObservation,
  type RadiologicalObservation,
} from '../../core/radiologicalSignals';
import type {
  HealthGeography,
  HealthSignal,
  HealthSignalProvider,
  HealthSignalProviderContext,
  HealthSignalType,
} from '../../models/healthSignals';
import type { Coordinates } from '../../models/environment';
import {
  RADIATION_MONITORING_FRESHNESS,
  calculateHealthSignalFreshness,
} from '../../services/healthSignalFreshness';
import { distanceMeters as distanceBetweenCoordinates } from '../../utils/geo';
import {
  HealthProviderSchemaError,
  fetchHealthJson,
  providerErrorSignal,
  signalProviderStatus,
} from './providerFetch';

const SAFECAST_RADIATION_ENDPOINT = 'https://simplemap.safecast.org/api/radiation';
const SAFECAST_SENSOR_ENDPOINT = 'https://simplemap.safecast.org/api/sensor';

const safecastLocationSchema = z
  .object({
    latitude: z.number(),
    longitude: z.number(),
  })
  .passthrough();

const safecastMeasurementSchema = z
  .object({
    id: z.union([z.number(), z.string()]).optional(),
    value: z.number(),
    unit: z.string(),
    captured_at: z.string(),
    distance_m: z.number().optional().nullable(),
    location: safecastLocationSchema,
    track_id: z.union([z.number(), z.string()]).optional().nullable(),
    device_id: z.union([z.number(), z.string()]).optional().nullable(),
    detector: z.string().optional().nullable(),
    type: z.string().optional().nullable(),
  })
  .passthrough();

const safecastRadiationResponseSchema = z
  .object({
    measurements: z.array(z.unknown()).optional(),
  })
  .passthrough();

export function safecastRadiationUrl(input: {
  coordinates: Coordinates;
  radiusMeters: number;
  limit?: number | undefined;
}): string {
  const url = new URL(SAFECAST_RADIATION_ENDPOINT);
  url.searchParams.set('lat', input.coordinates.latitude.toFixed(6));
  url.searchParams.set('lon', input.coordinates.longitude.toFixed(6));
  url.searchParams.set('radius', Math.round(input.radiusMeters).toString());
  url.searchParams.set('limit', (input.limit ?? RADIATION_QUERY_LIMIT).toString());
  return url.toString();
}

export function radiologicalSpatialCacheKey(coordinates: Coordinates): string {
  return [
    'radiological',
    'safecast',
    Math.round(coordinates.latitude * 10) / 10,
    Math.round(coordinates.longitude * 10) / 10,
  ].join(':');
}

export function safecastSensorHistoryUrl(input: {
  sensorId: string;
  now: string;
  periodDays?: number | undefined;
  limit?: number | undefined;
}): string {
  const end = new Date(input.now);
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - (input.periodDays ?? RADIATION_BASELINE_PERIOD_DAYS));

  const url = new URL(`${SAFECAST_SENSOR_ENDPOINT}/${encodeURIComponent(input.sensorId)}/history`);
  url.searchParams.set('start_date', start.toISOString().slice(0, 10));
  url.searchParams.set('end_date', end.toISOString().slice(0, 10));
  url.searchParams.set('limit', (input.limit ?? RADIATION_QUERY_LIMIT).toString());
  return url.toString();
}

function localRadiologicalGeography(input: {
  coordinates: Coordinates;
  locationName?: string | null | undefined;
}): HealthGeography {
  return {
    level: 'local',
    code: radiologicalSpatialCacheKey(input.coordinates),
    name: input.locationName ?? 'Nearby radiation monitor',
  };
}

function measurementDistanceKm(input: {
  distanceMeters?: number | null | undefined;
  location: Coordinates;
  originCoordinates?: Coordinates | undefined;
}): number {
  if (typeof input.distanceMeters === 'number' && Number.isFinite(input.distanceMeters)) {
    return input.distanceMeters / 1000;
  }
  if (input.originCoordinates) {
    return distanceBetweenCoordinates(input.originCoordinates, input.location) / 1000;
  }

  return Number.POSITIVE_INFINITY;
}

export function normalizeSafecastRadiationMeasurements(
  payload: unknown,
  options: { originCoordinates?: Coordinates | undefined } = {},
): RadiologicalObservation[] {
  const parsed = safecastRadiationResponseSchema.safeParse(payload);
  if (!parsed.success) {
    throw new HealthProviderSchemaError('Invalid Safecast radiation response');
  }
  if (!Array.isArray(parsed.data.measurements)) return [];

  return parsed.data.measurements.flatMap((rawMeasurement) => {
    const measurement = safecastMeasurementSchema.safeParse(rawMeasurement);
    if (!measurement.success) return [];

    const doseRate = normalizeDoseRate(measurement.data.value, measurement.data.unit);
    const measuredAtTime = Date.parse(measurement.data.captured_at);
    if (!doseRate || !Number.isFinite(measuredAtTime)) return [];

    const distanceKm = measurementDistanceKm({
      distanceMeters: measurement.data.distance_m,
      location: measurement.data.location,
      originCoordinates: options.originCoordinates,
    });
    const providerId =
      measurement.data.device_id?.toString() ??
      measurement.data.track_id?.toString() ??
      measurement.data.id?.toString() ??
      [
        measurement.data.location.latitude.toFixed(5),
        measurement.data.location.longitude.toFixed(5),
      ].join(',');

    return [
      {
        type: 'ambient-dose-rate',
        value: doseRate.value,
        unit: doseRate.unit,
        measuredAt: new Date(measuredAtTime).toISOString(),
        sensor: {
          providerId,
          latitude: measurement.data.location.latitude,
          longitude: measurement.data.location.longitude,
          distanceKm,
        },
        source: {
          provider: 'safecast',
          dataset: 'Safecast radiation measurements',
        },
        rawMeasurementType:
          measurement.data.detector ?? measurement.data.type ?? doseRate.originalUnit,
        measurementId: measurement.data.id?.toString(),
      } satisfies RadiologicalObservation,
    ];
  });
}

async function fetchSafecastSensorHistory(input: {
  sensorId: string;
  now: string;
}): Promise<RadiologicalObservation[]> {
  try {
    return normalizeSafecastRadiationMeasurements(
      await fetchHealthJson(safecastSensorHistoryUrl(input)),
    );
  } catch {
    return [];
  }
}

function noRecentRadiologicalSignal(input: {
  coordinates: Coordinates;
  now: string;
  locationName?: string | null | undefined;
}): HealthSignal {
  const geography = localRadiologicalGeography(input);

  return {
    id: `${geography.code}:ambient-dose-rate:unavailable`,
    domain: 'radiological',
    type: 'ambient-dose-rate',
    geography,
    updatedAt: input.now,
    category: 'unknown',
    trend: 'unknown',
    source: {
      provider: 'Safecast',
      dataset: 'Safecast radiation measurements',
      measure: 'Nearby calibrated ambient dose-rate measurements',
    },
    freshness: { status: 'fresh', ageMs: 0 },
    temporalClass: 'current',
    metadata: {
      unavailable: true,
      reason: 'no-recent-local-radiological-measurement',
    },
  };
}

function radiologicalProviderErrorSignal(input: {
  coordinates: Coordinates;
  now: string;
  locationName?: string | null | undefined;
  error?: unknown;
}): HealthSignal {
  const geography = localRadiologicalGeography(input);

  return providerErrorSignal({
    id: `${geography.code}:ambient-dose-rate:provider-error`,
    domain: 'radiological',
    type: 'ambient-dose-rate',
    geography,
    now: input.now,
    source: {
      provider: 'Safecast',
      dataset: 'Safecast radiation measurements',
      measure: 'Nearby calibrated ambient dose-rate measurements',
    },
    reason: 'safecast-provider-error',
    error: input.error,
  });
}

export function radiologicalSignalFromSafecast(input: {
  coordinates: Coordinates;
  observations: RadiologicalObservation[];
  currentObservation?: RadiologicalObservation | undefined;
  now: string;
  locationName?: string | null | undefined;
}): HealthSignal {
  const current =
    input.currentObservation ??
    selectBestRadiologicalObservation({
      observations: input.observations,
      now: input.now,
      staleAfterMs: RADIATION_MONITORING_FRESHNESS.staleAfterMs,
    });
  if (!current) {
    return noRecentRadiologicalSignal(input);
  }

  const sameSensorBaseline = calculateRadiationBaseline({
    observations: input.observations,
    now: input.now,
    sensorId: current.sensor.providerId,
    before: current.measuredAt,
  });
  const baseline =
    sameSensorBaseline ??
    calculateRadiationBaseline({
      observations: input.observations,
      now: input.now,
      before: current.measuredAt,
    });
  const interpretation = interpretRadiation({ current: current.value, baseline });
  const freshness = calculateHealthSignalFreshness({
    updatedAt: current.measuredAt,
    now: input.now,
    policy: RADIATION_MONITORING_FRESHNESS,
  });
  const geography = localRadiologicalGeography({
    coordinates: input.coordinates,
    locationName: input.locationName,
  });

  return {
    id: `${geography.code}:ambient-dose-rate:${current.sensor.providerId}`,
    domain: 'radiological',
    type: 'ambient-dose-rate',
    geography,
    observedAt: current.measuredAt,
    periodEnd: current.measuredAt,
    updatedAt: current.measuredAt,
    value: current.value,
    unit: current.unit,
    category: interpretation.status,
    trend: calculateRadiationTrend({ current, observations: input.observations }),
    source: {
      provider: 'Safecast',
      dataset: 'Safecast radiation measurements',
      measure: 'Nearby calibrated ambient dose-rate measurements',
    },
    freshness,
    temporalClass: 'current',
    history: [...input.observations]
      .sort((left, right) => Date.parse(right.measuredAt) - Date.parse(left.measuredAt))
      .slice(0, 24)
      .map(radiologicalObservationToHistory),
    evidence: [radiologicalObservationToEvidence(current)],
    metadata: {
      baseline: interpretation.baseline,
      baselinePeriodDays: RADIATION_BASELINE_PERIOD_DAYS,
      baselineMinimumSamples: RADIATION_BASELINE_MIN_SAMPLES,
      ratioToBaseline: interpretation.ratioToBaseline,
      nearestSensorDistanceKm: current.sensor.distanceKm,
      sensorId: current.sensor.providerId,
      measuredAt: current.measuredAt,
    },
  };
}

export const safecastRadiologicalProvider: HealthSignalProvider = {
  id: 'safecast-radiological',
  access: 'anonymous',
  coverage: 'local',
  authority: 'local-network',
  regions: ['global'],
  signals: ['ambient-dose-rate'],
  temporalClasses: ['current'],
  documentationUrl: 'https://simplemap.safecast.org/map-api/index.html',
  supports: (context: HealthSignalProviderContext) =>
    Boolean(context.coordinates) &&
    (context.signalTypes === undefined ||
      context.signalTypes.some((type: HealthSignalType) => type === 'ambient-dose-rate')),
  fetchSignals: async (context) => {
    if (!context.coordinates) {
      return {
        providerId: 'safecast-radiological',
        fetchedAt: context.now,
        signals: [],
        unavailableSignals: ['ambient-dose-rate'],
      };
    }

    const payloads = [];
    for (const radiusMeters of RADIATION_SEARCH_RADII_METERS) {
      let payload: unknown;
      try {
        payload = await fetchHealthJson(
          safecastRadiationUrl({
            coordinates: context.coordinates,
            radiusMeters,
          }),
        );
      } catch (error) {
        const signal = radiologicalProviderErrorSignal({
          coordinates: context.coordinates,
          now: context.now,
          locationName: context.geography?.name,
          error,
        });

        return {
          providerId: 'safecast-radiological',
          fetchedAt: context.now,
          signals: [signal],
          unavailableSignals: ['ambient-dose-rate'],
          signalStatuses: [signalProviderStatus(signal)],
        };
      }

      payloads.push(payload);
      const observations = payloads.flatMap((item) =>
        normalizeSafecastRadiationMeasurements(item, { originCoordinates: context.coordinates }),
      );
      const current = selectBestRadiologicalObservation({
        observations,
        now: context.now,
        staleAfterMs: RADIATION_MONITORING_FRESHNESS.staleAfterMs,
      });
      if (current) {
        const history = await fetchSafecastSensorHistory({
          sensorId: current.sensor.providerId,
          now: context.now,
        });
        const observationsWithHistory = [...observations, ...history];

        return {
          providerId: 'safecast-radiological',
          fetchedAt: context.now,
          signals: [
            radiologicalSignalFromSafecast({
              coordinates: context.coordinates,
              observations: observationsWithHistory,
              currentObservation: current,
              now: context.now,
              locationName: context.geography?.name,
            }),
          ],
          signalStatuses: [{ type: 'ambient-dose-rate', status: 'available' }],
        };
      }
    }

    return {
      providerId: 'safecast-radiological',
      fetchedAt: context.now,
      signals: [
        noRecentRadiologicalSignal({
          coordinates: context.coordinates,
          now: context.now,
          locationName: context.geography?.name,
        }),
      ],
      unavailableSignals: ['ambient-dose-rate'],
      signalStatuses: [
        {
          type: 'ambient-dose-rate',
          status: 'no-data',
          reason: 'no-recent-local-radiological-measurement',
        },
      ],
    };
  },
};

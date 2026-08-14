import type { ProviderId } from '../capabilities/types';
import type { Coordinates } from '../models/environment';

function coordinateKey(coordinates: Coordinates): string {
  return `${coordinates.latitude.toFixed(5)},${coordinates.longitude.toFixed(5)}`;
}

function variableSetKey(variables: readonly string[] = []): string {
  return Array.from(new Set(variables)).sort().join(',');
}

export const airAwareQueryKeys = {
  airQuality: (
    providerId: ProviderId,
    coordinates: Coordinates,
    variables: readonly string[] = [],
  ) => ['airQuality', providerId, coordinateKey(coordinates), variableSetKey(variables)] as const,
  weather: (providerId: ProviderId, coordinates: Coordinates, variables: readonly string[] = []) =>
    ['weather', providerId, coordinateKey(coordinates), variableSetKey(variables)] as const,
  vegetation: (coordinates: Coordinates) => ['vegetation', coordinateKey(coordinates)] as const,
  dataDetail: (input: {
    coordinates: Coordinates;
    variableId: string;
    rangeId: string;
    localDateKey: string;
  }) =>
    [
      'dataDetail',
      coordinateKey(input.coordinates),
      input.variableId,
      input.rangeId,
      input.localDateKey,
    ] as const,
  dataDetailSource: (input: {
    coordinates: Coordinates;
    variableId: string;
    source: string;
    startDate?: string | undefined;
    endDate?: string | undefined;
    forecastHours?: number | undefined;
  }) =>
    [
      'dataDetailSource',
      coordinateKey(input.coordinates),
      input.variableId,
      input.source,
      input.startDate ?? '',
      input.endDate ?? '',
      input.forecastHours ?? '',
    ] as const,
};

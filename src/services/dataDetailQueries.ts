import { fetchDataDetailSource } from '../api/openMeteoDataDetail';
import type { DataDetailSource, DataDetailVariableDefinition } from '../models/dataDetail';
import type { Coordinates } from '../models/environment';
import { queryClient, providerStaleTimes } from './queryClient';
import { airAwareQueryKeys } from './queryKeys';

function dataDetailSourceStaleTime(source: DataDetailSource): number {
  return source === 'history'
    ? providerStaleTimes.dataDetailHistory
    : providerStaleTimes.dataDetailForecast;
}

export function fetchDataDetailSourceQuery(input: {
  coordinates: Coordinates;
  variable: DataDetailVariableDefinition;
  source: DataDetailSource;
  startDate?: string | undefined;
  endDate?: string | undefined;
  forecastHours?: number | undefined;
}) {
  return queryClient.fetchQuery({
    queryKey: airAwareQueryKeys.dataDetailSource({
      coordinates: input.coordinates,
      variableId: input.variable.id,
      source: input.source,
      startDate: input.startDate,
      endDate: input.endDate,
      forecastHours: input.forecastHours,
    }),
    staleTime: dataDetailSourceStaleTime(input.source),
    queryFn: () => fetchDataDetailSource(input),
  });
}

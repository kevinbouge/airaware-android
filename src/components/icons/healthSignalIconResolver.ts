import type { HealthSignal } from '../../models/healthSignals';
import type { AppIconName } from './appIconTypes';

export function getHealthSignalIconName(
  signal: Pick<HealthSignal, 'domain' | 'type'>,
): AppIconName {
  if (signal.domain === 'radiological') return 'radiological';
  if (signal.domain === 'population-health') return 'population-health';
  if (signal.type === 'outbreak-event') return 'outbreak';

  switch (signal.type) {
    case 'wastewater-covid-19':
    case 'wastewater-influenza':
    case 'wastewater-rsv':
      return 'wastewater';
    case 'dengue':
    case 'chikungunya':
    case 'west-nile':
    case 'malaria':
    case 'tick-borne-disease':
      return 'vector-borne';
    case 'measured-mold-spores':
      return 'measured-spores';
    default:
      return 'respiratory';
  }
}

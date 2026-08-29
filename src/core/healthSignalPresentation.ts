import type { DimensionValue } from 'react-native';
import type { DataDetailRangeId } from '../models/dataDetail';
import type { HealthSignal } from '../models/healthSignals';
import { colors } from '../theme/theme';
import { formatMeasurement } from '../utils/format';

interface RangeSelection {
  signalId: string | null;
  rangeId: DataDetailRangeId;
}

export interface TimelineFillStyle {
  backgroundColor: string;
  left?: DimensionValue | undefined;
  position?: 'absolute' | undefined;
  width: DimensionValue;
}

export function healthSignalDetailDefaultRange(signal: HealthSignal): DataDetailRangeId {
  if (signal.type === 'thermal-stress' || signal.type === 'ambient-dose-rate') {
    return '24h';
  }

  const periodType = signal.reportingPeriod?.type ?? signal.history?.at(-1)?.period?.type;
  if (periodType === 'week' || periodType === 'month' || periodType === 'year') {
    return 'year';
  }

  return '24h';
}

export function selectedHealthSignalDetailRange(
  signal: HealthSignal | undefined,
  rangeSelection: RangeSelection,
): DataDetailRangeId {
  if (!signal) return '24h';
  if (rangeSelection.signalId === signal.id) return rangeSelection.rangeId;
  return healthSignalDetailDefaultRange(signal);
}

export function timelinePositionPercent(value: number, min: number, max: number): number {
  if (max <= min) return 0;
  const ratio = ((value - min) / (max - min)) * 100;
  return Math.max(0, Math.min(100, ratio));
}

export function healthTimelinePointValueLabel(
  point: { value: number | null; unit: string | null },
  signal: Pick<HealthSignal, 'type'>,
): string {
  const precision = signal.type === 'ambient-dose-rate' ? 2 : 1;
  const formatted = formatMeasurement(point.value, point.unit ?? '', precision);
  return signal.type === 'excess-mortality' && point.value !== null && point.value > 0
    ? `+${formatted}`
    : formatted;
}

export function healthTimelineFillStyle(input: {
  value: number;
  min: number;
  max: number;
  signalType: HealthSignal['type'];
}): TimelineFillStyle {
  if (input.signalType !== 'excess-mortality') {
    const ratio = timelinePositionPercent(input.value, input.min, input.max);
    return {
      backgroundColor: colors.primary,
      width: `${Math.max(2, Math.min(100, ratio))}%`,
    };
  }

  const baseline = timelinePositionPercent(0, input.min, input.max);
  const valuePosition = timelinePositionPercent(input.value, input.min, input.max);
  const left = Math.min(baseline, valuePosition);
  const width = Math.max(2, Math.abs(valuePosition - baseline));

  return {
    backgroundColor: input.value >= 0 ? colors.high : colors.low,
    left: `${left}%`,
    position: 'absolute',
    width: `${width}%`,
  };
}

export function todayHealthSectionVisibility(input: {
  contextualHealthSignalCount: number;
  hasHealthSignalLocationContext: boolean;
  healthSignalsError: string | null;
  healthSignalsLoading: boolean;
  thermalSignalCount: number;
}): { shouldShowHealthSignals: boolean; shouldShowThermalSignals: boolean } {
  return {
    shouldShowHealthSignals:
      input.hasHealthSignalLocationContext &&
      (input.healthSignalsLoading ||
        input.healthSignalsError !== null ||
        input.contextualHealthSignalCount > 0),
    shouldShowThermalSignals: input.hasHealthSignalLocationContext && input.thermalSignalCount > 0,
  };
}

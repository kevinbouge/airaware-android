import type { DataDetailTimeline } from '../models/dataDetail';

export function visibleCurrentDataDetailValue(input: {
  environmentCurrentValue: number | null;
  timeline: DataDetailTimeline | null;
}): number | null {
  return input.environmentCurrentValue ?? input.timeline?.summary.current ?? null;
}

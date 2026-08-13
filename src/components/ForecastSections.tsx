import { StyleSheet, Text, View } from 'react-native';
import { colors } from '../theme/theme';
import { ForecastBarRow } from './ui/ForecastBarRow';
import { SectionCard } from './SectionCard';

export interface ForecastBarItem {
  key: string;
  label: string;
  value: string;
  accent: string;
  fillPercent: number | null;
  accessibilityLabel: string;
  highlighted?: boolean;
  markerLabel?: string;
  reserveMarkerSpace?: boolean;
  valueMinWidth?: number;
}

export type ForecastTimelineItem = ForecastBarItem;

export function ForecastBarSection({
  title,
  rows,
  emptyLabel,
}: {
  title: string;
  rows: readonly ForecastBarItem[];
  emptyLabel: string;
}) {
  return (
    <SectionCard title={title}>
      {rows.length > 0 ? (
        rows.map((row) => (
          <ForecastBarRow
            key={row.key}
            accessibilityLabel={row.accessibilityLabel}
            accent={row.accent}
            fillPercent={row.fillPercent}
            label={row.label}
            value={row.value}
            {...(row.highlighted !== undefined ? { highlighted: row.highlighted } : {})}
            {...(row.markerLabel !== undefined ? { markerLabel: row.markerLabel } : {})}
            {...(row.reserveMarkerSpace !== undefined
              ? { reserveMarkerSpace: row.reserveMarkerSpace }
              : {})}
            {...(row.valueMinWidth !== undefined ? { valueMinWidth: row.valueMinWidth } : {})}
          />
        ))
      ) : (
        <Text style={styles.empty}>{emptyLabel}</Text>
      )}
    </SectionCard>
  );
}

export function ForecastTimeline({
  rows,
  emptyLabel,
}: {
  rows: readonly ForecastTimelineItem[];
  emptyLabel: string;
}) {
  if (rows.length === 0) {
    return <Text style={styles.empty}>{emptyLabel}</Text>;
  }

  return (
    <View style={styles.timeline}>
      {rows.map((row) => (
        <ForecastBarRow
          key={row.key}
          accessibilityLabel={row.accessibilityLabel}
          accent={row.accent}
          fillPercent={row.fillPercent}
          label={row.label}
          value={row.value}
          {...(row.highlighted !== undefined ? { highlighted: row.highlighted } : {})}
          {...(row.markerLabel !== undefined ? { markerLabel: row.markerLabel } : {})}
          {...(row.reserveMarkerSpace !== undefined
            ? { reserveMarkerSpace: row.reserveMarkerSpace }
            : {})}
          {...(row.valueMinWidth !== undefined ? { valueMinWidth: row.valueMinWidth } : {})}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  empty: {
    color: colors.muted,
    fontSize: 14,
    fontStyle: 'italic',
  },
  timeline: {
    gap: 2,
  },
});

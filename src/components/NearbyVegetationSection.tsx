import { StyleSheet, Text } from 'react-native';
import { ReadingRow } from './ReadingRow';
import { SectionCard } from './SectionCard';
import type {
  NormalizedVegetationContext,
  VegetationCategoryId,
  VegetationTaxonId,
} from '../models/vegetation';
import { colors } from '../theme/theme';
import { formatDistanceMeters } from '../utils/format';

interface NearbyVegetationSectionProps {
  vegetation: NormalizedVegetationContext | null;
  stale: boolean;
  loading: boolean;
  error: string | null;
  collapsed: boolean;
  onToggle: () => void;
}

interface VegetationRow {
  id: string;
  label: string;
  value: string;
}

const CATEGORY_LABELS: Record<VegetationCategoryId, string> = {
  woodland: 'Woodland',
  grassland: 'Grassland',
  meadow: 'Meadow',
  orchard: 'Orchard',
  scrub: 'Scrub',
  parkland: 'Parkland',
  farmland: 'Farmland',
};

const TAXON_LABELS: Record<VegetationTaxonId, string> = {
  birch: 'Mapped birch',
  alder: 'Mapped alder',
  olive: 'Mapped olive',
};

export const NEARBY_VEGETATION_SECTION_ID = 'data.nearbyVegetation';

export function nearbyVegetationRows(
  vegetation: NormalizedVegetationContext | null,
): VegetationRow[] {
  if (!vegetation) return [];

  const categoryRows = Object.entries(CATEGORY_LABELS).flatMap(([id, label]) => {
    const category = vegetation.categories[id as VegetationCategoryId];
    if (!category.present || category.nearestMeters === null) return [];

    return [
      {
        id,
        label,
        value: formatDistanceMeters(category.nearestMeters),
      },
    ];
  });
  const taxonRows = Object.entries(TAXON_LABELS).flatMap(([id, label]) => {
    const taxon = vegetation.mappedTaxa[id as VegetationTaxonId];
    if (taxon.featureCount <= 0) return [];

    return [
      {
        id: `taxon.${id}`,
        label,
        value:
          taxon.nearestMeters === null
            ? String(taxon.featureCount)
            : `${taxon.featureCount} · nearest ${formatDistanceMeters(taxon.nearestMeters)}`,
      },
    ];
  });

  return [...categoryRows, ...taxonRows];
}

export function NearbyVegetationSection({
  vegetation,
  stale,
  loading,
  error,
  collapsed,
  onToggle,
}: NearbyVegetationSectionProps) {
  const rows = nearbyVegetationRows(vegetation);

  return (
    <SectionCard
      title="Nearby vegetation"
      subtitle={stale ? 'Cached data' : undefined}
      collapsible
      collapsed={collapsed}
      onToggle={onToggle}
    >
      {rows.length > 0 ? (
        rows.map((row) => <ReadingRow key={row.id} label={row.label} value={row.value} />)
      ) : (
        <Text style={styles.empty}>
          {loading
            ? 'Loading nearby vegetation...'
            : 'No nearby vegetation features were found in OpenStreetMap.'}
        </Text>
      )}
      {error && rows.length === 0 ? <Text style={styles.notice}>{error}</Text> : null}
    </SectionCard>
  );
}

const styles = StyleSheet.create({
  empty: {
    color: colors.muted,
    fontSize: 14,
    fontStyle: 'italic',
  },
  notice: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 18,
  },
});

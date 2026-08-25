import { StyleSheet, Text } from 'react-native';
import { useTranslation } from 'react-i18next';
import { ReadingRow } from './ReadingRow';
import { SectionCard } from './SectionCard';
import {
  getVegetationCategoryIconName,
  getVegetationTaxonIconName,
} from './icons/environmentalIconResolver';
import type { EnvironmentalIconName } from './icons/environmentalIconTypes';
import type {
  NormalizedVegetationContext,
  VegetationCategoryId,
  VegetationTaxonId,
} from '../models/vegetation';
import { colors } from '../theme/theme';
import { formatDistanceMeters } from '../utils/format';
import { translate } from '../i18n';

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
  iconName: EnvironmentalIconName;
}

const CATEGORY_LABEL_KEYS: Record<VegetationCategoryId, string> = {
  woodland: 'environment.vegetation.woodland',
  grassland: 'environment.vegetation.grassland',
  meadow: 'environment.vegetation.meadow',
  orchard: 'environment.vegetation.orchard',
  scrub: 'environment.vegetation.scrub',
  parkland: 'environment.vegetation.parkland',
  farmland: 'environment.vegetation.farmland',
};

const TAXON_LABEL_KEYS: Record<VegetationTaxonId, string> = {
  birch: 'environment.vegetation.mappedBirch',
  alder: 'environment.vegetation.mappedAlder',
  olive: 'environment.vegetation.mappedOlive',
};

export const NEARBY_VEGETATION_SECTION_ID = 'data.nearbyVegetation';

export function nearbyVegetationRows(
  vegetation: NormalizedVegetationContext | null,
): VegetationRow[] {
  if (!vegetation) return [];

  const categoryRows = Object.entries(CATEGORY_LABEL_KEYS).flatMap(([id, labelKey]) => {
    const category = vegetation.categories[id as VegetationCategoryId];
    if (!category.present || category.nearestMeters === null) return [];

    return [
      {
        id,
        iconName: getVegetationCategoryIconName(id as VegetationCategoryId),
        label: translate(labelKey),
        value: formatDistanceMeters(category.nearestMeters),
      },
    ];
  });
  const taxonRows = Object.entries(TAXON_LABEL_KEYS).flatMap(([id, labelKey]) => {
    const taxon = vegetation.mappedTaxa[id as VegetationTaxonId];
    if (taxon.featureCount <= 0) return [];

    return [
      {
        id: `taxon.${id}`,
        iconName: getVegetationTaxonIconName(id as VegetationTaxonId),
        label: translate(labelKey),
        value:
          taxon.nearestMeters === null
            ? String(taxon.featureCount)
            : translate('environment.vegetation.featureCountWithNearest', {
                count: taxon.featureCount,
                distance: formatDistanceMeters(taxon.nearestMeters),
              }),
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
  const { t } = useTranslation();
  const rows = nearbyVegetationRows(vegetation);

  return (
    <SectionCard
      title={t('features.nearbyVegetation')}
      subtitle={stale ? t('today.cachedData') : undefined}
      collapsible
      collapsed={collapsed}
      onToggle={onToggle}
    >
      {rows.length > 0 ? (
        rows.map((row) => (
          <ReadingRow key={row.id} iconName={row.iconName} label={row.label} value={row.value} />
        ))
      ) : (
        <Text style={styles.empty}>
          {loading ? t('environment.vegetation.loading') : t('environment.vegetation.empty')}
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

import type { ReactNode } from 'react';
import { Text, StyleSheet } from 'react-native';
import { ReadingRow } from './ReadingRow';
import { SectionCard } from './SectionCard';
import {
  irritantVariableId,
  isEnvironmentalVariableAvailable,
  pollenVariableId,
  pollutantVariableId,
} from '../capabilities/variables';
import type { CurrentEnvironmentalReadings } from '../models/environment';
import type { AppCapabilities, EnvironmentalVariableId } from '../capabilities/types';
import { formatMeasurement, formatNumber } from '../utils/format';
import {
  IRRITANT_LABELS,
  POLLEN_LABELS,
  POLLUTANT_LABELS,
  irritantLabel,
  pollenLabel,
  pollutantLabel,
} from '../utils/readingLabels';
import { colors } from '../theme/theme';
import { translate } from '../i18n';

const CURRENT_READING_SECTION_IDS = {
  pollen: 'today.pollen',
  airQuality: 'today.airQuality',
  moldAndUv: 'today.moldAndUv',
} as const;

export const NO_DATA_AVAILABLE_LABEL = 'No data available';

interface ReadingSectionRow {
  id: EnvironmentalVariableId;
  label: string;
  value: string;
  detail?: string;
}

interface CurrentReadingsSectionsProps {
  current: CurrentEnvironmentalReadings;
  capabilities: AppCapabilities;
  collapsedSections: Record<string, boolean>;
  onToggleSection: (sectionId: string) => void;
  onOpenVariable?: ((variableId: EnvironmentalVariableId) => void) | undefined;
  beforeAdvancedSections?: ReactNode;
}

function isFiniteReading(value: number | null | undefined): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function NoDataMessage() {
  return <Text style={styles.empty}>{translate('environment.sections.noData')}</Text>;
}

export function pollenReadingRows(
  current: CurrentEnvironmentalReadings,
  capabilities: AppCapabilities,
): ReadingSectionRow[] {
  return Object.entries(POLLEN_LABELS)
    .filter(
      ([key]) =>
        isEnvironmentalVariableAvailable(
          capabilities,
          pollenVariableId(key as keyof typeof current.pollen),
        ) && current.pollen[key as keyof typeof current.pollen] !== null,
    )
    .map(([key]) => ({
      id: pollenVariableId(key as keyof typeof current.pollen),
      label: pollenLabel(key as keyof typeof current.pollen),
      value: formatNumber(current.pollen[key as keyof typeof current.pollen], 'grains/m³'),
    }));
}

function pollutantReadingRows(
  current: CurrentEnvironmentalReadings,
  capabilities: AppCapabilities,
): ReadingSectionRow[] {
  return Object.entries(POLLUTANT_LABELS)
    .filter(
      ([key]) =>
        isEnvironmentalVariableAvailable(
          capabilities,
          pollutantVariableId(key as keyof typeof current.regulatedPollutants),
        ) && current.regulatedPollutants[key as keyof typeof current.regulatedPollutants] !== null,
    )
    .map(([key]) => {
      const detail =
        current.pollutantAqi[key as keyof typeof current.pollutantAqi] !== null
          ? `AQI ${formatNumber(current.pollutantAqi[key as keyof typeof current.pollutantAqi])}`
          : undefined;
      const row = {
        id: pollutantVariableId(key as keyof typeof current.regulatedPollutants),
        label: pollutantLabel(key as keyof typeof current.regulatedPollutants),
        value: formatNumber(
          current.regulatedPollutants[key as keyof typeof current.regulatedPollutants],
          'µg/m³',
        ),
      };

      return detail ? { ...row, detail } : row;
    });
}

function irritantReadingRows(
  current: CurrentEnvironmentalReadings,
  capabilities: AppCapabilities,
): ReadingSectionRow[] {
  return Object.entries(IRRITANT_LABELS)
    .filter(
      ([key]) =>
        isEnvironmentalVariableAvailable(
          capabilities,
          irritantVariableId(key as keyof typeof current.atmosphericIrritants),
        ) &&
        current.atmosphericIrritants[key as keyof typeof current.atmosphericIrritants] !== null,
    )
    .map(([key]) => ({
      id: irritantVariableId(key as keyof typeof current.atmosphericIrritants),
      label: irritantLabel(key as keyof typeof current.atmosphericIrritants),
      value: formatNumber(
        current.atmosphericIrritants[key as keyof typeof current.atmosphericIrritants],
        key === 'aerosolOpticalDepth' ? '' : 'µg/m³',
        key === 'aerosolOpticalDepth' ? 2 : 0,
      ),
    }));
}

function airQualityReadingRows(
  current: CurrentEnvironmentalReadings,
  capabilities: AppCapabilities,
): ReadingSectionRow[] {
  return [
    ...pollutantReadingRows(current, capabilities),
    ...irritantReadingRows(current, capabilities),
  ];
}

function moldAndSunRows(
  current: CurrentEnvironmentalReadings,
  capabilities: AppCapabilities,
): ReadingSectionRow[] {
  return [
    ...(isEnvironmentalVariableAvailable(capabilities, 'moldPotential') &&
    current.moldPotential.available &&
    isFiniteReading(current.moldPotential.score)
      ? [
          {
            id: 'moldPotential' as const,
            label: translate('environment.moldPotential'),
            value: formatMeasurement(current.moldPotential.score, '%'),
          },
        ]
      : []),
    ...(isEnvironmentalVariableAvailable(capabilities, 'uvIndex') &&
    isFiniteReading(current.uvIndex)
      ? [
          {
            id: 'uvIndex' as const,
            label: translate('environment.uvIndex'),
            value: formatNumber(current.uvIndex, '', 1),
          },
        ]
      : []),
  ];
}

export function CurrentReadingsSections({
  current,
  capabilities,
  collapsedSections,
  onToggleSection,
  onOpenVariable,
  beforeAdvancedSections,
}: CurrentReadingsSectionsProps) {
  const pollenRows = pollenReadingRows(current, capabilities);
  const airQualityRows = airQualityReadingRows(current, capabilities);
  const moldSunRows = moldAndSunRows(current, capabilities);

  return (
    <>
      <SectionCard
        title={translate('environment.sections.pollen')}
        collapsible
        collapsed={collapsedSections[CURRENT_READING_SECTION_IDS.pollen] === true}
        onToggle={() => onToggleSection(CURRENT_READING_SECTION_IDS.pollen)}
      >
        {pollenRows.length > 0 ? (
          pollenRows.map((row) => (
            <ReadingRow
              key={row.id}
              label={row.label}
              value={row.value}
              variableId={row.id}
              onPress={onOpenVariable}
            />
          ))
        ) : (
          <NoDataMessage />
        )}
      </SectionCard>

      <SectionCard
        title={translate('environment.sections.airQuality')}
        subtitle={current.aqiLabel}
        collapsible
        collapsed={collapsedSections[CURRENT_READING_SECTION_IDS.airQuality] === true}
        onToggle={() => onToggleSection(CURRENT_READING_SECTION_IDS.airQuality)}
      >
        {airQualityRows.length > 0 ? (
          airQualityRows.map((row) => (
            <ReadingRow
              key={row.id}
              label={row.label}
              value={row.value}
              detail={row.detail}
              variableId={row.id}
              onPress={onOpenVariable}
            />
          ))
        ) : (
          <NoDataMessage />
        )}
      </SectionCard>

      <SectionCard
        title={translate('environment.sections.moldAndUv')}
        collapsible
        collapsed={collapsedSections[CURRENT_READING_SECTION_IDS.moldAndUv] === true}
        onToggle={() => onToggleSection(CURRENT_READING_SECTION_IDS.moldAndUv)}
      >
        {moldSunRows.length > 0 ? (
          moldSunRows.map((row) => (
            <ReadingRow
              key={row.id}
              label={row.label}
              value={row.value}
              variableId={row.id}
              onPress={onOpenVariable}
            />
          ))
        ) : (
          <NoDataMessage />
        )}
      </SectionCard>

      {beforeAdvancedSections}
    </>
  );
}

const styles = StyleSheet.create({
  empty: {
    color: colors.muted,
    fontSize: 14,
    fontStyle: 'italic',
  },
});

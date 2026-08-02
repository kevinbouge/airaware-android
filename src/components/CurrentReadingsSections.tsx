import { ReadingRow } from './ReadingRow';
import { SectionCard } from './SectionCard';
import type { CurrentEnvironmentalReadings } from '../models/environment';
import { formatCategoryScore, formatNumber } from '../utils/format';
import { IRRITANT_LABELS, POLLEN_LABELS, POLLUTANT_LABELS } from '../utils/readingLabels';

const CURRENT_READING_SECTION_IDS = {
  pollen: 'today.pollen',
  regulatedPollution: 'today.regulatedPollution',
  atmosphericIrritants: 'today.atmosphericIrritants',
  other: 'today.other',
} as const;

interface CurrentReadingsSectionsProps {
  current: CurrentEnvironmentalReadings;
  collapsedSections: Record<string, boolean>;
  onToggleSection: (sectionId: string) => void;
}

export function CurrentReadingsSections({
  current,
  collapsedSections,
  onToggleSection,
}: CurrentReadingsSectionsProps) {
  return (
    <>
      <SectionCard
        title="Pollen"
        collapsible
        collapsed={collapsedSections[CURRENT_READING_SECTION_IDS.pollen] === true}
        onToggle={() => onToggleSection(CURRENT_READING_SECTION_IDS.pollen)}
      >
        {Object.entries(POLLEN_LABELS)
          .filter(([key]) => current.pollen[key as keyof typeof current.pollen] !== null)
          .map(([key, label]) => (
            <ReadingRow
              key={key}
              label={label}
              value={formatNumber(current.pollen[key as keyof typeof current.pollen], 'grains/m³')}
            />
          ))}
      </SectionCard>

      <SectionCard
        title="Regulated pollution"
        subtitle={current.aqiLabel}
        collapsible
        collapsed={collapsedSections[CURRENT_READING_SECTION_IDS.regulatedPollution] === true}
        onToggle={() => onToggleSection(CURRENT_READING_SECTION_IDS.regulatedPollution)}
      >
        {Object.entries(POLLUTANT_LABELS)
          .filter(
            ([key]) =>
              current.regulatedPollutants[key as keyof typeof current.regulatedPollutants] !== null,
          )
          .map(([key, label]) => (
            <ReadingRow
              key={key}
              label={label}
              value={formatNumber(
                current.regulatedPollutants[key as keyof typeof current.regulatedPollutants],
                'µg/m³',
              )}
              detail={
                current.pollutantAqi[key as keyof typeof current.pollutantAqi] !== null
                  ? `AQI ${formatNumber(current.pollutantAqi[key as keyof typeof current.pollutantAqi])}`
                  : undefined
              }
            />
          ))}
      </SectionCard>

      <SectionCard
        title="Atmospheric irritants"
        collapsible
        collapsed={collapsedSections[CURRENT_READING_SECTION_IDS.atmosphericIrritants] === true}
        onToggle={() => onToggleSection(CURRENT_READING_SECTION_IDS.atmosphericIrritants)}
      >
        {Object.entries(IRRITANT_LABELS)
          .filter(
            ([key]) =>
              current.atmosphericIrritants[key as keyof typeof current.atmosphericIrritants] !==
              null,
          )
          .map(([key, label]) => (
            <ReadingRow
              key={key}
              label={label}
              value={formatNumber(
                current.atmosphericIrritants[key as keyof typeof current.atmosphericIrritants],
                key === 'aerosolOpticalDepth' ? '' : 'µg/m³',
                key === 'aerosolOpticalDepth' ? 2 : 0,
              )}
            />
          ))}
      </SectionCard>

      <SectionCard
        title="Other"
        collapsible
        collapsed={collapsedSections[CURRENT_READING_SECTION_IDS.other] === true}
        onToggle={() => onToggleSection(CURRENT_READING_SECTION_IDS.other)}
      >
        <ReadingRow
          label="Mold potential"
          value={
            current.moldPotential.available
              ? formatCategoryScore(current.moldPotential.category, current.moldPotential.score)
              : 'Unavailable'
          }
        />
        <ReadingRow label="UV index" value={formatNumber(current.uvIndex, '', 1)} />
      </SectionCard>
    </>
  );
}

import { Text, StyleSheet } from 'react-native';
import { ReadingRow } from './ReadingRow';
import { SectionCard } from './SectionCard';
import { isFeatureAvailable } from '../capabilities/features';
import {
  irritantVariableId,
  isEnvironmentalVariableAvailable,
  pollenVariableId,
  pollutantVariableId,
} from '../capabilities/variables';
import type {
  CurrentEnvironmentalReadings,
  ExtendedAirQualityReadings,
  ExtendedWeatherReadings,
} from '../models/environment';
import type {
  AppCapabilities,
  EnvironmentalVariableId,
  ExtendedEnvironmentalVariableId,
} from '../capabilities/types';
import {
  formatDurationSeconds,
  formatMeasurement,
  formatNumber,
  formatVisibilityMeters,
} from '../utils/format';
import { IRRITANT_LABELS, POLLEN_LABELS, POLLUTANT_LABELS } from '../utils/readingLabels';
import { colors } from '../theme/theme';

const CURRENT_READING_SECTION_IDS = {
  pollen: 'today.pollen',
  regulatedPollution: 'today.regulatedPollution',
  atmosphericIrritants: 'today.atmosphericIrritants',
  moldAndSun: 'today.moldAndSun',
  atmosphericComposition: 'today.atmosphericComposition',
  pressureVisibility: 'today.pressureVisibility',
  cloudsMoisture: 'today.cloudsMoisture',
  solarConvection: 'today.solarConvection',
  wind: 'today.wind',
} as const;

export const NO_DATA_AVAILABLE_LABEL = 'No data available';

interface ExtendedReadingRow {
  id: EnvironmentalVariableId;
  label: string;
  value: string;
}

interface ProReadingSection {
  id: string;
  title: string;
  rows: ExtendedReadingRow[];
}

const EXTENDED_SECTION_DEFINITIONS = [
  {
    id: CURRENT_READING_SECTION_IDS.atmosphericComposition,
    title: 'Atmospheric composition',
  },
  {
    id: CURRENT_READING_SECTION_IDS.pressureVisibility,
    title: 'Pressure and visibility',
  },
  {
    id: CURRENT_READING_SECTION_IDS.cloudsMoisture,
    title: 'Clouds and moisture',
  },
  {
    id: CURRENT_READING_SECTION_IDS.solarConvection,
    title: 'Solar and convection',
  },
  {
    id: CURRENT_READING_SECTION_IDS.wind,
    title: 'Wind',
  },
] as const;

const EXTENDED_AIR_QUALITY_ROWS: {
  id: ExtendedEnvironmentalVariableId;
  key: keyof ExtendedAirQualityReadings;
  label: string;
  format: (value: number | null) => string;
}[] = [
  {
    id: 'carbonDioxide',
    key: 'carbonDioxide',
    label: 'CO₂',
    format: (value) => formatMeasurement(value, 'ppm'),
  },
  {
    id: 'ammonia',
    key: 'ammonia',
    label: 'NH₃',
    format: (value) => formatMeasurement(value, 'µg/m³'),
  },
  {
    id: 'methane',
    key: 'methane',
    label: 'CH₄',
    format: (value) => formatMeasurement(value, 'µg/m³'),
  },
  {
    id: 'nitrogenMonoxide',
    key: 'nitrogenMonoxide',
    label: 'NO',
    format: (value) => formatMeasurement(value, 'µg/m³'),
  },
  {
    id: 'formaldehyde',
    key: 'formaldehyde',
    label: 'Formaldehyde',
    format: (value) => formatMeasurement(value, 'µg/m³'),
  },
  {
    id: 'nonMethaneVolatileOrganicCompounds',
    key: 'nonMethaneVolatileOrganicCompounds',
    label: 'NMVOC',
    format: (value) => formatMeasurement(value, 'µg/m³'),
  },
];

const PRESSURE_VISIBILITY_ROWS: {
  id: ExtendedEnvironmentalVariableId;
  key: keyof ExtendedWeatherReadings;
  label: string;
  format: (value: number | null) => string;
}[] = [
  {
    id: 'pressureMsl',
    key: 'pressureMsl',
    label: 'Mean sea-level pressure',
    format: (value) => formatMeasurement(value, 'hPa'),
  },
  {
    id: 'surfacePressure',
    key: 'surfacePressure',
    label: 'Surface pressure',
    format: (value) => formatMeasurement(value, 'hPa'),
  },
  {
    id: 'extendedVisibility',
    key: 'visibility',
    label: 'Visibility',
    format: formatVisibilityMeters,
  },
];

const CLOUDS_MOISTURE_ROWS: {
  id: ExtendedEnvironmentalVariableId;
  key: keyof ExtendedWeatherReadings;
  label: string;
  format: (value: number | null) => string;
}[] = [
  {
    id: 'cloudCover',
    key: 'cloudCover',
    label: 'Cloud cover',
    format: (value) => formatMeasurement(value, '%'),
  },
  {
    id: 'cloudCoverLow',
    key: 'cloudCoverLow',
    label: 'Low cloud cover',
    format: (value) => formatMeasurement(value, '%'),
  },
  {
    id: 'cloudCoverMid',
    key: 'cloudCoverMid',
    label: 'Mid cloud cover',
    format: (value) => formatMeasurement(value, '%'),
  },
  {
    id: 'cloudCoverHigh',
    key: 'cloudCoverHigh',
    label: 'High cloud cover',
    format: (value) => formatMeasurement(value, '%'),
  },
  {
    id: 'extendedDewPoint',
    key: 'dewPoint',
    label: 'Dew point',
    format: (value) => formatMeasurement(value, '°C', 1),
  },
  {
    id: 'wetBulbTemperature',
    key: 'wetBulbTemperature',
    label: 'Wet-bulb temperature',
    format: (value) => formatMeasurement(value, '°C', 1),
  },
];

const SOLAR_CONVECTION_ROWS: {
  id: ExtendedEnvironmentalVariableId;
  key: keyof ExtendedWeatherReadings;
  label: string;
  format: (value: number | null) => string;
}[] = [
  {
    id: 'shortwaveRadiation',
    key: 'shortwaveRadiation',
    label: 'Solar radiation',
    format: (value) => formatMeasurement(value, 'W/m²'),
  },
  {
    id: 'directNormalIrradiance',
    key: 'directNormalIrradiance',
    label: 'Direct normal irradiance',
    format: (value) => formatMeasurement(value, 'W/m²'),
  },
  {
    id: 'diffuseRadiation',
    key: 'diffuseRadiation',
    label: 'Diffuse radiation',
    format: (value) => formatMeasurement(value, 'W/m²'),
  },
  {
    id: 'sunshineDuration',
    key: 'sunshineDuration',
    label: 'Sunshine duration',
    format: formatDurationSeconds,
  },
  {
    id: 'cape',
    key: 'cape',
    label: 'CAPE',
    format: (value) => formatMeasurement(value, 'J/kg'),
  },
];

const WIND_ROWS: {
  id: ExtendedEnvironmentalVariableId;
  key: keyof ExtendedWeatherReadings;
  label: string;
  format: (value: number | null) => string;
}[] = [
  {
    id: 'extendedWindGusts',
    key: 'windGusts',
    label: 'Wind gusts',
    format: (value) => formatMeasurement(value, 'km/h'),
  },
];

interface CurrentReadingsSectionsProps {
  current: CurrentEnvironmentalReadings;
  capabilities: AppCapabilities;
  collapsedSections: Record<string, boolean>;
  onToggleSection: (sectionId: string) => void;
}

function isFiniteReading(value: number | null | undefined): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function NoDataMessage() {
  return <Text style={styles.empty}>{NO_DATA_AVAILABLE_LABEL}</Text>;
}

export function extendedEnvironmentalReadingRows(
  current: CurrentEnvironmentalReadings,
  capabilities: AppCapabilities,
): ExtendedReadingRow[] {
  return proCurrentReadingSections(current, capabilities).flatMap((section) => section.rows);
}

export function pollenReadingRows(
  current: CurrentEnvironmentalReadings,
  capabilities: AppCapabilities,
): ExtendedReadingRow[] {
  return Object.entries(POLLEN_LABELS)
    .filter(
      ([key]) =>
        isEnvironmentalVariableAvailable(
          capabilities,
          pollenVariableId(key as keyof typeof current.pollen),
        ) && current.pollen[key as keyof typeof current.pollen] !== null,
    )
    .map(([key, label]) => ({
      id: pollenVariableId(key as keyof typeof current.pollen),
      label,
      value: formatNumber(current.pollen[key as keyof typeof current.pollen], 'grains/m³'),
    }));
}

function pollutantReadingRows(
  current: CurrentEnvironmentalReadings,
  capabilities: AppCapabilities,
): (ExtendedReadingRow & { detail?: string })[] {
  return Object.entries(POLLUTANT_LABELS)
    .filter(
      ([key]) =>
        isEnvironmentalVariableAvailable(
          capabilities,
          pollutantVariableId(key as keyof typeof current.regulatedPollutants),
        ) && current.regulatedPollutants[key as keyof typeof current.regulatedPollutants] !== null,
    )
    .map(([key, label]) => {
      const detail =
        current.pollutantAqi[key as keyof typeof current.pollutantAqi] !== null
          ? `AQI ${formatNumber(current.pollutantAqi[key as keyof typeof current.pollutantAqi])}`
          : undefined;
      const row = {
        id: pollutantVariableId(key as keyof typeof current.regulatedPollutants),
        label,
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
): ExtendedReadingRow[] {
  return Object.entries(IRRITANT_LABELS)
    .filter(
      ([key]) =>
        isEnvironmentalVariableAvailable(
          capabilities,
          irritantVariableId(key as keyof typeof current.atmosphericIrritants),
        ) &&
        current.atmosphericIrritants[key as keyof typeof current.atmosphericIrritants] !== null,
    )
    .map(([key, label]) => ({
      id: irritantVariableId(key as keyof typeof current.atmosphericIrritants),
      label,
      value: formatNumber(
        current.atmosphericIrritants[key as keyof typeof current.atmosphericIrritants],
        key === 'aerosolOpticalDepth' ? '' : 'µg/m³',
        key === 'aerosolOpticalDepth' ? 2 : 0,
      ),
    }));
}

function moldAndSunRows(
  current: CurrentEnvironmentalReadings,
  capabilities: AppCapabilities,
): ExtendedReadingRow[] {
  return [
    ...(isEnvironmentalVariableAvailable(capabilities, 'moldPotential') &&
    current.moldPotential.available &&
    isFiniteReading(current.moldPotential.score)
      ? [
          {
            id: 'moldPotential' as const,
            label: 'Mold potential',
            value: formatMeasurement(current.moldPotential.score, '%'),
          },
        ]
      : []),
    ...(isEnvironmentalVariableAvailable(capabilities, 'uvIndex') &&
    isFiniteReading(current.uvIndex)
      ? [
          {
            id: 'uvIndex' as const,
            label: 'UV index',
            value: formatNumber(current.uvIndex, '', 1),
          },
        ]
      : []),
  ];
}

function airQualityRows(
  current: CurrentEnvironmentalReadings,
  capabilities: AppCapabilities,
): ExtendedReadingRow[] {
  return EXTENDED_AIR_QUALITY_ROWS.flatMap((definition) => {
    const value = current.extended?.airQuality[definition.key];
    if (!isEnvironmentalVariableAvailable(capabilities, definition.id)) {
      return [];
    }
    if (!isFiniteReading(value)) {
      return [];
    }

    return [
      {
        id: definition.id,
        label: definition.label,
        value: definition.format(value),
      },
    ];
  });
}

function weatherRows(
  current: CurrentEnvironmentalReadings,
  capabilities: AppCapabilities,
  definitions: {
    id: ExtendedEnvironmentalVariableId;
    key: keyof ExtendedWeatherReadings;
    label: string;
    format: (value: number | null) => string;
  }[],
): ExtendedReadingRow[] {
  return definitions.flatMap((definition) => {
    const value = current.extended?.weather[definition.key];
    if (!isEnvironmentalVariableAvailable(capabilities, definition.id)) {
      return [];
    }
    if (!isFiniteReading(value)) {
      return [];
    }

    return [
      {
        id: definition.id,
        label: definition.label,
        value: definition.format(value),
      },
    ];
  });
}

export function proCurrentReadingSections(
  current: CurrentEnvironmentalReadings,
  capabilities: AppCapabilities,
): ProReadingSection[] {
  if (!isFeatureAvailable(capabilities, 'extended_environmental_data')) return [];

  const sections: ProReadingSection[] = [
    {
      ...EXTENDED_SECTION_DEFINITIONS[0],
      rows: airQualityRows(current, capabilities),
    },
    {
      ...EXTENDED_SECTION_DEFINITIONS[1],
      rows: weatherRows(current, capabilities, PRESSURE_VISIBILITY_ROWS),
    },
    {
      ...EXTENDED_SECTION_DEFINITIONS[2],
      rows: weatherRows(current, capabilities, CLOUDS_MOISTURE_ROWS),
    },
    {
      ...EXTENDED_SECTION_DEFINITIONS[3],
      rows: weatherRows(current, capabilities, SOLAR_CONVECTION_ROWS),
    },
    {
      ...EXTENDED_SECTION_DEFINITIONS[4],
      rows: weatherRows(current, capabilities, WIND_ROWS),
    },
  ];

  return sections;
}

export function CurrentReadingsSections({
  current,
  capabilities,
  collapsedSections,
  onToggleSection,
}: CurrentReadingsSectionsProps) {
  const moldSunRows = moldAndSunRows(current, capabilities);
  const proSections = proCurrentReadingSections(current, capabilities);
  const pollenRows = pollenReadingRows(current, capabilities);
  const pollutantRows = pollutantReadingRows(current, capabilities);
  const irritantRows = irritantReadingRows(current, capabilities);

  return (
    <>
      <SectionCard
        title="Pollen"
        collapsible
        collapsed={collapsedSections[CURRENT_READING_SECTION_IDS.pollen] === true}
        onToggle={() => onToggleSection(CURRENT_READING_SECTION_IDS.pollen)}
      >
        {pollenRows.length > 0 ? (
          pollenRows.map((row) => <ReadingRow key={row.id} label={row.label} value={row.value} />)
        ) : (
          <NoDataMessage />
        )}
      </SectionCard>

      <SectionCard
        title="Regulated pollution"
        subtitle={current.aqiLabel}
        collapsible
        collapsed={collapsedSections[CURRENT_READING_SECTION_IDS.regulatedPollution] === true}
        onToggle={() => onToggleSection(CURRENT_READING_SECTION_IDS.regulatedPollution)}
      >
        {pollutantRows.length > 0 ? (
          pollutantRows.map((row) => (
            <ReadingRow key={row.id} label={row.label} value={row.value} detail={row.detail} />
          ))
        ) : (
          <NoDataMessage />
        )}
      </SectionCard>

      <SectionCard
        title="Atmospheric irritants"
        collapsible
        collapsed={collapsedSections[CURRENT_READING_SECTION_IDS.atmosphericIrritants] === true}
        onToggle={() => onToggleSection(CURRENT_READING_SECTION_IDS.atmosphericIrritants)}
      >
        {irritantRows.length > 0 ? (
          irritantRows.map((row) => <ReadingRow key={row.id} label={row.label} value={row.value} />)
        ) : (
          <NoDataMessage />
        )}
      </SectionCard>

      <SectionCard
        title="Mold and sun"
        collapsible
        collapsed={collapsedSections[CURRENT_READING_SECTION_IDS.moldAndSun] === true}
        onToggle={() => onToggleSection(CURRENT_READING_SECTION_IDS.moldAndSun)}
      >
        {moldSunRows.length > 0 ? (
          moldSunRows.map((row) => <ReadingRow key={row.id} label={row.label} value={row.value} />)
        ) : (
          <NoDataMessage />
        )}
      </SectionCard>

      {proSections.map((section) => (
        <SectionCard
          key={section.id}
          title={section.title}
          collapsible
          collapsed={collapsedSections[section.id] === true}
          onToggle={() => onToggleSection(section.id)}
        >
          {section.rows.length > 0 ? (
            section.rows.map((row) => (
              <ReadingRow key={row.id} label={row.label} value={row.value} />
            ))
          ) : (
            <NoDataMessage />
          )}
        </SectionCard>
      ))}
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

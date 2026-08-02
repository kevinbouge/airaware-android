import { FREE_CAPABILITIES, PRO_LIFETIME_CAPABILITIES } from '../src/capabilities/config';
import { isEnvironmentalVariableAvailable } from '../src/capabilities/variables';
import {
  extendedEnvironmentalReadingRows,
  proCurrentReadingSections,
} from '../src/components/CurrentReadingsSections';
import { calculateMoldPotential } from '../src/core/moldPotential';
import type { CurrentEnvironmentalReadings } from '../src/models/environment';

function currentReading(
  overrides: Partial<CurrentEnvironmentalReadings> = {},
): CurrentEnvironmentalReadings {
  const weather = {
    temperature: 20,
    relativeHumidity: 70,
    dewPoint: 14,
    precipitation: 0,
    windSpeed: 5,
    windDirection: 180,
    windGusts: 28,
    visibility: 14000,
    leafWetnessProbability: 40,
  };

  return {
    timestamp: '2026-08-01T12:00',
    pollen: { alder: null, birch: null, grass: 20, mugwort: null, olive: null, ragweed: null },
    regulatedPollutants: {
      pm25: 8,
      pm10: 12,
      nitrogenDioxide: 10,
      ozone: 40,
      sulphurDioxide: 2,
    },
    pollutantAqi: { pm25: 18, pm10: 20, nitrogenDioxide: 10, ozone: 40, sulphurDioxide: 2 },
    aqiLabel: 'EU AQI',
    atmosphericIrritants: {
      carbonMonoxide: 300,
      aerosolOpticalDepth: 0.15,
      dust: 12,
      wildfirePm10: null,
    },
    weather,
    extended: {
      airQuality: {
        carbonDioxide: 418,
        ammonia: null,
        methane: 1900,
        nitrogenMonoxide: 3,
        formaldehyde: 0.7,
        nonMethaneVolatileOrganicCompounds: 14,
      },
      weather: {
        pressureMsl: 1018,
        surfacePressure: 985,
        visibility: 14000,
        cloudCover: 62,
        cloudCoverLow: null,
        cloudCoverMid: 25,
        cloudCoverHigh: 12,
        dewPoint: 14.2,
        wetBulbTemperature: 17.3,
        windGusts: 28,
        shortwaveRadiation: 520,
        directNormalIrradiance: 430,
        diffuseRadiation: 90,
        sunshineDuration: 3600,
        cape: 250,
      },
    },
    moldPotential: calculateMoldPotential(weather),
    uvIndex: 7,
    ...overrides,
  };
}

describe('extended environmental data display model', () => {
  it('hides extended measurements for Free capabilities', () => {
    expect(extendedEnvironmentalReadingRows(currentReading(), FREE_CAPABILITIES)).toEqual([]);
    expect(proCurrentReadingSections(currentReading(), FREE_CAPABILITIES)).toEqual([]);
  });

  it('groups available Pro measurements into meaningful sections', () => {
    const sections = proCurrentReadingSections(currentReading(), PRO_LIFETIME_CAPABILITIES);

    expect(sections.map((section) => section.title)).toEqual([
      'Atmospheric composition',
      'Pressure and visibility',
      'Clouds and moisture',
      'Solar and convection',
      'Wind',
    ]);
  });

  it('shows only available extended measurements for Pro capabilities', () => {
    const rows = extendedEnvironmentalReadingRows(currentReading(), PRO_LIFETIME_CAPABILITIES);
    const labels = rows.map((row) => row.label);

    expect(labels).toContain('CO₂');
    expect(labels).toContain('CH₄');
    expect(labels).toContain('NO');
    expect(labels).toContain('Formaldehyde');
    expect(labels).toContain('NMVOC');
    expect(labels).toContain('Mean sea-level pressure');
    expect(labels).toContain('Visibility');
    expect(labels).toContain('Solar radiation');
    expect(labels).not.toContain('NH₃');
    expect(labels).not.toContain('Low cloud cover');
  });

  it('hides unavailable Pro measurements when cached data has no extended values yet', () => {
    const reading = currentReading({
      extended: {
        airQuality: {
          carbonDioxide: null,
          ammonia: null,
          methane: null,
          nitrogenMonoxide: null,
          formaldehyde: null,
          nonMethaneVolatileOrganicCompounds: null,
        },
        weather: {
          pressureMsl: null,
          surfacePressure: null,
          visibility: null,
          cloudCover: null,
          cloudCoverLow: null,
          cloudCoverMid: null,
          cloudCoverHigh: null,
          dewPoint: null,
          wetBulbTemperature: null,
          windGusts: null,
          shortwaveRadiation: null,
          directNormalIrradiance: null,
          diffuseRadiation: null,
          sunshineDuration: null,
          cape: null,
        },
      },
      uvIndex: null,
    });
    const rows = extendedEnvironmentalReadingRows(reading, PRO_LIFETIME_CAPABILITIES);
    const sections = proCurrentReadingSections(reading, PRO_LIFETIME_CAPABILITIES);

    const labels = rows.map((row) => row.label);

    expect(sections).toHaveLength(5);
    expect(sections.every((section) => section.rows.length === 0)).toBe(true);
    expect(labels).not.toContain('CO₂');
    expect(labels).not.toContain('Mean sea-level pressure');
    expect(labels).not.toContain('UV index');
    expect(rows.some((row) => row.value === 'Not available')).toBe(false);
  });

  it('formats extended measurements with compact units', () => {
    const rows = extendedEnvironmentalReadingRows(currentReading(), PRO_LIFETIME_CAPABILITIES);

    expect(rows.find((row) => row.id === 'carbonDioxide')?.value).toBe('418 ppm');
    expect(rows.find((row) => row.id === 'nitrogenMonoxide')?.value).toBe('3 µg/m³');
    expect(rows.find((row) => row.id === 'formaldehyde')?.value).toBe('1 µg/m³');
    expect(rows.find((row) => row.id === 'nonMethaneVolatileOrganicCompounds')?.value).toBe(
      '14 µg/m³',
    );
    expect(rows.find((row) => row.id === 'pressureMsl')?.value).toMatch(/^1[,. ]?018 hPa$/);
    expect(rows.find((row) => row.id === 'extendedVisibility')?.value).toBe('14 km');
    expect(rows.find((row) => row.id === 'cloudCover')?.value).toBe('62%');
    expect(rows.find((row) => row.id === 'extendedDewPoint')?.value).toBe('14.2 °C');
    expect(rows.find((row) => row.id === 'shortwaveRadiation')?.value).toBe('520 W/m²');
    expect(rows.find((row) => row.id === 'sunshineDuration')?.value).toBe('1 h');
    expect(rows.find((row) => row.id === 'cape')?.value).toBe('250 J/kg');
  });

  it('keeps Mold and UV in the Free standard variable set', () => {
    expect(PRO_LIFETIME_CAPABILITIES.environmentalVariables.availableGroups).toEqual([
      'standard',
      'extended',
    ]);
    expect(FREE_CAPABILITIES.environmentalVariables.availableGroups).toEqual(['standard']);
    expect(isEnvironmentalVariableAvailable(FREE_CAPABILITIES, 'moldPotential')).toBe(true);
    expect(isEnvironmentalVariableAvailable(FREE_CAPABILITIES, 'uvIndex')).toBe(true);
  });
});

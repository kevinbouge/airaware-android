import { detectEnvironmentalEvents } from '../../src/core/environmentalEvents';
import { DEFAULT_PROFILE, DEFAULT_SETTINGS } from '../../src/models/profile';
import { GLOBAL_TEST_LOCATIONS } from './globalLocations';
import {
  environmentalCoverageResults,
  expectCoreEnvironmentalCoverage,
  expectNoInvalidNumbers,
} from './coverageAssertions';
import { environmentFixtureForLocation } from './coverageFixtures';

describe('global environmental coverage contracts', () => {
  it.each(GLOBAL_TEST_LOCATIONS)(
    '$id can assemble core environmental coverage without invalid numbers',
    (location) => {
      const environment = environmentFixtureForLocation(location);
      const results = environmentalCoverageResults({ location, environment });

      expect(environment.provider).toBe('open-meteo');
      expect(environment.coordinates).toEqual({
        latitude: location.latitude,
        longitude: location.longitude,
      });
      expectCoreEnvironmentalCoverage(environment);
      expectNoInvalidNumbers(environment);
      expect(results.filter((result) => result.expectation === 'required')).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ signal: 'temperature', status: 'available' }),
          expect.objectContaining({ signal: 'pm2_5', status: 'available' }),
          expect.objectContaining({ signal: 'pm10', status: 'available' }),
          expect.objectContaining({ signal: 'uv', status: 'available' }),
        ]),
      );
      expect(results).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            signal: 'thermal-stress',
            expectation: 'expected',
            status: 'available',
          }),
          expect.objectContaining({
            signal: 'utci',
            expectation: 'expected',
            status: 'no-data',
            calculationMethod: 'apparent-temperature',
          }),
          expect.objectContaining({
            signal: 'thermal-fallback',
            status: 'available',
            calculationMethod: 'apparent-temperature',
          }),
        ]),
      );
    },
  );

  it('reports UTCI separately when validated thermal inputs are available', () => {
    const location = GLOBAL_TEST_LOCATIONS.find((entry) => entry.id === 'paris');
    expect(location).toBeDefined();
    const environment = environmentFixtureForLocation(location!, { utciAvailable: true });

    expect(environmentalCoverageResults({ location: location!, environment })).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          signal: 'thermal-stress',
          status: 'available',
          calculationMethod: 'utci',
        }),
        expect.objectContaining({
          signal: 'utci',
          status: 'available',
          calculationMethod: 'utci',
        }),
        expect.objectContaining({
          signal: 'thermal-fallback',
          status: 'no-data',
          calculationMethod: 'utci',
        }),
      ]),
    );
  });

  it('keeps optional environmental gaps explicit instead of inventing zero values', () => {
    const location = GLOBAL_TEST_LOCATIONS.find((entry) => entry.id === 'nairobi');
    expect(location).toBeDefined();

      const environment = environmentFixtureForLocation(location!, { missingOptional: true });
      const missingThermal = {
        ...environment,
        current: {
          ...environment.current,
          extended: {
            ...environment.current.extended!,
            weather: {
              ...environment.current.extended!.weather,
              apparentTemperature: null,
            },
          },
        },
      };

    expect(missingThermal.current.pollen.grass).toBeNull();
    expect(missingThermal.current.atmosphericIrritants.dust).toBeNull();
    expect(missingThermal.current.atmosphericIrritants.wildfirePm10).toBeNull();
    expect(environmentalCoverageResults({ location: location!, environment: missingThermal })).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ signal: 'thermal-stress', status: 'no-data' }),
        expect.objectContaining({ signal: 'utci', status: 'no-data' }),
        expect.objectContaining({ signal: 'thermal-fallback', status: 'no-data' }),
        expect.objectContaining({ signal: 'measured-mold-spores', status: 'no-data' }),
        expect.objectContaining({ signal: 'pollen', status: 'no-data' }),
        expect.objectContaining({ signal: 'saharan-dust', status: 'no-data' }),
        expect.objectContaining({ signal: 'wildfire-attributed-pm10', status: 'no-data' }),
      ]),
    );
  });

  it('does not classify high generic PM as wildfire-related pollution without wildfire attribution', () => {
    const location = GLOBAL_TEST_LOCATIONS.find((entry) => entry.id === 'sydney');
    expect(location).toBeDefined();
    const environment = environmentFixtureForLocation(location!, { missingOptional: true });
    const polluted = {
      ...environment,
      current: {
        ...environment.current,
        regulatedPollutants: {
          ...environment.current.regulatedPollutants,
          pm25: 48,
          pm10: 96,
        },
        pollutantAqi: {
          ...environment.current.pollutantAqi,
          pm25: 140,
          pm10: 130,
        },
      },
      hourly: environment.hourly.map((hour, index) => ({
        ...hour,
        regulatedPollutants: { ...hour.regulatedPollutants, pm25: 50 + index, pm10: 100 + index },
        pollutantAqi: { ...hour.pollutantAqi, pm25: 145 + index, pm10: 140 + index },
        atmosphericIrritants: { ...hour.atmosphericIrritants, wildfirePm10: null },
      })),
    };

    const events = detectEnvironmentalEvents(polluted, {
      locationId: `coverage-${location!.id}`,
      profile: DEFAULT_PROFILE,
      settings: DEFAULT_SETTINGS,
    });

    expect(events.some((event) => event.type === 'wildfire-pollution')).toBe(false);
  });

  it('does not classify AOD alone as Saharan dust when the dust field is missing', () => {
    const location = GLOBAL_TEST_LOCATIONS.find((entry) => entry.id === 'cairo');
    expect(location).toBeDefined();
    const environment = environmentFixtureForLocation(location!, { missingOptional: true });
    const hazy = {
      ...environment,
      current: {
        ...environment.current,
        atmosphericIrritants: {
          ...environment.current.atmosphericIrritants,
          aerosolOpticalDepth: 0.8,
          dust: null,
        },
      },
      hourly: environment.hourly.map((hour) => ({
        ...hour,
        atmosphericIrritants: {
          ...hour.atmosphericIrritants,
          aerosolOpticalDepth: 0.8,
          dust: null,
        },
      })),
    };

    const events = detectEnvironmentalEvents(hazy, {
      locationId: `coverage-${location!.id}`,
      profile: DEFAULT_PROFILE,
      settings: DEFAULT_SETTINGS,
    });

    expect(events.some((event) => event.type === 'saharan-dust')).toBe(false);
  });
});

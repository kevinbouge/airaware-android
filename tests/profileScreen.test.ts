import { FREE_CAPABILITIES, PRO_LIFETIME_CAPABILITIES } from '../src/capabilities/config';
import { profileFactorSections } from '../src/core/profileSections';
import { DEFAULT_PROFILE } from '../src/models/profile';

describe('Profile screen factor sections', () => {
  it('defaults Pro profile factors off', () => {
    expect(DEFAULT_PROFILE.factors.mold).toBe(false);
    expect(DEFAULT_PROFILE.factors.uv_index).toBe(false);
  });

  it('shows profile factors in meaningful sections', () => {
    const sections = profileFactorSections(PRO_LIFETIME_CAPABILITIES);

    expect(sections.extendedAvailable).toBe(true);
    expect(sections.regulatedPollution).toEqual([
      ['pm25', 'PM2.5'],
      ['pm10', 'PM10'],
      ['nitrogen_dioxide', 'Nitrogen dioxide'],
      ['ozone', 'Ozone'],
      ['sulphur_dioxide', 'Sulphur dioxide'],
    ]);
    expect(sections.atmosphericIrritants).toEqual([
      ['carbon_monoxide', 'Carbon monoxide'],
      ['aerosol_optical_depth', 'Atmospheric haze'],
      ['dust', 'Atmospheric dust'],
      ['wildfire_pm10', 'Smoke-related particulate context'],
    ]);
    expect(sections.additionalSections.map((section) => section.title)).toEqual(['Mold and sun']);
    expect(sections.additionalSections[0]?.rows).toEqual([
      {
        id: 'mold',
        label: 'Mold potential',
        profileFactorId: 'mold',
      },
      {
        id: 'uv_index',
        label: 'UV index',
        profileFactorId: 'uv_index',
      },
    ]);
    expect(sections.additionalSections).toHaveLength(1);
  });

  it('shows Mold and UV profile factors for Free capabilities', () => {
    const sections = profileFactorSections(FREE_CAPABILITIES);

    expect(sections.extendedAvailable).toBe(false);
    expect(sections.additionalSections.map((section) => section.title)).toEqual(['Mold and sun']);
    expect(sections.additionalSections[0]?.rows.map((row) => row.profileFactorId)).toEqual([
      'mold',
      'uv_index',
    ]);
  });
});

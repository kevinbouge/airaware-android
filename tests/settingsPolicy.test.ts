import { DEFAULT_PROFILE, DEFAULT_SETTINGS } from '../src/models/profile';
import { settingsForProfileState } from '../src/state/settingsPolicy';

describe('settings policy', () => {
  it('forces personalized score settings back to environmental when the profile is disabled', () => {
    const settings = settingsForProfileState(
      {
        ...DEFAULT_SETTINGS,
        headlineScore: 'personalized',
        forecastScore: 'personalized',
        summaryScore: 'personalized',
      },
      { ...DEFAULT_PROFILE, enabled: false },
    );

    expect(settings.headlineScore).toBe('environmental');
    expect(settings.forecastScore).toBe('environmental');
    expect(settings.summaryScore).toBe('environmental');
  });

  it('preserves personalized score settings when the profile is enabled', () => {
    const original = {
      ...DEFAULT_SETTINGS,
      headlineScore: 'personalized' as const,
      forecastScore: 'personalized' as const,
      summaryScore: 'personalized' as const,
    };
    const settings = settingsForProfileState(original, { ...DEFAULT_PROFILE, enabled: true });

    expect(settings).toBe(original);
  });
});

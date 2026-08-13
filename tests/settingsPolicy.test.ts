import { DEFAULT_PROFILE, DEFAULT_SETTINGS } from '../src/models/profile';
import { settingsForProfileState } from '../src/state/settingsPolicy';

describe('settings policy', () => {
  it('forces personalized summary settings back to environmental when the profile is disabled', () => {
    const settings = settingsForProfileState(
      {
        ...DEFAULT_SETTINGS,
        summaryScore: 'personalized',
      },
      { ...DEFAULT_PROFILE, enabled: false },
    );

    expect(settings.summaryScore).toBe('environmental');
  });

  it('preserves personalized summary settings when the profile is enabled', () => {
    const original = {
      ...DEFAULT_SETTINGS,
      summaryScore: 'personalized' as const,
    };
    const settings = settingsForProfileState(original, { ...DEFAULT_PROFILE, enabled: true });

    expect(settings).toBe(original);
  });
});

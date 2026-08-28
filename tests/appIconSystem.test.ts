import fs from 'fs';
import {
  getActivityIconDefinition,
  getAppIconDefinition,
} from '../src/components/icons/appIconResolver';
import { APP_ICON_SIZES, APP_ICON_STROKE_WIDTH } from '../src/components/icons/appIconTypes';

describe('app icon system', () => {
  it('resolves Activity identities to canonical Lucide icons', () => {
    expect(getActivityIconDefinition('agriculture')).toMatchObject({ libraryName: 'Sprout' });
    expect(getActivityIconDefinition('drone_operations')).toMatchObject({ libraryName: 'Drone' });
    expect(getActivityIconDefinition('photography')).toMatchObject({ libraryName: 'Camera' });
    expect(getActivityIconDefinition('astronomy')).toMatchObject({ libraryName: 'Telescope' });
    expect(getActivityIconDefinition('outdoor_work')).toMatchObject({ libraryName: 'HardHat' });
  });

  it('resolves generic UI concepts to Lucide icons', () => {
    expect(getAppIconDefinition('settings')).toMatchObject({ libraryName: 'Settings' });
    expect(getAppIconDefinition('location')).toMatchObject({ libraryName: 'MapPin' });
    expect(getAppIconDefinition('current-location')).toMatchObject({
      libraryName: 'LocateFixed',
    });
    expect(getAppIconDefinition('notifications')).toMatchObject({ libraryName: 'Bell' });
    expect(getAppIconDefinition('share')).toMatchObject({ libraryName: 'Share2' });
    expect(getAppIconDefinition('refresh')).toMatchObject({ libraryName: 'RefreshCw' });
    expect(getAppIconDefinition('edit')).toMatchObject({ libraryName: 'Pencil' });
    expect(getAppIconDefinition('delete')).toMatchObject({ libraryName: 'Trash2' });
    expect(getAppIconDefinition('respiratory')).toMatchObject({ libraryName: 'HeartPulse' });
    expect(getAppIconDefinition('population-health')).toMatchObject({ libraryName: 'UsersRound' });
    expect(getAppIconDefinition('radiological')).toMatchObject({ libraryName: 'Radiation' });
    expect(getAppIconDefinition('trend-rising')).toMatchObject({ libraryName: 'TrendingUp' });
    expect(getAppIconDefinition('trend-falling')).toMatchObject({ libraryName: 'TrendingDown' });
    expect(getAppIconDefinition('trend-stable')).toMatchObject({
      libraryName: 'TrendingUpDown',
    });
  });

  it('keeps unknown generic icon names from crashing the app', () => {
    expect(getAppIconDefinition('not-a-real-icon')).toMatchObject({ libraryName: 'Info' });
  });

  it('centralizes Lucide sizing and stroke weight', () => {
    expect(APP_ICON_SIZES).toMatchObject({
      inline: 18,
      navigation: 20,
      tabBrand: 22,
      action: 20,
      activity: 24,
      card: 28,
      hero: 36,
    });
    expect(APP_ICON_STROKE_WIDTH).toBeCloseTo(2.1);
  });

  it('keeps the Today tab and Today header on the gas-mask brand icon', () => {
    const tabIcon = fs.readFileSync('src/components/icons/TabIcon.tsx', 'utf8');
    const today = fs.readFileSync('src/screens/TodayScreen.tsx', 'utf8');

    expect(tabIcon).toContain('GasMaskIcon');
    expect(tabIcon).toContain("name === 'today'");
    expect(today).toContain('GasMaskIcon');
    expect(today).toContain('<Text style={styles.brand}>AirAware</Text>');
  });
});

import { linking } from '../src/navigation/linking';
import fs from 'fs';

describe('navigation', () => {
  it('keeps only Today, Profile, and Settings as top-level tabs', () => {
    const screens = linking.config?.screens;
    const mainTabs = screens?.MainTabs;
    if (!screens || typeof mainTabs === 'string' || !mainTabs?.screens) {
      throw new Error('Navigation linking config is missing tab screens');
    }

    const routes = [
      'MainTabs',
      'EnvironmentalBurdenDetail',
      'PersonalizedRiskDetail',
      'DataDetail',
      'ActivityDetail',
    ];
    const tabScreens = mainTabs.screens;
    expect(Object.keys(screens)).toEqual(routes);
    expect(Object.keys(tabScreens)).toEqual(['Today', 'Profile', 'Settings']);
    expect(tabScreens.Today).toBe('today');
    expect(tabScreens.Profile).toBe('profile');
    expect(tabScreens.Settings).toBe('settings');
    expect(screens.DataDetail).toBe('data/:variableId');
    expect(screens.ActivityDetail).toBe('activities/:activityId');
  });

  it('keeps the variable detail route in a stack with gesture dismissal disabled', () => {
    const navigator = fs.readFileSync('src/navigation/AppNavigator.tsx', 'utf8');

    expect(navigator).toContain('createNativeStackNavigator');
    expect(navigator).toContain('name="MainTabs"');
    expect(navigator).toContain('name="EnvironmentalBurdenDetail"');
    expect(navigator).toContain('name="PersonalizedRiskDetail"');
    expect(navigator).toContain('name="DataDetail"');
    expect(navigator).toContain('name="ActivityDetail"');
    expect(navigator).toContain('gestureEnabled: false');
    expect(navigator).not.toContain('tabBarButton: () => null');
    expect(navigator).not.toContain("tabBarItemStyle: { display: 'none' }");
  });

  it('uses explicit detail-screen back navigation and defaults to 24h', () => {
    const screen = fs.readFileSync('src/screens/DataDetailScreen.tsx', 'utf8');

    expect(screen).toContain("useState<DataDetailRangeId>('24h')");
    expect(screen).toContain('title="Back"');
    expect(screen).toContain('navigation.goBack()');
    expect(screen).toContain('function DetailUnavailable');
  });

  it('keeps detail summary above an expanding vertical chart without legend labels', () => {
    const screen = fs.readFileSync('src/screens/DataDetailScreen.tsx', 'utf8');
    const chart = fs.readFileSync('src/components/VerticalTimelineChart.tsx', 'utf8');

    expect(screen.indexOf('styles.summary')).toBeLessThan(screen.indexOf('styles.chartArea'));
    expect(screen).not.toContain('<ScrollView style={styles.screen}');
    expect(chart).toContain('historyRow');
    expect(chart).toContain('forecastRow');
    expect(chart).not.toContain('>History<');
    expect(chart).not.toContain('>Forecast<');
  });

  it('clears the previous detail timeline before loading another request', () => {
    const screen = fs.readFileSync('src/screens/DataDetailScreen.tsx', 'utf8');

    expect(screen).toContain('setTimeline(null);\n      setLoading(true);');
  });

  it('routes Today summary cards into contextual detail screens', () => {
    const today = fs.readFileSync('src/screens/TodayScreen.tsx', 'utf8');

    expect(today).toContain("navigation.navigate('EnvironmentalBurdenDetail', undefined)");
    expect(today).toContain("navigation.navigate('PersonalizedRiskDetail', undefined)");
    expect(today).toContain("navigation.navigate('ActivityDetail', { activityId: activity.id })");
    expect(today).toContain('personalizedScore.available ?');
    expect(today).toContain('environmentalScore?.available ?');
    expect(today).toContain('capabilities.activities.available');
    expect(today).not.toContain('Best window: Unavailable');
  });

  it('keeps contextual detail unavailable states escapable with an explicit Back action', () => {
    const screens = [
      'src/screens/EnvironmentalBurdenDetailScreen.tsx',
      'src/screens/PersonalizedRiskDetailScreen.tsx',
      'src/screens/ActivityDetailScreen.tsx',
    ];

    for (const screenPath of screens) {
      const screen = fs.readFileSync(screenPath, 'utf8');
      expect(screen).toContain('DetailStateView');
      expect(screen).toContain('onBack={() => navigation.goBack()}');
    }
  });
});

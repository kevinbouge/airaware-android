import { linking } from '../src/navigation/linking';
import fs from 'fs';

describe('navigation', () => {
  it('includes the Data tab and deep link', () => {
    const screens = linking.config?.screens;
    const mainTabs = screens?.MainTabs;
    if (!screens || typeof mainTabs === 'string' || !mainTabs?.screens) {
      throw new Error('Navigation linking config is missing tab screens');
    }

    const routes = ['MainTabs', 'DataDetail'];
    const tabScreens = mainTabs.screens;
    expect(Object.keys(screens)).toEqual(routes);
    expect(tabScreens.Data).toBe('data');
    expect(screens.DataDetail).toBe('data/:variableId');
  });

  it('keeps the variable detail route in a stack with gesture dismissal disabled', () => {
    const navigator = fs.readFileSync('src/navigation/AppNavigator.tsx', 'utf8');

    expect(navigator).toContain('createNativeStackNavigator');
    expect(navigator).toContain('name="MainTabs"');
    expect(navigator).toContain('name="DataDetail"');
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
});

import fs from 'fs';

describe('Android widget config plugin', () => {
  it('registers native Android widget integration through the Expo config plugin', () => {
    const appConfig = fs.readFileSync('app.json', 'utf8');
    const plugin = fs.readFileSync('plugins/withAirAwareAndroidWidgets.js', 'utf8');

    expect(appConfig).toContain('./plugins/withAirAwareAndroidWidgets');
    expect(appConfig).toContain('"scheme": "airaware"');
    expect(appConfig).toContain('"package": "eu.euroempire.airaware"');
    expect(plugin).toContain('AirAwareCompactWidgetProvider');
    expect(plugin).toContain('AirAwareAdvancedWidgetProvider');
    expect(plugin).toContain('AirAwareWidgetModule');
    expect(plugin).toContain('android.appwidget.action.APPWIDGET_UPDATE');
  });
});

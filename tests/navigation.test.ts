import { linking } from '../src/navigation/linking';
import fs from 'fs';

describe('navigation', () => {
  it('keeps Today, Profile, Pro, and Settings as top-level tabs', () => {
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
      'ActivityDomainDetail',
      'ActivityDetail',
      'PublicHealthContext',
      'HealthSignalDetail',
    ];
    const tabScreens = mainTabs.screens;
    expect(Object.keys(screens)).toEqual(routes);
    expect(Object.keys(tabScreens)).toEqual(['Today', 'Profile', 'Pro', 'Settings']);
    expect(tabScreens.Today).toBe('today');
    expect(tabScreens.Profile).toBe('profile');
    expect(tabScreens.Pro).toBe('pro');
    expect(tabScreens.Settings).toBe('settings');
    expect(screens.DataDetail).toBe('data/:variableId');
    expect(screens.ActivityDomainDetail).toBe('activities/:domainId');
    expect(screens.ActivityDetail).toBe('activities/:domainId/:profileId');
    expect(screens.PublicHealthContext).toBe('health-context');
    expect(screens.HealthSignalDetail).toBe('health/:signalId');
  });

  it('keeps the variable detail route in a stack with gesture dismissal disabled', () => {
    const navigator = fs.readFileSync('src/navigation/AppNavigator.tsx', 'utf8');

    expect(navigator).toContain('createNativeStackNavigator');
    expect(navigator).toContain('name="MainTabs"');
    expect(navigator).toContain('name="EnvironmentalBurdenDetail"');
    expect(navigator).toContain('name="PersonalizedRiskDetail"');
    expect(navigator).toContain('name="DataDetail"');
    expect(navigator).toContain('name="ActivityDetail"');
    expect(navigator).toContain('name="PublicHealthContext"');
    expect(navigator).toContain('gestureEnabled: false');
    expect(navigator).not.toContain('tabBarButton: () => null');
    expect(navigator).not.toContain("tabBarItemStyle: { display: 'none' }");
  });

  it('uses explicit detail-screen back navigation and defaults to 24h', () => {
    const screen = fs.readFileSync('src/screens/DataDetailScreen.tsx', 'utf8');
    const header = fs.readFileSync('src/components/DetailHeader.tsx', 'utf8');

    expect(screen).toContain("useState<DataDetailRangeId>('24h')");
    expect(screen).toContain('<DetailHeader title={variable.label} onBack={handleBack} />');
    expect(screen).toContain('goBackOrToday(navigation)');
    expect(screen).toContain('function DetailUnavailable');
    expect(header).toContain("accessibilityLabel={t('common.back')}");
    expect(header).toContain("{t('common.back')}");
    expect(header).toContain('<AppIcon name="back" size="action" color={colors.primary} />');
    expect(header).not.toContain('backIcon');
    expect(header).not.toContain('<BackChevron />');
    expect(header).not.toContain('marginTop: -5');
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

  it('does not reload variable detail timelines from localized object identity changes', () => {
    const screen = fs.readFileSync('src/screens/DataDetailScreen.tsx', 'utf8');

    expect(screen).toContain('const variableId = params?.variableId ?? null');
    expect(screen).toContain('const variable = variableId ? dataDetailVariable(variableId) : null');
    expect(screen).toContain('hasVariable');
    expect(screen).toContain(
      '[coordinateLatitude, coordinateLongitude, hasVariable, now, rangeId, variableId]',
    );
    expect(screen).not.toContain('params?.variableId, rangeId, t, variable');
  });

  it('routes Today summary cards into contextual detail screens', () => {
    const today = fs.readFileSync('src/screens/TodayScreen.tsx', 'utf8');

    expect(today).toContain('TodayDecisionCard');
    expect(today).toContain('todayDecisionSummary({');
    expect(today).toContain("navigation.navigate('EnvironmentalBurdenDetail', undefined)");
    expect(today).toContain("navigation.navigate('PersonalizedRiskDetail', undefined)");
    expect(today).toContain("navigation.navigate('ActivityDomainDetail', { domainId: domain.id })");
    expect(today).toContain('personalizedScore.available ?');
    expect(today).toContain('environmentalScore?.available ?');
    expect(today).toContain('capabilities.activities.available');
    expect(today).not.toContain('Best window: Unavailable');
  });

  it('keeps contextual detail unavailable states escapable with an explicit Back action', () => {
    const screens = [
      'src/screens/EnvironmentalBurdenDetailScreen.tsx',
      'src/screens/PersonalizedRiskDetailScreen.tsx',
      'src/screens/ActivityDomainDetailScreen.tsx',
      'src/screens/ActivityDetailScreen.tsx',
    ];

    for (const screenPath of screens) {
      const screen = fs.readFileSync(screenPath, 'utf8');
      expect(screen).toContain('DetailStateView');
      expect(screen).toContain('goBackOrToday(navigation)');
    }
  });

  it('uses the shared merged summary layout on contextual detail pages', () => {
    const screens = [
      'src/screens/EnvironmentalBurdenDetailScreen.tsx',
      'src/screens/PersonalizedRiskDetailScreen.tsx',
      'src/screens/ActivityDetailScreen.tsx',
    ];

    for (const screenPath of screens) {
      const screen = fs.readFileSync(screenPath, 'utf8');
      expect(screen).toContain('SummaryMetricGrid');
    }

    expect(
      fs.readFileSync('src/screens/EnvironmentalBurdenDetailScreen.tsx', 'utf8'),
    ).not.toContain('<ScoreCard');
    expect(fs.readFileSync('src/screens/PersonalizedRiskDetailScreen.tsx', 'utf8')).not.toContain(
      '<ScoreCard',
    );
  });

  it('keeps activity detail forecast and measurement sections explicit when data is empty', () => {
    const screen = fs.readFileSync('src/screens/ActivityDetailScreen.tsx', 'utf8');

    expect(screen).toContain('ForecastBarSection');
    expect(screen).toContain('bestActivityForecastDates');
    expect(screen).toContain('bestDates.has(day.date)');
    expect(screen).toContain('conditionRows.length > 0');
    expect(screen).toContain("t('activities.forecastUnavailable')");
    expect(screen).toContain("t('activities.measurementsUnavailable')");
    expect(screen).toContain("t('activities.currentDataCoverage')");
    expect(screen).not.toContain("let dataCoverageLabel = 'Data coverage'");
  });

  it('allows multiple tied best days in contextual daily forecasts', () => {
    const contextForecast = fs.readFileSync('src/components/ContextForecast.tsx', 'utf8');
    const activityDetail = fs.readFileSync('src/screens/ActivityDetailScreen.tsx', 'utf8');

    expect(contextForecast).toContain('bestRiskForecastDates');
    expect(contextForecast).toContain('return new Set(');
    expect(contextForecast).toContain('displayScore(row.score.score)');
    expect(contextForecast).toContain('bestDates.has(day.date)');
    expect(activityDetail).toContain('bestActivityForecastDates');
    expect(activityDetail).toContain('return new Set(');
    expect(activityDetail).toContain('displayScore(item.window.averageScore)');
    expect(activityDetail).toContain('bestDates.has(day.date)');
  });

  it('centralizes disclaimer copy in Settings instead of feature screens', () => {
    const settings = fs.readFileSync('src/screens/SettingsScreen.tsx', 'utf8');
    const profile = fs.readFileSync('src/screens/ProfileScreen.tsx', 'utf8');
    const activityDetail = fs.readFileSync('src/screens/ActivityDetailScreen.tsx', 'utf8');
    const activityDefinitions = fs.readFileSync('src/core/activityDefinitions.ts', 'utf8');

    expect(settings).toContain("title={t('settings.disclaimers')}");
    expect(settings).toContain("t('settings.disclaimerText')");
    expect(profile).not.toContain('diagnosis or symptom prediction');
    expect(activityDetail).not.toContain('definition.disclaimer');
    expect(activityDefinitions).not.toContain('disclaimer:');
  });

  it('moves Pro controls out of Settings and into the Pro tab', () => {
    const navigator = fs.readFileSync('src/navigation/AppNavigator.tsx', 'utf8');
    const settings = fs.readFileSync('src/screens/SettingsScreen.tsx', 'utf8');
    const pro = fs.readFileSync('src/screens/ProScreen.tsx', 'utf8');

    expect(navigator).toContain('name="Pro"');
    expect(settings).not.toContain('title="AirAware Pro"');
    expect(settings).not.toContain('title="Activities"');
    expect(pro).toContain("title={t('pro.title')}");
    expect(pro).toContain("t('pro.headline')");
    expect(pro).toContain('PRO_OUTCOME_GROUPS');
    expect(pro).toContain("t('pro.unlockWithPrice', { price: billingState.offering.priceString })");
    expect(pro).toContain('purchaseProLifetime');
    expect(pro).toContain('restorePurchases');
    expect(pro).toContain("title={t('today.activities')}");
    expect(pro.indexOf("title={t('pro.title')}")).toBeLessThan(
      pro.indexOf("title={t('today.activities')}"),
    );
  });

  it('keeps Pro positioned around planning outcomes and lifetime purchase copy', () => {
    const locale = fs.readFileSync('src/i18n/locales/en.ts', 'utf8');

    expect(locale).toContain("headline: 'Plan ahead with AirAware Pro'");
    expect(locale).toContain('Know before conditions change');
    expect(locale).toContain('Find the best time');
    expect(locale).toContain('See further ahead');
    expect(locale).toContain('See conditions without opening AirAware');
    expect(locale).toContain('Lifetime purchase. No subscription. No AirAware account.');
  });

  it('makes Today activity cards visibly tappable', () => {
    const today = fs.readFileSync('src/screens/TodayScreen.tsx', 'utf8');

    expect(today).toContain('InsightCard');
    expect(today).toContain("translate('today.opensDetails'");
    expect(today).toContain('activitySection');
  });

  it('renders Today environmental events as static cards with score context for headline risk', () => {
    const today = fs.readFileSync('src/screens/TodayScreen.tsx', 'utf8');

    expect(today).toContain('function eventSeverityLabel(event: EnvironmentalEvent): string');
    expect(today).toContain('function eventDataValueLabel(event: EnvironmentalEvent): string');
    expect(today).toContain("event.type === 'headline-risk' || event.type === 'mold' ? '%' : ''");
    expect(today).toContain('return `${category} · ${value}`');
    expect(today).not.toContain('selectedEvent');
    expect(today).not.toContain('environmentalEventEvidenceLabel');
    expect(today).not.toContain('setSelectedEvent(event)');
  });

  it('keeps Today ordered around Now, Why, and When before contextual health information', () => {
    const today = fs.readFileSync('src/screens/TodayScreen.tsx', 'utf8');

    expect(today.indexOf('<TodayDecisionCard')).toBeLessThan(
      today.indexOf('<EnvironmentalEventsSection'),
    );
    expect(today.indexOf('<EnvironmentalEventsSection')).toBeLessThan(
      today.indexOf('<ThermalConditionsSection'),
    );
    expect(today.indexOf('<ThermalConditionsSection')).toBeLessThan(
      today.indexOf('<EnvironmentalDetailsSection'),
    );
    expect(today.indexOf('<EnvironmentalDetailsSection')).toBeLessThan(
      today.indexOf('<PublicHealthContextSection'),
    );
    expect(today.indexOf('<PublicHealthContextSection')).toBeLessThan(
      today.indexOf('<ActivitySummarySection'),
    );
    expect(today).toContain("title={translate('today.useCurrentLocation')}");
    expect(today).toContain("title={translate('today.chooseManualLocation')}");
    expect(today).toContain('LocationSelectorButton');
    expect(today).toContain('<LocationSelectorButton');
    expect(today).toContain('locationOnboardingComplete: true');
    expect(today.indexOf('<PersonalizePromptRow')).toBeGreaterThan(
      today.indexOf('<PublicHealthContextSection'),
    );
  });

  it('keeps Today health context concise and honest about stale or unavailable signals', () => {
    const today = fs.readFileSync('src/screens/TodayScreen.tsx', 'utf8');

    expect(today).toContain('PublicHealthContextSection');
    expect(today).toContain("title={translate('today.publicHealthContext')}");
    expect(today).toContain('currentPublicHealthContextRows(publicHealthSignals)');
    expect(today).toContain('coveragePublicHealthContextRows(publicHealthSignals)');
    expect(today).toContain('coverageSignalCount');
    expect(today).toContain("title={translate('today.publicHealthViewAll')}");
    expect(today).toContain("navigation.navigate('PublicHealthContext', undefined)");
    expect(today).not.toContain('function HealthSignalGroup');
    expect(today).toContain('name="apparent-temperature"');
    expect(today).toContain('size="event"');
    expect(today).toContain("translate('today.thermalMetric.utci')");
    expect(today).toContain("translate('today.thermalMetric.apparentTemperature')");
    expect(today).toContain('const healthSectionNotice =');
    expect(today).toContain('healthSectionNotice ? <Text style={styles.notice}>');
    expect(today).toContain('getHealthSignalIconName(signal)');
    expect(today).not.toContain('function healthSignalIcon');
    expect(today).toContain('function isDemotedHealthSignal(signal: HealthSignal): boolean');
    expect(today).toContain('isDemotedPublicHealthSignal(signal)');
    expect(today).toContain('sortedHealthSignals(');
    expect(today).toContain('healthSignalInlineDetailRows(signal)');
    expect(today).toContain('accessibilityState={hasInlineDetail ? { expanded } : undefined}');
    expect(today).toContain("name={hasTimelineDetail ? 'chevron-right' : 'info'}");
  });

  it('routes the compact Public Health Context preview to a full signal list', () => {
    const screen = fs.readFileSync('src/screens/PublicHealthContextScreen.tsx', 'utf8');

    expect(screen).toContain('currentPublicHealthContextRows(contextualSignals)');
    expect(screen).toContain('backgroundPublicHealthContextRows(contextualSignals)');
    expect(screen).toContain('coveragePublicHealthContextRows(contextualSignals)');
    expect(screen).toContain("signal.type !== 'thermal-stress'");
    expect(screen).toContain('currentRows.map((row)');
    expect(screen).toContain('backgroundRows.map((row)');
    expect(screen).toContain('coverageRows.map((row)');
    expect(screen).toContain("translate('health.temporal.coverage')");
    expect(screen).not.toContain('rows.slice(0, 4)');
    expect(screen).toContain("navigation.navigate('HealthSignalDetail', { signalId: signal.id })");
    expect(screen).toContain('row.scopeLabel');
    expect(screen).toContain('row.contextLabel');
    expect(screen).toContain('row.sourceLabel');
    expect(screen).toContain('row.secondaryLabel');
  });

  it('keeps health-signal detail pages aligned with the pollen timeline layout', () => {
    const screen = fs.readFileSync('src/screens/HealthSignalDetailScreen.tsx', 'utf8');

    expect(screen).toContain('healthSignalDetailRangeOptions(signal)');
    expect(screen).toContain('rangeOptions.length > 1');
    expect(screen).not.toContain('disabled={!healthSignalDetailRangeSupported(signal, item.id)}');
    expect(screen).toContain('healthSignalDetailPrimaryLabel(signal)');
    expect(screen).toContain('healthSignalDetailMetadataRows(signal)');
    expect(screen).toContain('chartSummaryRows.length > 0 ?');
    expect(screen).toContain('emptyMessage={emptyTimelineMessage}');
    expect(screen).toContain('timelineTitle');
    expect(screen).toContain('timelineSubtitle');
    expect(screen).toContain('styles.metadata');
    expect(screen).toContain('styles.summary');
    expect(screen).toContain('styles.chartArea');
    expect(screen.indexOf('styles.metadata')).toBeLessThan(screen.indexOf('styles.chartArea'));
    expect(screen).toContain('historyRow');
    expect(screen).toContain('forecastRow');
    expect(screen).toContain('nowSeparator');
    expect(screen).not.toContain('<SectionCard');
  });

  it('offers current and manual location paths from Today onboarding', () => {
    const today = fs.readFileSync('src/screens/TodayScreen.tsx', 'utf8');

    expect(today).toContain("title={translate('today.useCurrentLocation')}");
    expect(today).toContain("title={translate('today.chooseManualLocation')}");
    expect(today).toContain("navigation.navigate('MainTabs', { screen: 'Settings' })");
  });

  it('uses a timeline-style screen for biological, mortality, and radiation details', () => {
    const screen = fs.readFileSync('src/screens/HealthSignalDetailScreen.tsx', 'utf8');

    expect(screen).toContain('function HealthTimelineChart');
    expect(screen).toContain('timelinePoints(signal)');
    expect(screen).toContain('styles.chartArea');
    expect(screen).toContain('healthSignalValueLabel(signal)');
    expect(screen).not.toContain('SectionCard');
  });

  it('keeps domain detail profile cards un-nested', () => {
    const screen = fs.readFileSync('src/screens/ActivityDomainDetailScreen.tsx', 'utf8');

    expect(screen).toContain('styles.sectionTitle');
    expect(screen).toContain('<InsightCard');
    expect(screen).not.toContain('SectionCard');
    expect(screen).not.toContain('<SectionCard title="Professional profiles">');
  });
});

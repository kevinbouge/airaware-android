import fs from 'fs';
import {
  ENVIRONMENTAL_ICON_SIZES,
  type EnvironmentalIconSize,
} from '../src/components/icons/environmentalIconTypes';
import {
  getEventIconDefinition,
  getProfileFactorIconDefinition,
  getVegetationCategoryIconDefinition,
  getVegetationTaxonIconDefinition,
  getVariableIconDefinition,
  getWeatherIconDefinition,
} from '../src/components/icons/environmentalIconResolver';

describe('environmental icon system', () => {
  it('resolves core weather semantics to Meteocons assets', () => {
    expect(getWeatherIconDefinition('clear-day')).toMatchObject({
      name: 'weather-clear-day',
      assetSlug: 'monochrome/clear-day.svg',
      source: 'meteocons-monochrome',
    });
    expect(getWeatherIconDefinition('rain')).toMatchObject({
      name: 'weather-rain',
      assetSlug: 'monochrome/rain.svg',
    });
  });

  it('resolves environmental variables through semantic icon names', () => {
    expect(getVariableIconDefinition('uvIndex')).toMatchObject({
      name: 'uv',
      assetSlug: 'monochrome/uv-index.svg',
    });
    expect(getVariableIconDefinition('pollen_grass')).toMatchObject({
      name: 'grass-pollen',
      assetSlug: 'monochrome/pollen-grass.svg',
    });
    expect(getVariableIconDefinition('pm25')).toMatchObject({
      name: 'pm25',
      assetSlug: 'monochrome/smoke-particles.svg',
    });
    expect(getVariableIconDefinition('pm10')).toMatchObject({
      name: 'pm10',
      assetSlug: 'monochrome/smoke-particles.svg',
    });
    expect(getVariableIconDefinition('dust')).toMatchObject({
      name: 'saharan-dust',
      assetSlug: 'monochrome/wind-dust.svg',
    });
    expect(getVariableIconDefinition('wildfirePm10')).toMatchObject({
      name: 'wildfire-pollution',
      assetSlug: 'monochrome/smoke-particles.svg',
    });
    expect(getVariableIconDefinition('moldPotential')).toMatchObject({
      name: 'mold-potential',
      assetSlug: 'monochrome/soil-moisture.svg',
    });
  });

  it('resolves environmental event types without emoji or generic warning icons', () => {
    expect(getEventIconDefinition('saharan-dust')).toMatchObject({
      name: 'saharan-dust',
      assetSlug: 'monochrome/wind-dust.svg',
    });
    expect(getEventIconDefinition('wildfire-pollution')).toMatchObject({
      name: 'wildfire-pollution',
      assetSlug: 'monochrome/smoke-particles.svg',
    });
    expect(getEventIconDefinition('uv')).toMatchObject({
      name: 'uv',
      assetSlug: 'monochrome/uv-index.svg',
    });
  });

  it('resolves profile factors to the same semantic environmental icon family', () => {
    expect(getProfileFactorIconDefinition('pollen_grass')).toMatchObject({
      name: 'grass-pollen',
      assetSlug: 'monochrome/pollen-grass.svg',
    });
    expect(getProfileFactorIconDefinition('pm25')).toMatchObject({
      name: 'pm25',
      assetSlug: 'monochrome/smoke-particles.svg',
    });
    expect(getProfileFactorIconDefinition('nitrogen_dioxide')).toMatchObject({
      name: 'nitrogen-dioxide',
      assetSlug: 'monochrome/smoke.svg',
    });
    expect(getProfileFactorIconDefinition('dust')).toMatchObject({
      name: 'saharan-dust',
      assetSlug: 'monochrome/wind-dust.svg',
    });
    expect(getProfileFactorIconDefinition('wildfire_pm10')).toMatchObject({
      name: 'wildfire-pollution',
      assetSlug: 'monochrome/smoke-particles.svg',
    });
    expect(getProfileFactorIconDefinition('mold')).toMatchObject({
      name: 'mold-potential',
      assetSlug: 'monochrome/soil-moisture.svg',
    });
    expect(getProfileFactorIconDefinition('uv_index')).toMatchObject({
      name: 'uv',
      assetSlug: 'monochrome/uv-index.svg',
    });
  });

  it('resolves nearby vegetation categories and mapped taxa to semantic icons', () => {
    expect(getVegetationCategoryIconDefinition('woodland')).toMatchObject({
      name: 'vegetation-woodland',
      assetSlug: 'monochrome/pollen-tree.svg',
    });
    expect(getVegetationCategoryIconDefinition('grassland')).toMatchObject({
      name: 'vegetation-grassland',
      assetSlug: 'monochrome/pollen-grass.svg',
    });
    expect(getVegetationCategoryIconDefinition('meadow')).toMatchObject({
      name: 'vegetation-meadow',
      assetSlug: 'monochrome/pollen-flower.svg',
    });
    expect(getVegetationCategoryIconDefinition('scrub')).toMatchObject({
      name: 'vegetation-scrub',
      assetSlug: 'monochrome/pollen-weed.svg',
    });
    expect(getVegetationTaxonIconDefinition('birch')).toMatchObject({
      name: 'vegetation-tree-taxon',
      assetSlug: 'monochrome/pollen-tree.svg',
    });
  });

  it('falls back to a generic environmental icon for unknown variables', () => {
    expect(getVariableIconDefinition('unknownVariable' as never)).toMatchObject({
      name: 'generic-environment',
      assetSlug: 'monochrome/weather-alert.svg',
    });
  });

  it('keeps launcher, adaptive icon, notification icon, and splash references on gas-mask assets', () => {
    const appConfig = JSON.parse(fs.readFileSync('app.json', 'utf8')) as {
      expo: {
        icon: string;
        android: {
          adaptiveIcon: {
            foregroundImage: string;
            backgroundImage: string;
            monochromeImage: string;
          };
        };
        plugins: unknown[];
      };
    };

    expect(appConfig.expo.icon).toBe('./assets/icon.png');
    expect(appConfig.expo.android.adaptiveIcon.foregroundImage).toBe(
      './assets/android-icon-foreground.png',
    );
    expect(appConfig.expo.android.adaptiveIcon.backgroundImage).toBe(
      './assets/android-icon-background.png',
    );
    expect(appConfig.expo.android.adaptiveIcon.monochromeImage).toBe(
      './assets/android-icon-monochrome.png',
    );
    expect(JSON.stringify(appConfig.expo.plugins)).toContain(
      './assets/android-icon-monochrome.png',
    );
    expect(fs.existsSync('assets/airaware-gas-mask.svg')).toBe(true);
    expect(fs.existsSync('assets/icon.png')).toBe(true);
    expect(fs.existsSync('assets/splash-icon.png')).toBe(true);
  });

  it('uses local SVG bundling rather than network icon URLs', () => {
    const metroConfig = fs.readFileSync('metro.config.js', 'utf8');
    const iconMap = fs.readFileSync('src/components/icons/environmentalIconMap.ts', 'utf8');

    expect(metroConfig).toContain("require.resolve('react-native-svg-transformer/expo')");
    expect(iconMap).toContain('@meteocons/svg-static/monochrome/');
    expect(iconMap).not.toContain('http://');
    expect(iconMap).not.toContain('https://');
  });

  it('keeps environmental icon sizes large enough to remain visible on Android screens', () => {
    const today = fs.readFileSync('src/screens/TodayScreen.tsx', 'utf8');
    const expectedSizes: Record<EnvironmentalIconSize, number> = {
      inline: 18,
      measurement: 22,
      event: 36,
      card: 36,
      hero: 44,
    };

    expect(ENVIRONMENTAL_ICON_SIZES).toEqual(expectedSizes);
    expect(today).toContain('height: ENVIRONMENTAL_ICON_SIZES.event + spacing.md');
    expect(today).toContain('width: ENVIRONMENTAL_ICON_SIZES.event + spacing.md');
  });

  it('wires Today environmental events to semantic icons instead of emoji', () => {
    const today = fs.readFileSync('src/screens/TodayScreen.tsx', 'utf8');

    expect(today).toContain('getEventIconName(event.type)');
    expect(today).toContain('EnvironmentalIcon');
    expect(today).not.toContain('🌾');
    expect(today).not.toContain('🔥');
    expect(today).not.toContain('☀️');
    expect(today).not.toContain('🍄');
  });

  it('wires Profile factor toggles to semantic environmental icons', () => {
    const profile = fs.readFileSync('src/screens/ProfileScreen.tsx', 'utf8');

    expect(profile).toContain('getProfileFactorIconName(profileFactorId)');
    expect(profile).toContain('profileFactorId={factor}');
    expect(profile).toContain('size="measurement"');
  });
});

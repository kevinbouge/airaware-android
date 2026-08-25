import type { ComponentType } from 'react';
import type { SvgProps } from 'react-native-svg';
import GenericEnvironment from '@meteocons/svg-static/monochrome/weather-alert.svg';
import ClearDay from '@meteocons/svg-static/monochrome/clear-day.svg';
import ClearNight from '@meteocons/svg-static/monochrome/clear-night.svg';
import PartlyCloudyDay from '@meteocons/svg-static/monochrome/partly-cloudy-day.svg';
import PartlyCloudyNight from '@meteocons/svg-static/monochrome/partly-cloudy-night.svg';
import Cloudy from '@meteocons/svg-static/monochrome/cloudy.svg';
import Overcast from '@meteocons/svg-static/monochrome/overcast.svg';
import Fog from '@meteocons/svg-static/monochrome/fog.svg';
import Drizzle from '@meteocons/svg-static/monochrome/drizzle.svg';
import Rain from '@meteocons/svg-static/monochrome/rain.svg';
import HeavyRain from '@meteocons/svg-static/monochrome/extreme-rain.svg';
import Thunderstorm from '@meteocons/svg-static/monochrome/thunderstorms.svg';
import Snow from '@meteocons/svg-static/monochrome/snow.svg';
import Temperature from '@meteocons/svg-static/monochrome/thermometer.svg';
import ApparentTemperature from '@meteocons/svg-static/monochrome/thermometer-sun.svg';
import DewPoint from '@meteocons/svg-static/monochrome/thermometer-water.svg';
import Humidity from '@meteocons/svg-static/monochrome/humidity.svg';
import Precipitation from '@meteocons/svg-static/monochrome/raindrops.svg';
import Wind from '@meteocons/svg-static/monochrome/wind.svg';
import Pressure from '@meteocons/svg-static/monochrome/barometer.svg';
import Visibility from '@meteocons/svg-static/monochrome/haze.svg';
import SolarRadiation from '@meteocons/svg-static/monochrome/sun-hot.svg';
import SoilMoisture from '@meteocons/svg-static/monochrome/soil-moisture.svg';
import SoilTemperature from '@meteocons/svg-static/monochrome/soil-temperature.svg';
import Uv from '@meteocons/svg-static/monochrome/uv-index.svg';
import Pollen from '@meteocons/svg-static/monochrome/pollen.svg';
import PollenFlower from '@meteocons/svg-static/monochrome/pollen-flower.svg';
import TreePollen from '@meteocons/svg-static/monochrome/pollen-tree.svg';
import GrassPollen from '@meteocons/svg-static/monochrome/pollen-grass.svg';
import WeedPollen from '@meteocons/svg-static/monochrome/pollen-weed.svg';
import AirPollution from '@meteocons/svg-static/monochrome/smoke.svg';
import Particulate from '@meteocons/svg-static/monochrome/smoke-particles.svg';
import SaharanDust from '@meteocons/svg-static/monochrome/wind-dust.svg';
import type { EnvironmentalIconDefinition, EnvironmentalIconName } from './environmentalIconTypes';

type SvgIconComponent = ComponentType<SvgProps>;

interface EnvironmentalIconAsset extends EnvironmentalIconDefinition {
  Component: SvgIconComponent;
}

function meteocon(
  name: EnvironmentalIconName,
  assetSlug: string,
  Component: SvgIconComponent,
): EnvironmentalIconAsset {
  return {
    Component,
    assetSlug,
    name,
    source: 'meteocons-monochrome',
  };
}

const ENVIRONMENTAL_ICON_ASSETS: Record<EnvironmentalIconName, EnvironmentalIconAsset> = {
  'generic-environment': meteocon(
    'generic-environment',
    'monochrome/weather-alert.svg',
    GenericEnvironment,
  ),
  'weather-clear-day': meteocon('weather-clear-day', 'monochrome/clear-day.svg', ClearDay),
  'weather-clear-night': meteocon('weather-clear-night', 'monochrome/clear-night.svg', ClearNight),
  'weather-partly-cloudy-day': meteocon(
    'weather-partly-cloudy-day',
    'monochrome/partly-cloudy-day.svg',
    PartlyCloudyDay,
  ),
  'weather-partly-cloudy-night': meteocon(
    'weather-partly-cloudy-night',
    'monochrome/partly-cloudy-night.svg',
    PartlyCloudyNight,
  ),
  'weather-cloudy': meteocon('weather-cloudy', 'monochrome/cloudy.svg', Cloudy),
  'weather-overcast': meteocon('weather-overcast', 'monochrome/overcast.svg', Overcast),
  'weather-fog': meteocon('weather-fog', 'monochrome/fog.svg', Fog),
  'weather-drizzle': meteocon('weather-drizzle', 'monochrome/drizzle.svg', Drizzle),
  'weather-rain': meteocon('weather-rain', 'monochrome/rain.svg', Rain),
  'weather-heavy-rain': meteocon('weather-heavy-rain', 'monochrome/extreme-rain.svg', HeavyRain),
  'weather-thunderstorm': meteocon(
    'weather-thunderstorm',
    'monochrome/thunderstorms.svg',
    Thunderstorm,
  ),
  'weather-snow': meteocon('weather-snow', 'monochrome/snow.svg', Snow),
  temperature: meteocon('temperature', 'monochrome/thermometer.svg', Temperature),
  'apparent-temperature': meteocon(
    'apparent-temperature',
    'monochrome/thermometer-sun.svg',
    ApparentTemperature,
  ),
  humidity: meteocon('humidity', 'monochrome/humidity.svg', Humidity),
  'dew-point': meteocon('dew-point', 'monochrome/thermometer-water.svg', DewPoint),
  precipitation: meteocon('precipitation', 'monochrome/raindrops.svg', Precipitation),
  wind: meteocon('wind', 'monochrome/wind.svg', Wind),
  pressure: meteocon('pressure', 'monochrome/barometer.svg', Pressure),
  visibility: meteocon('visibility', 'monochrome/haze.svg', Visibility),
  'cloud-cover': meteocon('cloud-cover', 'monochrome/cloudy.svg', Cloudy),
  'solar-radiation': meteocon('solar-radiation', 'monochrome/sun-hot.svg', SolarRadiation),
  'soil-moisture': meteocon('soil-moisture', 'monochrome/soil-moisture.svg', SoilMoisture),
  'soil-temperature': meteocon(
    'soil-temperature',
    'monochrome/soil-temperature.svg',
    SoilTemperature,
  ),
  uv: meteocon('uv', 'monochrome/uv-index.svg', Uv),
  pollen: meteocon('pollen', 'monochrome/pollen.svg', Pollen),
  'tree-pollen': meteocon('tree-pollen', 'monochrome/pollen-tree.svg', TreePollen),
  'grass-pollen': meteocon('grass-pollen', 'monochrome/pollen-grass.svg', GrassPollen),
  'weed-pollen': meteocon('weed-pollen', 'monochrome/pollen-weed.svg', WeedPollen),
  'vegetation-woodland': meteocon('vegetation-woodland', 'monochrome/pollen-tree.svg', TreePollen),
  'vegetation-grassland': meteocon(
    'vegetation-grassland',
    'monochrome/pollen-grass.svg',
    GrassPollen,
  ),
  'vegetation-meadow': meteocon('vegetation-meadow', 'monochrome/pollen-flower.svg', PollenFlower),
  'vegetation-orchard': meteocon('vegetation-orchard', 'monochrome/pollen-tree.svg', TreePollen),
  'vegetation-scrub': meteocon('vegetation-scrub', 'monochrome/pollen-weed.svg', WeedPollen),
  'vegetation-parkland': meteocon('vegetation-parkland', 'monochrome/pollen-tree.svg', TreePollen),
  'vegetation-farmland': meteocon(
    'vegetation-farmland',
    'monochrome/pollen-grass.svg',
    GrassPollen,
  ),
  'vegetation-tree-taxon': meteocon(
    'vegetation-tree-taxon',
    'monochrome/pollen-tree.svg',
    TreePollen,
  ),
  'air-pollution': meteocon('air-pollution', 'monochrome/smoke.svg', AirPollution),
  particulate: meteocon('particulate', 'monochrome/smoke-particles.svg', Particulate),
  pm25: meteocon('pm25', 'monochrome/smoke-particles.svg', Particulate),
  pm10: meteocon('pm10', 'monochrome/smoke-particles.svg', Particulate),
  ozone: meteocon('ozone', 'monochrome/smoke.svg', AirPollution),
  'nitrogen-dioxide': meteocon('nitrogen-dioxide', 'monochrome/smoke.svg', AirPollution),
  'sulphur-dioxide': meteocon('sulphur-dioxide', 'monochrome/smoke.svg', AirPollution),
  'carbon-monoxide': meteocon('carbon-monoxide', 'monochrome/smoke.svg', AirPollution),
  'saharan-dust': meteocon('saharan-dust', 'monochrome/wind-dust.svg', SaharanDust),
  aerosol: meteocon('aerosol', 'monochrome/haze.svg', Visibility),
  'wildfire-pollution': meteocon(
    'wildfire-pollution',
    'monochrome/smoke-particles.svg',
    Particulate,
  ),
  'mold-potential': meteocon('mold-potential', 'monochrome/soil-moisture.svg', SoilMoisture),
  'environmental-event': meteocon(
    'environmental-event',
    'monochrome/weather-alert.svg',
    GenericEnvironment,
  ),
  'environmental-risk': meteocon(
    'environmental-risk',
    'monochrome/weather-alert.svg',
    GenericEnvironment,
  ),
};

export function environmentalIconAsset(name: EnvironmentalIconName): EnvironmentalIconAsset {
  return ENVIRONMENTAL_ICON_ASSETS[name] ?? ENVIRONMENTAL_ICON_ASSETS['generic-environment'];
}

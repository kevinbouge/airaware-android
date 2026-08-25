export type EnvironmentalIconSize = 'inline' | 'measurement' | 'event' | 'card' | 'hero';

type EnvironmentalIconStyle = 'meteocons-monochrome';

export type EnvironmentalIconName =
  | 'generic-environment'
  | 'weather-clear-day'
  | 'weather-clear-night'
  | 'weather-partly-cloudy-day'
  | 'weather-partly-cloudy-night'
  | 'weather-cloudy'
  | 'weather-overcast'
  | 'weather-fog'
  | 'weather-drizzle'
  | 'weather-rain'
  | 'weather-heavy-rain'
  | 'weather-thunderstorm'
  | 'weather-snow'
  | 'temperature'
  | 'apparent-temperature'
  | 'humidity'
  | 'dew-point'
  | 'precipitation'
  | 'wind'
  | 'pressure'
  | 'visibility'
  | 'cloud-cover'
  | 'solar-radiation'
  | 'soil-moisture'
  | 'soil-temperature'
  | 'uv'
  | 'pollen'
  | 'tree-pollen'
  | 'grass-pollen'
  | 'weed-pollen'
  | 'vegetation-woodland'
  | 'vegetation-grassland'
  | 'vegetation-meadow'
  | 'vegetation-orchard'
  | 'vegetation-scrub'
  | 'vegetation-parkland'
  | 'vegetation-farmland'
  | 'vegetation-tree-taxon'
  | 'air-pollution'
  | 'particulate'
  | 'pm25'
  | 'pm10'
  | 'ozone'
  | 'nitrogen-dioxide'
  | 'sulphur-dioxide'
  | 'carbon-monoxide'
  | 'saharan-dust'
  | 'aerosol'
  | 'wildfire-pollution'
  | 'mold-potential'
  | 'environmental-event'
  | 'environmental-risk';

export type WeatherIconCondition =
  | 'clear-day'
  | 'clear-night'
  | 'partly-cloudy-day'
  | 'partly-cloudy-night'
  | 'cloudy'
  | 'overcast'
  | 'fog'
  | 'drizzle'
  | 'rain'
  | 'heavy-rain'
  | 'thunderstorm'
  | 'snow'
  | 'wind';

export interface EnvironmentalIconDefinition {
  name: EnvironmentalIconName;
  assetSlug: string;
  source: EnvironmentalIconStyle;
}

# AirAware Android

AirAware is an Android application that reports environmental allergy burden from pollen, air
pollution, weather-based mold potential, and optional UV context.

AirAware reports environmental conditions only. It does not predict symptoms, diagnose allergies, or
provide medical advice.

## Technology

- Expo SDK 57 with React Native 0.86 and React 19
- TypeScript
- React Navigation bottom tabs
- Zustand for local app state
- AsyncStorage for settings and cache
- react-native-svg for the gas-mask identity and tab icons
- Expo Location for foreground approximate location
- Android share sheet for local text summaries
- Jest with `jest-expo` for deterministic tests

Expo SDK 57 requires Node 22.13.x or newer. This project was created and validated with:

```sh
nvm use 22.13.1
```

## Features

- Open-Meteo Air Quality and Weather Forecast data, no API key required
- Approximate foreground location with manual map fallback
- Location permission is requested only after the first-launch explanation is accepted
- Environmental burden score using pollen, regulated pollution, atmospheric irritants, and mold
  potential
- Optional Personal Allergy Profile with a separate personalized environmental risk score
- Six pollen types: alder, birch, grass, mugwort, olive, ragweed
- Pollutant-specific AQI where available, with raw readings kept for display
- Weather-based mold potential using humidity, precipitation, temperature, dew point, wind, and leaf
  wetness where available
- UV index as a current reading and optional personalized-score factor
- Best outdoor window based on the selected forecast score mode
- Local cache fallback for offline or failed refreshes, with air-quality and weather freshness tracked
  independently
- Local plain-text daily summary sharing
- Gas-mask app icon and risk-colored Today icon

## Screens

- **Today**: headline scores, location, update status, main factor, collapsible current-reading
  sections, refresh, and share summary
- **Forecast**: three-day score summary and 24-hour risk timeline. The forecast can use either the
  environmental burden score or the personalized risk score, and the highlighted range marks the
  best outdoor window
- **Profile**: local Personal Allergy Profile toggles
- **Settings**: location mode, manual map selection, refresh interval, outdoor-window duration,
  headline score, summary score, privacy and attribution notes

## Scoring

The environmental burden score is:

```text
50% pollen burden
25% regulated air pollution
10% atmospheric irritants
15% mold potential
```

Pollen uses the highest available pollen burden rather than averaging unrelated pollen types.
Regulated pollution uses the highest available supported pollutant-specific AQI burden. Atmospheric
irritants use carbon monoxide, aerosol optical depth, dust, and smoke-related PM10 where available.
Missing components are omitted and remaining weights are renormalized.

The Personal Allergy Profile is disabled by default. When enabled, it calculates a separate
personalized environmental risk score from selected local factors. Disabled factors are not treated as
environmentally absent, and missing selected readings are omitted rather than treated as zero. UV is
available as an opt-in sun-exposure factor and does not change the original environmental burden
score.

Mold potential is inferred from environmental weather conditions. It is not a measured mold-spore
concentration.

## Data Sources

- Open-Meteo Air Quality API
- Open-Meteo Weather Forecast API
- OpenStreetMap map tiles for manual location selection

Availability varies by variable, region, model domain, and season.

## Privacy

AirAware does not use analytics, advertising identifiers, accounts, telemetry, cloud sync, or remote
configuration.

Coordinates are sent to Open-Meteo to retrieve local environmental data only after the user accepts
the location explanation or selects a manual location. Manual map selections are saved locally and
refresh the environmental data for the selected coordinates. When the manual map picker is shown,
OpenStreetMap tile servers receive requests for the visible map area. Personal Allergy Profile
selections remain in local app storage and are not sent to providers. Shared summaries are generated
locally and passed to the Android share sheet; AirAware does not upload them.

Shared summaries never include coordinates, raw provider JSON, or profile factor lists.

## Development

Install dependencies:

```sh
nvm use 22.13.1
npm install
```

Start Expo:

```sh
npm start
```

Run on Android:

```sh
npm run android
```

Validate:

```sh
npm run typecheck
npm test -- --runInBand
npm run test:coverage
npm run check:unused
npm run lint
npm run format:check
```

The coverage report is written to `coverage/` and includes an `lcov` report for editor or CI
integrations.

## Architecture

```text
src/api/          Open-Meteo network providers and response normalization
src/core/         Pure scoring, mold, personalization, forecast, and summary logic
src/models/       Provider-independent TypeScript domain models
src/services/     Location and environment assembly
src/storage/      AsyncStorage-backed settings and cache
src/state/        Zustand app store and refresh orchestration
src/components/   Reusable UI primitives
src/screens/      Today, Forecast, Profile, and Settings screens
src/navigation/   React Navigation setup
src/theme/        Shared colors and spacing
src/utils/        Formatting and numeric helpers
tests/            Deterministic unit tests
```

Screens do not parse provider JSON and do not implement scoring formulas directly. Air-quality and
weather provider responses are validated independently, so a partial provider failure can reuse the
last valid cached data for the failed provider without discarding fresh data from the successful
provider.

## Limitations

- This MVP targets Android only.
- Forecasts are model estimates, not exact local sensor readings.
- Pollen data may be unavailable outside covered regions or seasons.
- Mold potential is not a measured mold-spore concentration.
- UV can be included in the personalized score, but the environmental burden score remains unchanged.
- The best outdoor window is based only on available selected environmental variables. It does not
  guarantee safe or symptom-free conditions.
- Manual map zoom uses on-screen controls in the current MVP; pinch-to-zoom is not implemented yet.
- Reverse geocoding is best-effort and may be unavailable.
- No background location, notifications, widgets, OpenStreetMap vegetation context, accounts,
  analytics, or long-term history are included in this first Android milestone.

## License

AirAware Android is released under the MIT License. See [LICENSE](./LICENSE).

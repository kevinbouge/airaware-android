# AirAware Android

AirAware is an Android application that reports environmental allergy burden from pollen, air
pollution, weather-based mold potential, and optional UV context.

AirAware reports environmental conditions only. It does not predict symptoms, diagnose allergies, or
provide medical advice.

## Technology

### Runtime and Platform

- Expo SDK 57
- React Native 0.86
- React 19
- TypeScript
- Android-first Expo development-build workflow
- Package name: `eu.euroempire.airaware`

### Application Architecture

- Functional React components
- React Navigation bottom tabs for Today, Data, Forecast, Profile, and Settings
- Zustand for local app state and refresh orchestration
- Capability-driven feature configuration for Free/Pro behavior
- Pure TypeScript modules for environmental scoring, personalization, mold potential, forecast logic,
  outdoor-window selection, notifications, widget snapshots, and daily summaries

### Data, Storage, and Device APIs

- Open-Meteo Air Quality API and Weather Forecast API through isolated provider modules
- OpenStreetMap Overpass API through an isolated nearby-vegetation provider
- Expo Location for foreground approximate location
- AsyncStorage for local settings, profile selections, a small entitlement presentation cache,
  development capability preview override, provider cache, notification transition state, and widget
  snapshots
- Android native share sheet for local plain-text daily summaries
- Expo Notifications for local risk transition notifications
- OpenStreetMap map tiles for manual coordinate selection
- RevenueCat React Native SDK for AirAware Pro entitlement management through Google Play

### Native Android Integration

- Local Expo config plugin: `plugins/withAirAwareAndroidWidgets.js`
- Generated Android `AppWidgetProvider` classes and RemoteViews layouts for the compact and advanced
  home-screen widgets
- Small native bridge for writing widget snapshots into Android shared preferences
- `react-native-svg` for the gas-mask identity and tab icons
- `react-native-purchases` for RevenueCat purchase and entitlement integration
- `react-native-purchases-ui` is installed for future RevenueCat-hosted paywall support, but the
  current app uses AirAware's own Settings purchase UI

### Quality Tooling

- Jest with `jest-expo` for deterministic unit tests
- TypeScript compiler via `tsc --noEmit`
- ESLint with Expo configuration
- Prettier formatting checks
- Knip unused-code checks
- Coverage reporting through Jest/LCOV

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
- Mold potential visibility and optional personalized-score factor, using humidity,
  precipitation, temperature, dew point, wind, and leaf wetness where available
- UV index visibility and optional personalized-score factor
- Best outdoor window based on the selected forecast score mode
- Local cache fallback for offline or failed refreshes, with air-quality, weather, and vegetation
  freshness tracked independently
- Dedicated Data tab for raw environmental measurements
- Nearby vegetation and land-use context from OpenStreetMap, available to Free and Pro users
- Local plain-text daily summary sharing
- Android home-screen widgets:
  - Free compact widget with current score and main factor
  - Advanced home-screen widget with current score, best outdoor window, and compact forecast
    summaries
- Optional Free risk transition notifications for the active headline score
- Advanced Environmental Data capability for additional informational measurements where
  Open-Meteo supports them
- Gas-mask app icon and risk-colored Today icon
- Capability-based Free/Pro forecast horizon and advanced data/widget access
- AirAware Pro lifetime purchase entitlement managed through RevenueCat and Google Play when a
  public RevenueCat SDK key is configured

## Screens

- **Today**: headline scores, location, update status, main factor, best outdoor window, refresh,
  and share summary
- **Data**: raw environmental measurements in collapsible sections for Pollen, Air quality, Mold
  and UV, Nearby vegetation, and Advanced Environmental Data when available
- **Forecast**: daily score summary and 24-hour risk timeline. The forecast can use either the
  environmental burden score or the personalized risk score, and the highlighted range marks the
  best outdoor window
- **Profile**: local Personal Allergy Profile toggles, including Mold potential and UV index.
  Informational advanced measurements remain display-only on Data
- **Settings**: location mode, manual map selection, refresh interval, outdoor-window duration,
  headline score, forecast score, notification preferences, daily-summary score, AirAware Pro
  purchase/restore status, privacy and attribution notes, and a development-only capability preview
  switch

## Android Home-Screen Widgets

AirAware provides two Android home-screen widgets installed with the app:

- **AirAware compact widget**: available to Free and Pro users. It shows the active headline score,
  category, main factor, optional UV category when available, and cached-data state.
- **Advanced home-screen widget**: requires the advanced widget capability. It shows the active
  headline score, main factor, best outdoor window when available, and daily forecast summaries up
  to the active forecast horizon. The snapshot can hold the full active forecast horizon; the widget
  renders a compact subset that fits legibly.

Widgets use the latest locally cached widget snapshot prepared by the app after refreshes and
relevant settings/profile changes. Widgets do not fetch Open-Meteo directly, do not request
location, and do not recalculate scores. If Pro is unavailable, the advanced widget shows a compact
locked informational state and opens AirAware Settings.

Because Android home-screen widgets require native `AppWidgetProvider` code, this project uses a
local Expo config plugin: `plugins/withAirAwareAndroidWidgets.js`. The plugin generates the native
Android widget receivers, RemoteViews layouts, metadata XML, and the small native bridge used to
write the widget snapshot into Android shared preferences during `expo prebuild` or development
build generation. Expo SDK 57's `expo-widgets` package is iOS-only, so it is not used for these
Android widgets.

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

Advanced Environmental Data is displayed separately from scored environmental variables. Additional
atmospheric and weather measurements are informational only and do not influence environmental
burden, personalized risk, notifications, best outdoor window calculations, or daily summaries. Mold
potential and UV index are standard AirAware readings available to Free and Pro users. Mold remains
part of the base environmental burden formula so the environmental burden score keeps a consistent
meaning.

The Personal Allergy Profile is disabled by default. When enabled, it calculates a separate
personalized environmental risk score from selected local factors available to the active capability
profile. Profile switches control only personalized-score inputs; they do not hide or show readings
on Today. If personalization is disabled, headline, forecast, and daily-summary score settings fall
back to Environmental burden. Disabled factors are not treated as environmentally absent, and missing
selected readings are omitted rather than treated as zero. Mold potential and UV index are available
to Free and Pro users as opt-in personalized-score factors and are disabled by default. UV does not
change the original environmental burden score.

Mold potential is inferred from environmental weather conditions. It is not a measured mold-spore
concentration.

## Data Sources

- Open-Meteo Air Quality API
- Open-Meteo Weather Forecast API
- OpenStreetMap Overpass API for nearby vegetation and land-use context
- OpenStreetMap map tiles for manual location selection

Availability varies by variable, region, model domain, and season.

Advanced Environmental Data uses supported Open-Meteo variables such as CO₂, ammonia, methane,
nitrogen monoxide, formaldehyde, NMVOC, pressure, visibility, cloud cover, dew point, wet-bulb
temperature, wind gusts, radiation, sunshine duration, and CAPE where available.

These extended variables are requested as part of the existing Open-Meteo provider calls and are
hidden automatically when the upstream response does not provide a valid numeric value.

## Nearby Vegetation

AirAware can show broad nearby vegetation and land-use context from OpenStreetMap, including
woodland, grassland, meadow, orchard, scrub, parkland, farmland, and explicitly mapped birch, alder,
or olive taxonomy where available.

Nearby vegetation is contextual only. It does not change AirAware scores, personalized risk,
notifications, widgets, daily summaries, or outdoor-window calculations. It does not indicate current
flowering or pollen production.

OpenStreetMap coverage varies by region. Missing mapped features do not mean the vegetation is
absent. Results are cached locally for slow-changing context and refreshed when the cache expires,
the selected location changes, or the nearby-vegetation radius changes.

## Privacy

AirAware does not use analytics, advertising identifiers, accounts, telemetry, cloud sync, or remote
configuration.

Coordinates are sent to Open-Meteo to retrieve local environmental data, including optional advanced
measurements when available, only after the user accepts the location explanation or selects a manual
location. Manual map selections are saved locally and refresh the environmental data for the selected
coordinates. When the manual map picker is shown, OpenStreetMap tile servers receive requests for
the visible map area. When Nearby vegetation is used, the active latitude and longitude are sent to
the configured OpenStreetMap Overpass API to request mapped vegetation and land-use features near
the selected coordinates. Personal Allergy Profile selections remain in local app storage and are not
sent to Open-Meteo, OpenStreetMap, RevenueCat, or any other environmental provider. Shared summaries
are generated locally and passed to the Android share sheet; AirAware does not upload them.

AirAware uses RevenueCat to manage AirAware Pro purchase entitlement. Google Play processes
payments; AirAware does not directly handle card or payment information. RevenueCat may process
anonymous app identifiers, purchase records, product identifiers, entitlement state, and device/app
metadata needed for billing. AirAware does not send RevenueCat coordinates, environmental readings,
Personal Allergy Profile selections, nearby vegetation data, shared summaries, or notification
settings.

Shared summaries never include coordinates, raw provider JSON, or profile factor lists.

Android widgets display locally cached AirAware snapshot data. They do not independently contact
Open-Meteo, do not include coordinates, and do not display Personal Allergy Profile selections.
Widget data is not uploaded by AirAware. Android launchers may capture or display widget content as
part of normal system behavior. Locked advanced widgets do not expose environmental data when Pro is
unavailable.

AirAware requests only approximate foreground location. It does not request background location,
precise location, contacts, camera, microphone, SMS, call logs, health permissions, installed-app
inventory, or advertising ID in this MVP.

Notification permission is requested only if the user enables risk transition notifications in
Settings. AirAware does not request notification permission on first launch.

Because AirAware has no account system and no server-side user profile, clearing app storage or
uninstalling the app removes locally stored settings, cached provider responses, selected
coordinates, and Personal Allergy Profile selections. RevenueCat uses anonymous app user IDs; restore
purchases remains available to recover eligible Google Play purchases.

## Google Play Policy Readiness

This repository includes engineering guardrails for Google Play Developer Program policy readiness.
They do not replace the publisher's Play Console declarations or legal/privacy review.

Before submitting to Google Play:

- Publish a publicly accessible, non-PDF privacy policy URL and add the same URL in Play Console.
- Keep the in-app Privacy section and the public privacy policy consistent with the Play Console
  Data safety section.
- In Data safety, disclose that approximate location is collected and transmitted to Open-Meteo for
  app functionality. If the manual map picker is used, disclose that OpenStreetMap tile servers
  receive map tile requests for the visible map area.
- State that Personal Allergy Profile selections, settings, cached data, and shared summaries remain
  local to the device unless the user chooses to share text through Android's share sheet.
- If Nearby vegetation is enabled, disclose that coordinates are sent to the configured
  OpenStreetMap Overpass API for vegetation and land-use context and cached locally.
- Complete the Health apps declaration if Play Console classifies AirAware as health-related.
  AirAware must be described as environmental information only: it does not predict symptoms,
  diagnose allergies, provide medical advice, or guarantee safe conditions.
- Declare that the app has no ads, analytics, accounts, subscriptions, user-generated content, or
  background location in the current build.
- Disclose that Google Play Billing is used indirectly through RevenueCat for a one-time
  non-consumable AirAware Pro purchase. Google Play processes payments and RevenueCat manages
  entitlement validation.
- If risk transition notifications are enabled, disclose that notification permission is optional
  and used only for local AirAware risk-category transition notifications.
- Re-run `npm run validate`, `npx expo-doctor`, and the Google Play policy guardrail tests before
  release.

The guardrail tests fail if the project adds obvious policy-sensitive dependencies such as ads,
analytics, tracking, unapproved billing, unrelated in-app purchase/payment, or account SDKs, or if
Android location permissions expand beyond approximate foreground location. The approved billing
dependencies are `react-native-purchases` and `react-native-purchases-ui`; RevenueCat imports must
stay isolated in the billing gateway.

## Free and Pro

AirAware's currently implemented core features remain free.

Free includes Standard Environmental Data, which covers the core pollen, regulated-pollution,
atmospheric-irritant, Mold potential, and UV readings.

AirAware Pro currently adds three modeled capabilities:

### Standard Forecast

Standard Forecast is available to Free and Pro users:

- Today plus 2 additional days
- 3 total forecast days

### Extended Forecast

Extended Forecast is available with AirAware Pro:

- Today plus 6 additional days
- Up to 7 total forecast days

Forecast availability depends on upstream model coverage. Some measurements may be unavailable for
later days, and missing values are omitted rather than treated as zero. The 24-hour risk timeline
and Best outdoor window remain short-term features.

Advanced Environmental Data:

- Free: Standard Environmental Data
- Pro lifetime: additional informational atmospheric and weather measurements where available

Android home-screen widgets:

- Free and Pro: compact current-condition widget
- Pro lifetime: advanced widget with best outdoor window and forecast summaries

AirAware Pro is a one-time lifetime unlock with no subscription and no AirAware account
requirement. Google Play processes payments and RevenueCat validates purchase entitlement. The Pro
price is loaded from Google Play through RevenueCat and is not hard-coded in the app.

The RevenueCat entitlement identifier is `pro`. The RevenueCat package identifier used for the
lifetime purchase is `lifetime`. Production Pro access is granted only when RevenueCat customer
information reports the `pro` entitlement as active.

If `EXPO_PUBLIC_REVENUECAT_API_KEY` is missing, billing is marked unconfigured and the app remains
Free. Development builds include a capability preview control in Settings under **AirAware Pro** so
Free and Pro surfaces can be smoke-tested. The preview is ignored in production, does not modify
RevenueCat customer information, does not simulate a purchase, and does not store purchase tokens.
Personal Allergy Profile data remains local and is not sent to RevenueCat, Open-Meteo, or any other
provider.

Notification capabilities are modeled separately:

- Free and Pro: basic transition notifications for the active headline score
- Pro lifetime: advanced environmental notification capability reserved for future alert types

Only basic transition notifications are implemented today. Advanced environmental notification
types are not implemented and no Pro-only notification settings are shown.

Real purchase testing requires an Android development or release build. Expo Go cannot perform native
RevenueCat purchases. RevenueCat Test Store can be used for development testing when configured, but
real Google Play purchase validation still requires the proper Play Console product, tester, and
build distribution setup.

## AirAware Pro Purchases

AirAware Pro purchases are managed through RevenueCat and Google Play.

Install the RevenueCat SDK packages with Expo-compatible dependency resolution:

```sh
npx expo install react-native-purchases react-native-purchases-ui
```

Configure the public RevenueCat SDK key in local environment configuration:

```sh
EXPO_PUBLIC_REVENUECAT_API_KEY=<public RevenueCat Android or test SDK key>
```

`.env.example` contains a placeholder. Do not commit local `.env` files, RevenueCat secret API keys,
Google Play service-account JSON, private keys, webhook secrets, purchase tokens, or receipts. Public
RevenueCat SDK keys are not server secrets, but centralizing them makes test and production key
changes safe.

## Notifications

AirAware can optionally send local transition notifications when a refreshed active headline score
enters a configured high category from a different previous category.

The active headline score is the same score selected in Settings:

- Environmental burden
- Personalized risk, when enabled and available

If personalized risk is selected but unavailable, AirAware uses the same environmental-burden
fallback as the headline display. Missing scores are not treated as zero, and the first valid score
only establishes a baseline.

Notification thresholds:

- High and Very High
- Very High only

AirAware does not send recovery notifications and does not repeat notifications while the category is
unchanged. Transition state is local and is reset when the score mode, effective location, or
personalized profile context changes.

In this MVP, notifications are evaluated during app refreshes. AirAware does not add background
fetch, background location, alarm scheduling, headless tasks, or foreground services.

The Settings screen also includes a local test-notification action. It verifies Android notification
delivery without creating a fake risk transition or changing transition state.

## Share Daily Summary

AirAware can generate a compact plain-text daily summary and send it through the Android share
sheet. The summary is generated locally from the already calculated models; it does not trigger a
provider refresh or recalculate environmental values independently.

The summary can use either Environmental burden or Personalized risk as the headline score. It can
include the place name or hide location entirely. When personalized risk is selected but unavailable,
the summary falls back to Environmental burden and labels the score accordingly.

Summaries can include the main factor, best outdoor window, and UV peak when those values are
available. They never include coordinates, raw provider JSON, cache keys, or Personal Allergy
Profile factor lists.

## Export Compliance

AirAware is intended for distribution through Google Play. Google notes that applications hosted on
Google servers may be subject to U.S. export laws when downloaded outside the United States, including
rules for software that uses encryption.

Current technical export-review notes:

- AirAware does not implement custom cryptography.
- AirAware does not include crypto or secure-storage dependencies.
- AirAware uses RevenueCat for billing entitlement management and Google Play processes payments.
- AirAware does not provide end-to-end encryption, secure messaging, VPN, authentication,
  cryptanalysis, network forensics, or digital-forensics functionality.
- Network requests use standard HTTPS/TLS provided by the platform and React Native networking stack.
- Shared summaries are generated locally and passed to the Android share sheet.
- No RevenueCat server secret key, Google Play service-account JSON, private key, or webhook secret is
  bundled in the app.

The repository includes an export-compliance guardrail test that fails if obvious crypto, secure
storage, unapproved billing, in-app purchase, or payment SDK dependencies/imports are introduced.
Before publishing, review the Google Play export-compliance questionnaire and the U.S. Bureau of
Industry and Security encryption guidance. This section is an engineering review aid, not legal
advice.

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

Generate native Android project files for development builds or native validation:

```sh
npx expo prebuild --platform android --no-install
```

The prebuild step applies the AirAware widget config plugin and generates Android AppWidgetProvider
code under `android/`. The generated native project is required to compile and test home-screen
widgets because Android widgets are not pure React Native views.

### Development Free/Pro Smoke Testing

In development builds, Settings includes an **AirAware Pro** section with a local capability preview:

- Use RevenueCat: use the configured RevenueCat entitlement.
- Preview Free shows the Free forecast horizon, Standard Environmental Data, and compact widget
  access.
- Preview Pro enables Extended Forecast, Advanced Environmental Data, and the advanced widget.

The preview is persisted in local app storage for development convenience. It is guarded by
`__DEV__`, ignored in production builds, and does not modify RevenueCat customer information,
simulate purchases, create purchase tokens, prices, subscriptions, accounts, ads, analytics, or
payment handling.

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
src/api/          Open-Meteo and OpenStreetMap network providers and response normalization
src/capabilities/ Static capability profiles, feature metadata, and availability selectors
src/core/         Pure scoring, mold, personalization, forecast, and summary logic
src/models/       Provider-independent TypeScript domain models
src/services/     Location, billing gateway, notifications, widgets, and environment assembly
src/storage/      AsyncStorage-backed settings and cache
src/state/        Zustand app store and refresh orchestration
src/components/   Reusable UI primitives
src/screens/      Today, Data, Forecast, Profile, and Settings screens
src/navigation/   React Navigation setup
src/theme/        Shared colors and spacing
src/utils/        Formatting and numeric helpers
tests/            Deterministic unit tests
plugins/          Expo config plugin that generates Android widget native code
```

Screens do not parse provider JSON and do not implement scoring formulas directly. Air-quality and
weather provider responses are validated independently, so a partial provider failure can reuse the
last valid cached data for the failed provider without discarding fresh data from the successful
provider.

## Capabilities

AirAware uses a capability-driven architecture so application code depends on what the active build
can do, not on hard-coded product tiers. The current Free capability profile enables every core
feature present in this MVP, while Pro capability metadata unlocks Extended Forecast, Advanced
Environmental Data, and the advanced home-screen widget.

Capabilities describe stable application concepts:

- Forecast horizon, including maximum days, default days, and whether the horizon is configurable
- Environmental variable groups, currently `standard` and `extended`
- Location support, currently automatic foreground location and one manual location
- Provider availability, currently Open-Meteo
- Sharing support, currently local daily summary sharing through the Android share sheet
- Notification capabilities, currently Free basic transition notifications and a reserved Pro
  advanced environmental notification capability
- Widget capabilities, currently Free compact Android widget and Pro advanced Android widget
- Reserved boundaries for history

Feature metadata lives beside the capability configuration and describes only functionality already
implemented in the app. Screens and services use capability selectors such as forecast limits,
feature availability, provider availability, and environmental-variable availability. This keeps
future edition changes localized to configuration and metadata rather than scattered conditionals.

The billing gateway isolates RevenueCat. Screens, scoring, providers, widgets, and profile logic do
not parse RevenueCat SDK objects. The gateway normalizes initialization status, entitlement status,
the lifetime package, localized price, purchase/restore progress, and user-safe errors. Production
Pro access is derived from RevenueCat customer information for the `pro` entitlement; a development
capability preview can override presentation only in `__DEV__` builds.

The current production entitlement defaults to Free unless RevenueCat verifies AirAware Pro.
Pro lifetime is represented as an entitlement and capability profile for Extended Forecast, Advanced
Environmental Data, and the advanced home-screen widget. Standard Forecast shows today plus 2
additional days, for 3 total forecast days. Extended Forecast shows today plus 6 additional days, for
up to 7 total forecast days. Advanced Environmental Data exposes additional informational readings
where the provider supports them. Mold potential and UV index remain standard readings and optional
Personal Allergy Profile factors for Free and Pro users. These capabilities do not change the
environmental burden formula, cache behavior, location behavior, notifications, or sharing.

Widget capabilities are separate from scoring and provider access. The compact widget is available
to Free and Pro users. The advanced widget is a Pro capability and uses the same active headline
score and centralized forecast horizon as the app. Its widget snapshot can include the full Pro
forecast horizon, while the widget renders only a compact subset of daily summaries to avoid
overcrowding. Widget code consumes a presentation-safe snapshot prepared by the app; it does not
parse provider JSON or duplicate scoring logic.

Basic transition notifications are available in Free and Pro. Advanced environmental notifications
are represented as a Pro capability boundary only; no advanced notification types are implemented in
this milestone.

## Limitations

- This MVP targets Android only.
- Forecasts are model estimates, not exact local sensor readings.
- Pollen data may be unavailable outside covered regions or seasons.
- Mold potential is not a measured mold-spore concentration.
- UV can be included in the personalized score when selected, but the environmental burden score
  remains unchanged.
- The best outdoor window is based only on available selected environmental variables. It does not
  guarantee safe or symptom-free conditions.
- Manual map zoom uses on-screen controls in the current MVP; pinch-to-zoom is not implemented yet.
- Reverse geocoding is best-effort and may be unavailable.
- Transition notifications are evaluated only when the app refreshes environmental data. They are
  not background alerts while the app is closed.
- Advanced Environmental Data availability depends on the selected Open-Meteo model, geography, and
  provider coverage. Missing variables are hidden automatically.
- Nearby vegetation depends on OpenStreetMap and Overpass coverage. Missing mapped features do not
  mean vegetation is absent.
- Widgets update when the app writes a fresh local widget snapshot. They do not perform aggressive
  independent polling, background location, or independent provider requests.
- No background location, advanced environmental notifications, accounts, analytics, subscriptions,
  or long-term history are included in this Android milestone.
- AirAware Pro purchase testing requires RevenueCat and Google Play configuration plus an Android
  development or release build. Expo Go cannot validate native purchases.
- The currently implemented Pro capabilities are Extended Forecast, Advanced Environmental Data, and
  the advanced home-screen widget; advanced environmental notifications are capability metadata only.

## License

AirAware Android is released under the MIT License. See [LICENSE](./LICENSE).

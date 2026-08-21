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
- React Navigation bottom tabs for Today, Profile, Pro, and Settings, with stack drill-downs for
  environmental, activity, and variable detail flows
- Zustand for local app state and refresh orchestration
- Capability-driven feature configuration for Free/Pro behavior
- Pure TypeScript modules for environmental scoring, personalization, mold potential, forecast logic,
  outdoor-window selection, notifications, widget snapshots, and daily summaries

### Data, Storage, and Device APIs

- Open-Meteo Air Quality API and Weather Forecast API through isolated provider modules
- OpenStreetMap Overpass API through an isolated nearby-vegetation provider
- Expo Location for foreground approximate location
- AsyncStorage for local settings, saved locations, active location ID, profile selections, a small
  entitlement presentation cache, development capability preview override, provider cache,
  notification transition state, and widget snapshots
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
- Approximate foreground location plus multiple locally saved manual map locations
- Location permission is requested only after the first-launch explanation is accepted
- Exactly one active location drives environmental data, vegetation, forecasts, notifications,
  daily summaries, and widgets
- Saved manual locations are capped by the app capability model and remain available to Free and Pro
  users
- Local Environmental Events derived from existing Open-Meteo/CAMS forecasts for pollen,
  pollution, Saharan dust, wildfire-related particulate pollution, UV, mold potential, and headline
  risk
- Environmental burden score using pollen, regulated pollution, atmospheric irritants, and mold
  potential
- Optional Personal Allergy Profile with a separate personalized environmental risk score
- Six pollen types: alder, birch, grass, mugwort, olive, ragweed
- Pollutant-specific AQI where available, with raw readings kept for display
- Mold potential visibility and optional personalized-score factor, using humidity,
  precipitation, temperature, dew point, wind, and leaf wetness where available
- UV index visibility and optional personalized-score factor
- Best outdoor window based on the active headline score
- Local cache fallback for offline or failed refreshes, with air-quality, weather, vegetation, and
  assembled environment caches isolated by coordinates
- Contextual environmental measurement drill-downs from Today detail screens
- Compact Environmental events section on Today, with event detail evidence and Open-Meteo/CAMS
  attribution
- Nearby vegetation and land-use context from OpenStreetMap, available to Free and Pro users
- Pro-only Activity domains for agriculture, drone operations, photography, astronomy, and outdoor
  work
- Local plain-text daily summary sharing
- Android home-screen widgets:
  - Free compact widget with current score and main factor
  - Advanced home-screen widget with current score, best outdoor window, and compact forecast
    summaries
- Optional Free risk transition notifications for the active headline score
- Pro-only configurable Environmental Event alert notifications, evaluated during normal app
  refreshes
- Gas-mask app icon and risk-colored Today icon
- Capability-based Free/Pro forecast horizon, Activities, and advanced widget access
- AirAware Pro lifetime purchase entitlement managed through RevenueCat and Google Play when a
  public RevenueCat SDK key is configured

## Screens

- **Today**: headline scores, scrollable active location selector, Environmental Events, update
  status, main factor, best outdoor window, refresh, share summary, and enabled Activity summary
  cards
- **Context detail screens**: Environmental burden, Personalized risk, and Activity details with
  Daily forecast graphs, current-to-next-24-hour forecast graphs, and tappable environmental
  measurements
- **Environmental variable details**: shared 24-hour, week, month, and year timeline for individual
  variables. The 24-hour variable timeline is the history-aware view: past values appear above Now
  and forecast values appear below Now.
- **Profile**: local Personal Allergy Profile toggles, including Mold potential and UV index
- **Pro**: AirAware Pro purchase/restore status, development capability preview, and Activity
  toggles
- **Settings**: saved-location management, manual map selection, notification preferences,
  daily-summary score, privacy and attribution notes, and disclaimers

## Android Home-Screen Widgets

AirAware provides two Android home-screen widgets installed with the app:

- **AirAware compact widget**: available to Free and Pro users. It shows the active headline score,
  category, main factor, optional UV category when available, and cached-data state.
- **Advanced home-screen widget**: requires the advanced widget capability. It shows the active
  headline score, main factor, best outdoor window when available, and daily forecast summaries up
  to the active forecast horizon. The snapshot can hold the full active forecast horizon; the widget
  renders a compact subset that fits legibly.

Widgets use the latest locally cached widget snapshot prepared by the app for the active location
after refreshes and relevant settings/profile/location changes. Widgets do not fetch Open-Meteo
directly, do not request location, do not choose between saved locations, and do not recalculate
scores. If Pro is unavailable, the advanced widget shows a compact locked informational state and
opens AirAware Settings.

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

Professional Activity condition rows may use additional Open-Meteo weather or air-quality variables
such as visibility, cloud cover, wind gusts, soil moisture, ET0, VPD, radiation, PM2.5, or ozone.
Those variables are surfaced in context inside enabled Activities rather than as a generic raw-data
catalog. They are informational Activity inputs only and do not influence environmental burden,
personalized risk, notifications, daily summaries, or the core best outdoor window. Mold potential
and UV index are standard AirAware readings available to Free and Pro users. Mold remains part of
the base environmental burden formula so the environmental burden score keeps a consistent meaning.

The Personal Allergy Profile is enabled by default. When enabled, it calculates a separate
personalized environmental risk score from selected local factors available to the active capability
profile. Profile switches control only personalized-score inputs; they do not hide or show readings
on Today. The active headline score is Personalized risk when available and Environmental burden
otherwise. Daily-summary score selection remains configurable and falls back to Environmental burden
when personalization is unavailable. Disabled factors are not treated as environmentally absent, and
missing selected readings are omitted rather than treated as zero. Mold potential and UV index are
available to Free and Pro users as opt-in personalized-score factors and are disabled by default. UV
does not change the original environmental burden score.

Mold potential is inferred from environmental weather conditions. It is not a measured mold-spore
concentration.

## Data Sources

- Open-Meteo Air Quality API
- Open-Meteo Weather Forecast API
- OpenStreetMap Overpass API for nearby vegetation and land-use context
- OpenStreetMap map tiles for manual location selection

Open-Meteo Air Quality data includes CAMS ENSEMBLE atmospheric forecasts where available.
Availability varies by variable, region, model domain, and season.

Activities request only the additional Open-Meteo variables needed by enabled profiles. Examples
include visibility, cloud cover, wind gusts, precipitation probability, soil moisture, soil
temperature, ET0, VPD, radiation, temperature, humidity, PM2.5, and ozone where supported. Missing
values are omitted rather than treated as zero.

## Environmental Events

Environmental Events are first-class local domain objects derived from the same normalized
Open-Meteo Air Quality and Weather data used by Today, forecasts, widgets, and summaries. AirAware
does not add another provider, API key, backend, provider account, telemetry, analytics, background
location, or continuous background monitor for this feature.

Events inspect the next 24 hours of the active location forecast and group qualifying hours into
episodes. For example, several consecutive High or Very High grass pollen hours become one pollen
episode with a start, end, peak, severity, confidence, and structured internal evidence. The engine
correlates related evidence so a dust-driven PM10/AOD episode appears as Saharan dust rather than
three redundant dust, PM10, and aerosol alerts. A severe independent pollutant, such as ozone, can
still appear alongside a Saharan dust event.

Implemented event types:

- Pollen: alder, birch, grass, mugwort, olive, and ragweed using AirAware's existing pollen scoring
  categories
- Pollution: PM2.5, PM10, nitrogen dioxide, ozone, and sulphur dioxide using pollutant-specific AQI
  where available
- Saharan dust: derived directly from the CAMS/Open-Meteo `dust` field, with AOD and PM values used
  only as supporting evidence
- Wildfire-related particulate pollution: derived only when CAMS/Open-Meteo provides
  wildfire-attributed PM10 (`pm10_wildfires`)
- Aerosol/haze: derived from elevated aerosol optical depth only when no stronger source-attributed
  event is supported
- UV: based on existing UV category behavior
- Mold potential: based on AirAware's existing weather-inferred mold potential model
- Headline risk: based on Personalized risk when available, otherwise Environmental burden

AirAware can report wildfire-related particulate pollution when source-attributed wildfire PM10 is
available. It does not detect active fires, fire names, fire perimeters, fire distance, fire
direction, fire count, or whether a fire is nearby. Wildfire-related pollution copy must not imply
fire location or movement.

Events use model forecasts, not local sensors, and do not predict medical symptoms. Advanced CAMS
fields may be unavailable for some regions, model domains, or forecast hours. Missing optional event
evidence is omitted rather than treated as zero.

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

Coordinates are sent to Open-Meteo to retrieve local environmental data only after the user accepts
the location explanation, uses Current location, or selects a saved manual location. Exactly one
active location is used at a time. When Pro Activities are enabled, AirAware may request additional
Open-Meteo variables required by those enabled profiles. Saved manual locations, custom names, and
the active location ID are stored locally and are not sent to Open-Meteo, OpenStreetMap,
RevenueCat, or unrelated services. When the manual map picker is shown, OpenStreetMap tile servers
receive requests for the visible map area. When Nearby vegetation is used, only the active latitude
and longitude are sent to the configured OpenStreetMap Overpass API to request mapped vegetation
and land-use features near the selected coordinates. Personal Allergy Profile selections and
Activity selections remain in local app storage and are not sent to Open-Meteo, OpenStreetMap,
RevenueCat, or any other environmental provider. Shared summaries are generated locally and passed
to the Android share sheet; AirAware does not upload them.

Environmental Events are detected locally from already requested Open-Meteo/CAMS forecast values for
the active coordinates. AirAware does not send saved-location names, saved-location IDs, the saved
location list, Personal Allergy Profile selections, event settings, detected events, notification
fingerprints, widget snapshots, or RevenueCat state to Open-Meteo, Overpass, or unrelated services.

AirAware uses RevenueCat to manage AirAware Pro purchase entitlement. Google Play processes
payments; AirAware does not directly handle card or payment information. RevenueCat may process
anonymous app identifiers, purchase records, product identifiers, entitlement state, and device/app
metadata needed for billing. AirAware does not send RevenueCat coordinates, environmental readings,
Personal Allergy Profile selections, Activity selections, nearby vegetation data, shared summaries,
or notification settings.

Shared summaries may include the active saved-location name or resolved place name when configured,
but never include coordinates, raw provider JSON, cache keys, location IDs, the saved-location list,
or profile factor lists.

Android widgets display locally cached AirAware snapshot data. They do not independently contact
Open-Meteo, do not include coordinates, and do not display Personal Allergy Profile selections.
Widget data is not uploaded by AirAware. Android launchers may capture or display widget content as
part of normal system behavior. Locked advanced widgets do not expose environmental data when Pro is
unavailable.

AirAware requests only approximate foreground location. It does not request background location,
precise location, contacts, camera, microphone, SMS, call logs, health permissions, installed-app
inventory, or advertising ID in this MVP.

Notification permission is requested only if the user enables risk transition notifications or
Pro Environmental Event alert notifications in Settings. AirAware does not request notification
permission on first launch.

Because AirAware has no account system and no server-side user profile, clearing app storage or
uninstalling the app removes locally stored settings, saved locations, cached provider responses,
active location state, and Personal Allergy Profile selections. RevenueCat uses anonymous app user
IDs; restore purchases remains available to recover eligible Google Play purchases.

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
- If notifications are enabled, disclose that notification permission is optional and used only for
  local AirAware risk transition notifications and Pro Environmental Event alerts evaluated during
  normal app refreshes.
- Re-run `npm run validate`, `npx expo-doctor`, and the Google Play policy guardrail tests before
  release.

The guardrail tests fail if the project adds obvious policy-sensitive dependencies such as ads,
analytics, tracking, unapproved billing, unrelated in-app purchase/payment, or account SDKs, or if
Android location permissions expand beyond approximate foreground location. The approved billing
dependency is `react-native-purchases`; RevenueCat imports must stay isolated in the billing gateway.

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
later days, and missing values are omitted rather than treated as zero. Context detail pages present
two forecast views: **Daily forecast** for the active forecast horizon and **24-hour forecast** from
the current reading forward. The per-variable environmental detail page is the history-aware view:
its 24-hour timeline shows approximately 12 hours of Open-Meteo history, Now, and available
forecast. The Best outdoor window remains a short-term feature. When a best window starts tomorrow,
AirAware labels it with `(tomorrow)`; windows that start today and end after midnight are not
labeled as tomorrow.

Professional Activities:

- Free: Activity catalog visible, but Activity profiles cannot be enabled
- Pro lifetime: Agriculture, Drone Operations, Photography, Astronomy, and Outdoor Work domains can
  be enabled individually

Activities are disabled by default. Enabled domains expose narrower professional profiles such as
spraying, irrigation, drone survey, landscape photography, stargazing, and work-at-height context.
They use relevant Open-Meteo forecast variables to identify environmental windows and concise
reasons. Activity 24-hour graphs start at the current reading and look forward, matching the
Environmental burden and Personalized risk detail pages. Activity selections stay local and are not
sent to RevenueCat or environmental providers. Additional measurements used by Activities are
surfaced in context inside Activity details rather than as a generic advanced data catalog.

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
Free. Development builds include a capability preview control in the **Pro** tab so Free and Pro
surfaces can be smoke-tested. The preview is ignored in production, does not modify RevenueCat
customer information, does not simulate a purchase, and does not store purchase tokens. Personal
Allergy Profile data remains local and is not sent to RevenueCat, Open-Meteo, or any other provider.

Notification capabilities are modeled separately:

- Free and Pro: basic transition notifications for the active headline score
- Pro lifetime: configurable Environmental Event alert notifications for pollen, air pollution,
  Saharan dust, wildfire-related particulate pollution, UV, mold potential, and overall
  environmental risk

Environmental Events are visible on Today for Free and Pro users. Only the configurable event alert
notifications are gated by the advanced environmental notification capability.

Real purchase testing requires an Android development or release build. Expo Go cannot perform native
RevenueCat purchases. RevenueCat Test Store can be used for development testing when configured, but
real Google Play purchase validation still requires the proper Play Console product, tester, and
build distribution setup.

## AirAware Pro Purchases

AirAware Pro purchases are managed through RevenueCat and Google Play.

Install the RevenueCat SDK package with Expo-compatible dependency resolution:

```sh
npx expo install react-native-purchases
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

The active headline score is derived automatically:

- Personalized risk, when enabled and available
- Environmental burden otherwise

Missing scores are not treated as zero, and the first valid score only establishes a baseline.

Notification thresholds:

- High and Very High
- Very High only

AirAware does not send recovery notifications and does not repeat notifications while the category is
unchanged. Transition state is local and is reset when the effective headline score type, effective
location, or personalized profile context changes.

In this MVP, notifications are evaluated during app refreshes. AirAware does not add background
fetch, background location, alarm scheduling, headless tasks, or foreground services.

The Settings screen also includes a local test-notification action. It verifies Android notification
delivery without creating a fake risk transition or changing transition state.

AirAware Pro can also enable Environmental Event alert categories for pollen, air pollution,
Saharan dust, wildfire-related particulate pollution, UV, mold potential, and overall environmental
risk. These alerts reuse the same local notification architecture and are generated only from fresh
or accepted current forecast data during normal app refreshes. Event notification fingerprints are
scoped by active location, event type, factor, severity, and episode start bucket so repeated
refreshes do not notify repeatedly. A later meaningful severity escalation can notify again, while
minor timing drift should not. Stale cached events may be displayed when the cache is still accepted,
but stale reloads do not create new event notifications.

Environmental Event alerts are always for the active location only. AirAware does not fetch events
for every saved location and does not let a stale refresh from a previously active location update
visible events, notifications, or widget snapshots.

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

In development builds, the **Pro** tab includes a local capability preview:

- Use RevenueCat: use the configured RevenueCat entitlement.
- Preview Free shows the Free forecast horizon, standard environmental readings, compact widget
  access, and locked Activities.
- Preview Pro enables Extended Forecast, Activities, and the advanced widget.

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
src/core/         Pure scoring, mold, Environmental Events, personalization, forecast, activity,
                  and summary logic
src/models/       Provider-independent TypeScript domain models
src/services/     Location, billing gateway, notifications, widgets, and environment assembly
src/storage/      AsyncStorage-backed settings and cache
src/state/        Zustand app store and refresh orchestration
src/components/   Reusable UI primitives
src/screens/      Today, Profile, Pro, Settings, and stack detail screens
src/navigation/   React Navigation setup
src/theme/        Shared colors and spacing
src/utils/        Formatting and numeric helpers
tests/            Deterministic unit tests
plugins/          Expo config plugin that generates Android widget native code
```

Screens do not parse provider JSON and do not implement scoring formulas directly. Air-quality and
weather provider responses are validated independently, so a partial provider failure can reuse the
last valid cached data for the failed provider without discarding fresh data from the successful
provider. Environmental Events are detected by a pure TypeScript engine from normalized
provider-independent models after environment assembly; React components and notification code do
not parse provider JSON or implement event thresholds directly. Provider query keys and persisted
environment/vegetation cache entries are isolated by coordinates, so Location A data is not
presented as Location B data after switching active locations.

## Capabilities

AirAware uses a capability-driven architecture so application code depends on what the active build
can do, not on hard-coded product tiers. The current Free capability profile enables every core
feature present in this MVP, while Pro capability metadata unlocks Extended Forecast, Activities,
and the advanced home-screen widget.

Capabilities describe stable application concepts:

- Forecast horizon, including maximum days, default days, and whether the horizon is configurable
- Environmental variable groups, currently `standard` plus internal activity variables requested
  only when enabled Activities need them
- Location support, currently automatic foreground Current location plus multiple saved manual
  locations for Free and Pro users
- Provider availability, currently Open-Meteo
- Sharing support, currently local daily summary sharing through the Android share sheet
- Notification capabilities, currently Free basic transition notifications and Pro advanced
  Environmental Event alerts
- Widget capabilities, currently Free compact Android widget and Pro advanced Android widget
- Environmental variable detail history, fetched on demand from Open-Meteo rather than built from
  locally recorded readings

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
Pro lifetime is represented as an entitlement and capability profile for Extended Forecast,
Activities, and the advanced home-screen widget. Standard Forecast shows today plus 2 additional
days, for 3 total forecast days. Extended Forecast shows today plus 6 additional days, for up to 7
total forecast days. Activities expose professional environmental profiles instead of a generic
advanced data dump. Mold potential and UV index remain standard readings and optional Personal
Allergy Profile factors for Free and Pro users. These capabilities do not change the environmental
burden formula, cache behavior, location behavior, notifications, or sharing.

Saved locations are represented as local domain state with a stable Current location entry and
stable generated IDs for manual locations. The store resolves the active location to coordinates
before provider calls, and provider modules receive only coordinates plus requested variable
options. Switching the active location clears or replaces presentation data with a matching
coordinate cache, starts a refresh, updates nearby vegetation for the active coordinates, scopes
notification transition state by active location ID and coordinates, and regenerates the local
widget snapshot. Persisted saved-location state is treated defensively: duplicate or otherwise
corrupt manual location IDs fall back to the stable Current location instead of being rendered as
ambiguous UI rows.

Activity logic is configuration-driven. Each Activity definition declares required and optional
environmental variables, Open-Meteo request variables, suitability rules, and detail rows. Activity
detail rows use the same environmental variable metadata and detail timeline screen as other
environmental rows whenever legitimate history/forecast support exists.

Widget capabilities are separate from scoring and provider access. The compact widget is available
to Free and Pro users. The advanced widget is a Pro capability and uses the same active headline
score and centralized forecast horizon as the app. Its widget snapshot can include the full Pro
forecast horizon, while the widget renders only a compact subset of daily summaries to avoid
overcrowding. Widget code consumes a presentation-safe snapshot prepared by the app; it does not
parse provider JSON or duplicate scoring logic.

Basic transition notifications are available in Free and Pro. Environmental Events are visible on
Today for Free and Pro users. Advanced environmental notification settings are exposed only through
the Pro notification capability, and services use capability selectors rather than direct tier
checks in event detection.

## Limitations

- This MVP targets Android only.
- Forecasts are model estimates, not exact local sensor readings.
- Environmental Events are forecast-derived episodes evaluated during app refreshes, not continuous
  monitoring or local sensor detections.
- Pollen data may be unavailable outside covered regions or seasons.
- CAMS/Open-Meteo advanced event evidence varies by region, model domain, and forecast hour.
- Mold potential is not a measured mold-spore concentration.
- UV can be included in the personalized score when selected, but the environmental burden score
  remains unchanged.
- The best outdoor window is based only on available selected environmental variables. It does not
  guarantee safe or symptom-free conditions.
- Manual map zoom uses on-screen controls in the current MVP; pinch-to-zoom is not implemented yet.
- Reverse geocoding is best-effort and may be unavailable.
- Saved manual locations are local to the device. There is no account sync, shared location list,
  or server-side backup.
- The current capability limit is eight saved manual locations plus the stable Current location
  entry.
- Transition notifications are evaluated only when the app refreshes environmental data. They are
  not background alerts while the app is closed.
- Activity measurements depend on the selected Open-Meteo model, geography, forecast horizon, and
  provider coverage. Missing variables are omitted rather than treated as zero.
- Nearby vegetation depends on OpenStreetMap and Overpass coverage. Missing mapped features do not
  mean vegetation is absent.
- Widgets update when the app writes a fresh local widget snapshot. They do not perform aggressive
  independent polling, background location, or independent provider requests.
- Wildfire-related particulate pollution events require wildfire-attributed CAMS/Open-Meteo PM10.
  AirAware does not detect active fires, fire distance, fire perimeters, fire names, fire direction,
  or number of fires.
- No background location, accounts, analytics, subscriptions, or long-term history are included in
  this Android milestone.
- AirAware Pro purchase testing requires RevenueCat and Google Play configuration plus an Android
  development or release build. Expo Go cannot validate native purchases.
- The currently implemented Pro capabilities are Extended Forecast, Activities, the advanced
  home-screen widget, and configurable Environmental Event alert notifications.

## License

AirAware Android is released under the MIT License. See [LICENSE](./LICENSE).

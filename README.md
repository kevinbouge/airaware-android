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
- Capability-driven feature configuration for future edition changes
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
- Pro Mold potential visibility and optional personalized-score factor, using humidity,
  precipitation, temperature, dew point, wind, and leaf wetness where available
- Pro UV index visibility and optional personalized-score factor
- Best outdoor window based on the selected forecast score mode
- Local cache fallback for offline or failed refreshes, with air-quality and weather freshness tracked
  independently
- Local plain-text daily summary sharing
- Optional Free risk transition notifications for the active headline score
- Extended Environmental Data capability for additional informational measurements where
  Open-Meteo supports them
- Gas-mask app icon and risk-colored Today icon
- Capability-based Free/Pro forecast horizon and extended data access, with no purchases active in
  this build

## Screens

- **Today**: headline scores, location, update status, main factor, collapsible current-reading
  sections, Pro-only Mold and sun, Atmospheric composition, Pressure and visibility, Clouds and
  moisture, Solar and convection, and Wind sections when available, refresh, and share summary
- **Forecast**: daily score summary and 24-hour risk timeline. The forecast can use either the
  environmental burden score or the personalized risk score, and the highlighted range marks the
  best outdoor window
- **Profile**: local Personal Allergy Profile toggles. Pro adds Mold potential and UV index as
  optional personalized-risk factors; informational extended measurements remain display-only on
  Today
- **Settings**: location mode, manual map selection, refresh interval, outdoor-window duration,
  headline score, forecast score, notification preferences, daily-summary score, privacy and
  attribution notes, and current AirAware Pro status

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

Extended Environmental Data is displayed separately from scored environmental variables. Additional
atmospheric and weather measurements are informational only and do not influence environmental
burden, personalized risk, notifications, best outdoor window calculations, or daily summaries. Mold
potential and UV index are also exposed only through the Pro environmental-variable capability for
current-reading visibility and Personal Allergy Profile selection. Mold remains part of the base
environmental burden formula so the environmental burden score keeps a consistent meaning.

The Personal Allergy Profile is disabled by default. When enabled, it calculates a separate
personalized environmental risk score from selected local factors available to the active capability
profile. Profile switches control only personalized-score inputs; they do not hide or show readings
on Today. If personalization is disabled, headline, forecast, and daily-summary score settings fall
back to Environmental burden. Disabled factors are not treated as environmentally absent, and missing
selected readings are omitted rather than treated as zero. Mold potential and UV index are available
to Pro users as opt-in personalized-score factors and are disabled by default. UV does not change the
original environmental burden score.

Mold potential is inferred from environmental weather conditions. It is not a measured mold-spore
concentration.

## Data Sources

- Open-Meteo Air Quality API
- Open-Meteo Weather Forecast API
- OpenStreetMap map tiles for manual location selection

Availability varies by variable, region, model domain, and season.

Extended Environmental Data uses supported Open-Meteo variables such as CO₂, ammonia, methane,
nitrogen monoxide, formaldehyde, NMVOC, pressure, visibility, cloud cover, dew point, wet-bulb
temperature, wind gusts, radiation, sunshine duration, and CAPE where available.

These extended variables are requested as part of the existing Open-Meteo provider calls and are
hidden automatically when the upstream response does not provide a valid numeric value.

## Privacy

AirAware does not use analytics, advertising identifiers, accounts, telemetry, cloud sync, or remote
configuration.

Coordinates are sent to Open-Meteo to retrieve local environmental data, including optional extended
measurements when available, only after the user accepts the location explanation or selects a manual
location. Manual map selections are saved locally and refresh the environmental data for the selected
coordinates. When the manual map picker is shown, OpenStreetMap tile servers receive requests for
the visible map area. Personal Allergy Profile selections remain in local app storage and are not
sent to providers. Shared summaries are generated locally and passed to the Android share sheet;
AirAware does not upload them.

Shared summaries never include coordinates, raw provider JSON, or profile factor lists.

AirAware requests only approximate foreground location. It does not request background location,
precise location, contacts, camera, microphone, SMS, call logs, health permissions, installed-app
inventory, or advertising ID in this MVP.

Notification permission is requested only if the user enables risk transition notifications in
Settings. AirAware does not request notification permission on first launch.

Because AirAware has no account system and no server-side user profile, clearing app storage or
uninstalling the app removes locally stored settings, cached provider responses, selected
coordinates, and Personal Allergy Profile selections.

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
- Complete the Health apps declaration if Play Console classifies AirAware as health-related.
  AirAware must be described as environmental information only: it does not predict symptoms,
  diagnose allergies, provide medical advice, or guarantee safe conditions.
- Declare that the app has no ads, analytics, accounts, subscriptions, Google Play Billing
  integration, user-generated content, or background location in the current build.
- If risk transition notifications are enabled, disclose that notification permission is optional
  and used only for local AirAware risk-category transition notifications.
- Re-run `npm run validate`, `npx expo-doctor`, and the Google Play policy guardrail tests before
  release.

The guardrail tests fail if the project adds obvious policy-sensitive dependencies such as ads,
analytics, tracking, billing, in-app purchase, payment, or account SDKs, or if Android location
permissions expand beyond approximate foreground location.

## Free and Pro

AirAware's currently implemented core features remain free.

Free includes Standard Environmental Data, which covers the core pollen, regulated-pollution, and
atmospheric-irritant readings.

AirAware Pro currently adds two modeled capabilities:

Extended Forecast:

- Free: today plus 2 additional days
- Pro lifetime: today plus 3 additional days

Extended Environmental Data:

- Free: Standard Environmental Data
- Pro lifetime: Mold potential and UV index visibility, plus additional informational atmospheric
  and weather measurements where available

AirAware Pro is planned as a one-time lifetime unlock with no subscription and no account
requirement. Google Play would process future purchases; AirAware does not handle payment
information directly.

Google Play Billing is not active in the current build, so purchasing AirAware Pro is not available
yet. The production entitlement defaults to Free. Development builds may use an isolated local Pro
override for testing capability-gated UI, but no purchase, restore, token storage, or billing SDK is
implemented. Personal Allergy Profile data remains local and is not sent to billing, Open-Meteo, or
any other provider.

Notification capabilities are modeled separately:

- Free and Pro: basic transition notifications for the active headline score
- Pro lifetime: advanced environmental notification capability reserved for future alert types

Only basic transition notifications are implemented today. Advanced environmental notification
types are not implemented and no Pro-only notification settings are shown.

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
- AirAware does not include crypto, secure-storage, billing, in-app purchase, or payment SDK
  dependencies.
- AirAware does not provide end-to-end encryption, secure messaging, VPN, authentication,
  cryptanalysis, network forensics, or digital-forensics functionality.
- Network requests use standard HTTPS/TLS provided by the platform and React Native networking stack.
- Shared summaries are generated locally and passed to the Android share sheet.
- Google Play Billing is not integrated; AirAware does not handle payment information directly.

The repository includes an export-compliance guardrail test that fails if obvious crypto, secure
storage, billing, in-app purchase, or payment SDK dependencies/imports are introduced. Before
publishing or adding those capabilities, review the Google Play export-compliance questionnaire and
the U.S. Bureau of Industry and Security encryption guidance. This section is an engineering review
aid, not legal advice.

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
src/capabilities/ Static capability profiles, feature metadata, and availability selectors
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

## Capabilities

AirAware uses a capability-driven architecture so application code depends on what the active build
can do, not on hard-coded product tiers. The current Free capability profile enables every core
feature present in this MVP, while Pro capability metadata unlocks only the additional forecast day
and Extended Environmental Data.

Capabilities describe stable application concepts:

- Forecast horizon, including maximum days, default days, and whether the horizon is configurable
- Environmental variable groups, currently `standard` and `extended`
- Location support, currently automatic foreground location and one manual location
- Provider availability, currently Open-Meteo
- Sharing support, currently local daily summary sharing through the Android share sheet
- Notification capabilities, currently Free basic transition notifications and a reserved Pro
  advanced environmental notification capability
- Reserved boundaries for widgets and history

Feature metadata lives beside the capability configuration and describes only functionality already
implemented in the app. Screens and services use capability selectors such as forecast limits,
feature availability, provider availability, and environmental-variable availability. This keeps
future edition changes localized to configuration and metadata rather than scattered conditionals.

The project also includes a small billing gateway boundary. It is intentionally a no-op and has no
product identifiers, purchase logic, restore flow, Google Play Billing SDK, paywall, ads, accounts,
or analytics. Future billing work should integrate through that isolated boundary instead of leaking
purchase checks into screens, scoring, provider, or storage code.

The current production entitlement is Free. Pro lifetime is represented as an entitlement and
capability profile for Extended Forecast and Extended Environmental Data. Extended Forecast changes
the daily forecast summary from 3 total days to 4 total days. Extended Environmental Data exposes
additional informational readings where the provider supports them and makes Mold potential and UV
index available as optional Personal Allergy Profile factors. These capabilities do not change the
environmental burden formula, cache behavior, location behavior, notifications, or sharing.

Basic transition notifications are available in Free and Pro. Advanced environmental notifications
are represented as a Pro capability boundary only; no advanced notification types are implemented in
this milestone.

## Limitations

- This MVP targets Android only.
- Forecasts are model estimates, not exact local sensor readings.
- Pollen data may be unavailable outside covered regions or seasons.
- Mold potential is not a measured mold-spore concentration.
- UV can be included in the personalized score for Pro users, but the environmental burden score
  remains unchanged.
- The best outdoor window is based only on available selected environmental variables. It does not
  guarantee safe or symptom-free conditions.
- Manual map zoom uses on-screen controls in the current MVP; pinch-to-zoom is not implemented yet.
- Reverse geocoding is best-effort and may be unavailable.
- Transition notifications are evaluated only when the app refreshes environmental data. They are
  not background alerts while the app is closed.
- Extended Environmental Data availability depends on the selected Open-Meteo model, geography, and
  provider coverage. Missing variables are hidden automatically.
- No background location, advanced environmental notifications, widgets, OpenStreetMap vegetation
  context, accounts, analytics, or long-term history are included in this first Android milestone.
- Google Play Billing is not integrated yet. The currently modeled Pro capabilities are one
  additional daily forecast summary day and Extended Environmental Data; advanced environmental
  notifications are capability metadata only.

## License

AirAware Android is released under the MIT License. See [LICENSE](./LICENSE).

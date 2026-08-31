# AirAware — Agent Development Instructions

AirAware is an Android app for health-relevant external conditions: environmental data/events, public biological/population-health surveillance, and public ambient-radiation context.

It is privacy-first, deterministic, lightweight, offline-first where practical, worldwide, and conservative in health interpretation. Never diagnose disease, estimate individual infection/mortality risk, infer nuclear incidents, or calculate personal radiation dose.

## Engineering principles

Before changing code, inspect the relevant implementation, architecture, conventions, shared components, and tests. Do not infer behavior from the task alone.

Prefer simple, explicit, deterministic code; existing patterns; small focused diffs; platform/project capabilities; reusable primitives. Avoid unnecessary abstractions/dependencies, speculation, premature generalization, duplicate functionality, unrelated refactors/renames/reorganization, and formatting-only churn.

Implement the smallest reasonable change. Preserve externally observable behavior unless explicitly changed. Maintain compatibility for persisted user data, settings, caches, purchases, and external behavior; obsolete internal abstractions may be safely migrated.

Do not create documentation unless requested. Update existing docs only when the change makes them materially wrong and docs are in scope.

## Toolchain

Use the repo Node version (`nvm use` / `.nvmrc`) before Node/npm commands.

Do not change Node, lockfile format, Expo SDK, or native build tooling unless required.

## Authoritative references

Use these references when touching the related integration. Verify current provider behavior before implementation; do not rely on memory.

### Platform / Android

- [Expo SDK 57](https://docs.expo.dev/versions/v57.0.0/)
- [Expo Location](https://docs.expo.dev/versions/v57.0.0/sdk/location/)
- [Expo Notifications](https://docs.expo.dev/versions/v57.0.0/sdk/notifications/)
- [Expo config plugins](https://docs.expo.dev/config-plugins/introduction/)
- [React Native](https://reactnative.dev/docs/getting-started)
- [Android App Widgets](https://developer.android.com/develop/ui/views/appwidgets)
- [Google Play Billing](https://developer.android.com/google/play/billing)

### Environmental / mapping

- [Open-Meteo Weather Forecast API](https://open-meteo.com/en/docs)
- [Open-Meteo Air Quality API](https://open-meteo.com/en/docs/air-quality-api)
- [OpenStreetMap Overpass API](https://wiki.openstreetmap.org/wiki/Overpass_API)
- [Overpass QL](https://wiki.openstreetmap.org/wiki/Overpass_API/Overpass_QL)
- [OSM Map Features](https://wiki.openstreetmap.org/wiki/Map_features)
- [Taginfo API](https://taginfo.openstreetmap.org/taginfo/apidoc)
- [OSM Tile Usage Policy](https://operations.osmfoundation.org/policies/tiles/)
- [OSM Attribution Guidelines](https://osmfoundation.org/wiki/Licence/Attribution_Guidelines)

### Public health / surveillance

- [WHO GISRS](https://www.who.int/initiatives/global-influenza-surveillance-and-response-system)
- [WHO RespiMart](https://www.who.int/tools/respimart)
- [WHO influenza / COVID-19 data reporting](https://www.who.int/teams/global-influenza-programme/influenza-covid19/data-reporting)
- [WHO Global Health Observatory OData API](https://www.who.int/data/gho/info/gho-odata-api)
- [WHO Athena API examples](https://www.who.int/data/gho/info/athena-api-examples)
- [CDC NWSS](https://www.cdc.gov/nwss/)
- [Socrata SODA query documentation](https://dev.socrata.com/docs/queries/)
- [CDC wastewater SARS-CoV-2 dataset `j9g8-acpt`](https://dev.socrata.com/foundry/data.cdc.gov/j9g8-acpt)
- [CDC wastewater Influenza A dataset `ymmh-divb`](https://dev.socrata.com/foundry/data.cdc.gov/ymmh-divb)
- [CDC wastewater RSV dataset `45cq-cw4i`](https://dev.socrata.com/foundry/data.cdc.gov/45cq-cw4i)
- [PHAC National Wastewater Monitoring of Pathogens](https://health-infobase.canada.ca/wastewater/)
- [PHAC wastewater viral load CSV](https://health-infobase.canada.ca/src/data/wastewater/wastewater_aggregate.csv)
- [PHAC wastewater trend CSV](https://health-infobase.canada.ca/src/data/wastewater/wastewater_trend.csv)
- [Santé publique France SUM'Eau open-data notice](https://www.data.gouv.fr/datasets/surveillance-du-sars-cov-2-dans-les-eaux-usees-sumeau)
- [Santé publique France Odissé SUM'Eau indicators API](https://odisse.santepubliquefrance.fr/api/explore/v2.1/catalog/datasets/sum-eau-indicateurs/records)
- [Santé publique France Odissé SUM'Eau stations API](https://odisse.santepubliquefrance.fr/api/explore/v2.1/catalog/datasets/sumeau_stations/records)
- [RIVM COVID-19 open data](https://data.rivm.nl/covid-19/)
- [RIVM national wastewater JSON](https://data.rivm.nl/covid-19/COVID-19_rioolwaterdata_landelijk.json)
- [ECDC seasonal dengue weekly report](https://dengue-weekly.ecdc.europa.eu/)
- [ECDC dengue case summary CSV](https://dengue-weekly.ecdc.europa.eu/case_summary.csv)
- [PAHO dengue indicators](https://opendata.paho.org/en/dengue-indicators)
- [PAHO Core Indicators dataset](https://opendata.paho.org/en/core-indicators/download-dataset)

PAHO dengue weekly surveillance is not currently integrated: PAHO documents weekly reporting, but a stable filtered operational API suitable for AirAware was not verified. Do not substitute the annual Core Indicators bulk download for current dengue surveillance.

### Population health

- [Eurostat API — getting started](https://ec.europa.eu/eurostat/web/user-guides/data-browser/api-data-access/api-getting-started/api)
- [Eurostat API documentation](https://ec.europa.eu/eurostat/web/user-guides/data-browser/api-data-access)
- [Eurostat dissemination API Swagger](https://ec.europa.eu/eurostat/api/dissemination/swagger-ui)
- [Our World in Data — data access FAQ](https://ourworldindata.org/faqs)

### Radiological

- [Safecast Map API](https://simplemap.safecast.org/map-api/index.html)
- [Safecast openness and data access](https://safecast.org/frequently-asked-questions/openness-and-data-access/)
- [EPA RadNet CSV file downloads](https://www.epa.gov/radnet/radnet-csv-file-downloads)
- [EURDEP public website](https://remap.jrc.ec.europa.eu/)

EPA RadNet is deferred until station metadata and measurement semantics can be integrated without scraping. EURDEP is deferred unless a stable anonymous documented machine-readable endpoint is verified.

### Official warnings / hazards

- [NOAA/NWS API Web Service](https://www.weather.gov/documentation/services-web-api)
- [NOAA/NWS Alerts Web Service](https://www.weather.gov/documentation/services-web-alerts)
- [NOAA/NWS OpenAPI specification](https://api.weather.gov/openapi.json)
- [MeteoAlarm OGC API EDR authentication](https://api.meteoalarm.org/edr/v1/authentication)
- [MeteoAlarm OGC API EDR collections](https://api.meteoalarm.org/edr/v1/collections)
- [GDACS Swagger / OpenAPI](https://www.gdacs.org/gdacsapi/swagger/index.html)
- [GDACS event search endpoint](https://www.gdacs.org/gdacsapi/api/events/geteventlist/SEARCH)

NOAA/NWS is a keyless US official-warning candidate. Keep agency-issued alerts separate from AirAware-derived Environmental Events. MeteoAlarm public metadata is keyless, but operational warning-location endpoints require a token; classify it as key-required/deferred for production warning lookups.

### Water / bathing quality

- [EEA BathingWater ArcGIS REST folder](https://water.discomap.eea.europa.eu/arcgis/rest/services/BathingWater)
- [EEA BathingWater dynamic map service](https://water.discomap.eea.europa.eu/arcgis/rest/services/BathingWater/BathingWater_Dyna_WM/MapServer)

EEA BathingWater is an official periodic classification candidate, not a real-time safe-to-swim signal. Verify the latest season/layer semantics before integrating.

### Regional environmental enrichment

- [DWD health alerts open data](https://opendata.dwd.de/climate_environment/health/alerts/)
- [DWD pollen forecasts open data](https://opendata.dwd.de/climate_environment/health/forecasts/pollen/)

DWD is a Germany-specific enrichment candidate. Do not replace global Open-Meteo, and do not silently merge unlike model/provider categories.

### Key-required / non-default candidates

- [NASA FIRMS API](https://firms.modaps.eosdis.nasa.gov/api/)
- [NASA FIRMS MAP_KEY setup](https://firms.modaps.eosdis.nasa.gov/api/map_key/)
- [OpenAQ API documentation](https://docs.openaq.org/)
- [OpenAQ API key documentation](https://docs.openaq.org/using-the-api/api-key)

NASA FIRMS requires a MAP_KEY. OpenAQ v3 requires an API key. Keep both out of the default keyless production provider set unless AirAware's key policy explicitly changes.

### Thermal science / UTCI

- [UTCI official calculator](https://utci.org/utci_calc.php)
- [UTCI scientific documents / COST Action 730](https://utci.org/cost/documents.html)

### Billing

- [RevenueCat React Native SDK](https://www.revenuecat.com/docs/getting-started/installation/reactnative)
- [RevenueCat SDK configuration](https://www.revenuecat.com/docs/getting-started/configuring-sdk)
- [RevenueCat SDK reference](https://www.revenuecat.com/docs/platform-resources/sdk-reference)

For future warning, wastewater, dengue, radiological, bathing-water, pollen, or measured-spore providers, add the exact official API documentation here only after the provider is verified as public, anonymous or explicitly key-classified, stable, documented, and machine-readable.

## Expo / React Native

Project uses Expo SDK 57. For Expo, React Native/native integration, permissions, builds, config, or Expo modules, verify against the exact SDK 57 docs:

Do not rely on older-version memory. Before adding dependencies, check existing dependencies and Expo/React Native capabilities first; prefer Expo-supported solutions.

## External providers

Never invent API fields, units, capabilities, schemas, limits, or semantics. Verify provider documentation before changing an integration.

### Open-Meteo

Verify endpoint, parameter, unit, temporal resolution, geographic coverage, missing-value behavior, and forecast availability. Variables may differ between Open-Meteo APIs.

### OpenStreetMap

OSM is community-generated and incomplete. Absence of mapped data is not evidence of real-world absence. Keep OSM-derived claims conservative.

### RevenueCat

Do not implement from memory. Purchase entitlement must not rely on UI state. Preserve current entitlement behavior unless explicitly changed.

### Public-health / radiological providers

Providers must be public, anonymous, keyless, stable, and machine-readable.

Never scrape HTML/dashboard pages, use undocumented/private dashboard endpoints, reverse-engineer map XHR calls, add provider credentials, or introduce a backend to hide credentials.

Preserve true reporting geography and period; regional/country surveillance must not appear GPS-local.

Radiological measurements represent ambient radiation only. Never infer incident/source/cause/safety/personal dose.

If no suitable stable anonymous interface exists, keep the abstraction ready and represent the provider as unavailable rather than shipping a brittle integration.

## Scientific calculations and data semantics

Never invent environmental, medical, meteorological, pollution, pollen, allergy, or health formulas.

For a calculation:

1. Reuse an existing implementation if possible.
2. Preserve the current formula unless the task changes it.
3. New formulas should use authoritative/scientific sources where practical.
4. Record material scientific provenance in code.
5. Keep calculations deterministic and testable.

Do not imply diagnosis or individual symptoms.

Do not create cross-domain pseudo-scores combining environmental, biological, population-health, and radiological signals without a scientifically justified future requirement.

**Missing/stale/unavailable data is not zero, Low, Normal, Safe, or absent.**

When providers disagree, compare semantics, units, time, spatial/temporal resolution, freshness, quality/confidence, and missing-data behavior. Prefer Open-Meteo only when relevance/confidence are otherwise equivalent. Avoid false precision; expose meaningful uncertainty rather than guessing.

## Privacy

Prefer local processing/storage. Do not add analytics, telemetry, tracking, ad IDs, unnecessary remote storage, or unnecessary data transmission.

Transmit only what a provider requires.

Unless explicitly approved by a future task, never send providers:

- saved-location names/IDs
- Personal Allergy Profile selections
- Activity settings
- notification fingerprints
- purchase/RevenueCat state
- language preference
- personal health information

Never send allergy-profile information to environmental providers by default.

## Localization

Translations are bundled locally. Internal identifiers, enums, cache/storage keys, notification fingerprints, provider mappings, and tests remain canonical/language-neutral (e.g. `low`, `very-high`, `pollen`, `covid-19`, `ambient-dose-rate`).

Translate only at presentation boundaries through existing i18n.

Do not use translated strings as identifiers, fetch translations remotely, add translation services, concatenate translated fragments where parameterized keys are appropriate, or invalidate provider caches on language changes.

When touched, localize user-visible strings, notifications, summaries, widgets, errors, empty states, and accessibility labels.

## Brand and icons

**PRESERVE — AIRAWARE BRAND ASSET**

The AirAware gas mask is brand identity. Never replace, redraw, recolor, restyle, simplify, or migrate it to another icon library.

Icon roles:

- gas mask: brand only
- Meteocons: environmental/weather semantics
- Lucide: Activities, navigation, actions, generic UI, and suitable non-environmental health-domain identity

Do not misuse weather icons for generic actions or the gas mask for health/infection/radiation/Pro/navigation concepts.

## UI consistency

Do not invent a new design.

Before UI work:

1. inspect the target screen
2. find the closest existing AirAware screen/interaction
3. inspect shared components
4. inspect theme/design tokens
5. reuse those patterns

Reuse existing components, tokens, typography, spacing, radii, cards, rows, controls, icons, dialogs, section layouts, loading/empty/error states, and navigation.

Avoid arbitrary visual constants, duplicated styles, new patterns where an equivalent exists, unrelated redesign, or unnecessary component variants.

Put genuinely reusable visual primitives in `components/ui/`; do not create shared components just to remove a few simple screen-local lines.

Preserve navigation and information hierarchy unless requested otherwise.

For substantial UI additions, use the closest existing screen as the canonical visual reference. If existing screens differ, prefer the newer shared-component/theme-based pattern.

Before finishing UI work, inspect the diff for duplicated styles, arbitrary constants, inconsistent spacing/typography/controls/alignment/cards, unnecessary variants, and unrelated UI changes.

## TypeScript

Maintain strict typing.

Avoid `any`, unnecessary assertions, TypeScript suppression, `@ts-ignore`, and duplicate types. Derive from existing domain/API models where possible.

Treat external API responses as untrusted; handle optional/missing data explicitly.

## Errors and partial data

External data is unreliable. Gracefully handle network failures, timeouts, malformed responses, missing fields/measurements, partial responses, and stale caches.

Prefer partial useful results over failing the whole report. Never convert missing measurements to zero unless zero is semantically correct.

## Dependencies

Add dependencies only for substantial value.

Before adding one, check:

1. existing project functionality
2. Expo / React Native support
3. whether a small local implementation is simpler
4. Android/Expo compatibility
5. maintenance/bundle impact

Do not add dependencies for trivial convenience.

## Testing

Behavior changes require corresponding tests. Cover calculations, provider parsing, normalization, fallback behavior, persistence, and regressions as applicable.

Tests must be deterministic. Do not weaken/remove tests to make changes pass. Add regression tests for bug fixes when practical.

## Comments

Prefer self-explanatory code. Comments explain **why**, not what is obvious from the code.

## Definition of done

Before finishing:

1. review the complete diff
2. remove accidental/unrelated changes
3. remove unnecessary abstractions/dependencies
4. check for duplicated functionality
5. perform the UI consistency review for UI work
6. run the repo type-check command
7. run relevant tests
8. run the full suite when practical
9. run existing lint/format checks where applicable
10. confirm unrelated formatting did not change

Never claim a check passed unless it actually ran successfully. If something could not be run or verified, say so.

## Final response

Keep it concise. Report:

- what changed
- important implementation decisions
- checks/tests executed
- anything not verified

Do not create a separate summary/documentation file for the work.

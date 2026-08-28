# AirAware — Agent Development Instructions

AirAware is an Android application that helps users understand health-relevant external conditions around them.

The application currently combines:

- environmental data such as pollen, air pollution, weather, vegetation, UV, mold potential, Saharan dust, wildfire-related particulate pollution, and related environmental events
- biological/public-health signals such as respiratory surveillance and excess mortality where supported
- radiological context from public ambient-radiation monitoring where supported

AirAware must remain conservative about health-related interpretation. It does not diagnose disease, estimate individual infection probability, calculate personal mortality risk, infer nuclear incidents, or calculate personal cumulative radiation dose.

The application is:

- privacy-first
- deterministic
- lightweight
- offline-first where practical
- designed for worldwide use
- conservative about environmental and health-related claims

## Core engineering principles

Prefer:

- simple code over clever code
- existing patterns over new abstractions
- explicit behavior over implicit behavior
- deterministic calculations over heuristics
- small focused changes over broad refactors
- platform capabilities over additional dependencies
- reusable application primitives over feature-specific implementations

Avoid:

- unnecessary abstractions
- unnecessary dependencies
- speculative features
- premature generalization
- unrelated refactoring
- large formatting-only diffs
- duplicating existing functionality

Before implementing a change, inspect the relevant existing code and understand the current architecture and conventions.

Do not assume how the application works from the task description alone.

---

# Local toolchain

Use the repository Node version before running Node/npm commands.

Prefer:

```sh
nvm use
```

or the explicit version from `.nvmrc` when needed.

Do not update the Node version, npm lockfile format, Expo SDK, or native build tooling unless the task explicitly requires it.

---

# Scope discipline

Implement the requested change with the smallest reasonable diff.

Do not:

- redesign unrelated UI
- rename unrelated files, functions, types, or variables
- reorganize directories without a concrete need
- refactor working code merely because another implementation appears cleaner
- change public/internal contracts unrelated to the task
- introduce a new architectural pattern when an existing pattern is sufficient
- create documentation unless explicitly requested

If a broader refactor appears necessary, first determine whether the requested feature can reasonably be implemented without it.

Preserve externally observable behavior unless the task explicitly changes it.

Backward compatibility is important for persisted user data, settings, caches, purchases, and externally visible behavior. Do not preserve obsolete internal abstractions solely for compatibility when they can safely be migrated.

---

# Expo / React Native

## Expo SDK 57

Expo APIs change between SDK releases.

When modifying code involving Expo, React Native integration, native configuration, permissions, builds, or Expo modules, verify the behavior against the exact Expo SDK 57 documentation:

https://docs.expo.dev/versions/v57.0.0/

Do not rely on memory of older Expo SDK versions.

Do not use an API, option, configuration property, or behavior unless it exists in the version used by this project.

Before adding a dependency, check whether the required functionality already exists in Expo, React Native, or the project dependencies.

Prefer Expo-supported solutions when appropriate.

---

# External data sources

Never invent API fields, units, capabilities, response structures, limits, or semantics.

When changing provider integration, verify the relevant provider documentation before implementation.

## Open-Meteo

Primary environmental/weather provider:

https://open-meteo.com/en/docs

Verify:

- endpoint
- parameter name
- units
- temporal resolution
- geographical availability
- missing-value behavior
- forecast availability

Do not assume that a variable available from one Open-Meteo API is available from another.

## OpenStreetMap

Relevant references:

https://taginfo.openstreetmap.org/taginfo/apidoc

https://wiki.openstreetmap.org/wiki/Map_features

OSM data is community-generated and may be incomplete or inconsistent.

Do not interpret absence of an OSM feature as evidence that the real-world feature does not exist.

Keep OSM-derived environmental information probabilistic/conservative.

## RevenueCat

Relevant API documentation:

https://www.revenuecat.com/docs/api-v2

Do not implement RevenueCat behavior from memory.

Purchase entitlement must never depend solely on UI state.

Preserve existing entitlement behavior unless the task explicitly changes it.

## Public health and radiological providers

Biological, population-health, and radiological providers must be public, anonymous, keyless, and machine-readable.

Do not:

- scrape dashboards or HTML
- use undocumented/private dashboard endpoints
- reverse-engineer map XHR calls and hardcode them
- add provider API keys or credentials
- introduce a backend to hide credentials

For public-health surveillance, preserve true reporting geography and period. Country-level or regional surveillance must not be presented as GPS-local data.

For radiological data, distinguish measured ambient radiation from incidents. Do not infer a nuclear incident, source, cause, safety guarantee, or personal dose from monitor readings.

If a provider has no suitable stable anonymous interface, keep the abstraction ready and document/handle the provider as unavailable rather than shipping a brittle integration.

---

# Health and environmental calculations

Never invent environmental, medical, meteorological, pollution, pollen, or allergy formulas.

When implementing or changing a calculation:

1. Look for an existing implementation first.
2. Preserve the existing formula unless the task requires changing it.
3. If a new formula is required, base it on an authoritative or scientific source where practical.
4. Document the source in code when it materially affects the algorithm.
5. Keep calculations deterministic and testable.

Do not imply medical diagnosis or predict individual symptoms.

AirAware reports external conditions and domain-specific interpretations. Do not create cross-domain pseudo-scores that combine environmental, biological, population-health, and radiological signals unless a future task provides a scientifically justified model.

Missing data is not low/normal data. Do not silently convert unavailable measurements, provider gaps, or stale observations into reassuring categories.

---

# Multiple data providers

When providers disagree, do not silently select whichever value appears preferable.

Consider:

1. measurement semantics
2. units
3. observation/forecast time
4. spatial resolution
5. temporal resolution
6. data freshness
7. provider confidence or quality information
8. missing-data behavior

When confidence and relevance are equivalent, prefer Open-Meteo to reduce provider complexity.

Otherwise prefer the source that is demonstrably more appropriate for the specific measurement.

Do not create false precision.

Expose uncertainty where it materially affects the user rather than guessing.

---

# Privacy

Treat location, environmental preferences, allergy-profile selections, and purchase state according to the application's existing privacy model.

Prefer local processing and local persistence.

Do not introduce:

- analytics
- telemetry
- tracking
- advertising identifiers
- unnecessary remote storage
- unnecessary transmission of user data

Do not send Personal Allergy Profile information to environmental providers unless explicitly required by a future feature and explicitly approved.

Only transmit the minimum data required by an external service.

Do not send saved-location names, location IDs, Personal Allergy Profile selections, Activity settings, notification fingerprints, purchase state, language preference, or personal health information to environmental, public-health, radiological, or map providers unless a future task explicitly requires and approves it.

---

# Localization

AirAware uses local bundled translations.

Keep internal identifiers language-neutral. Domain values, storage keys, cache keys, notification fingerprints, provider mappings, and tests should use canonical identifiers such as:

- `low`, `moderate`, `high`, `very-high`
- `pollen`, `pollution`, `saharan-dust`, `wildfire-pollution`, `uv`, `mold`
- `influenza`, `covid-19`, `rsv`
- `ambient-dose-rate`

Translate only at presentation boundaries using the existing i18n infrastructure.

Do not:

- use translated strings as identifiers
- fetch translations at runtime
- add remote translation services
- concatenate translated fragments when a parameterized translation key is needed
- invalidate provider caches because the language changed

User-visible strings, notifications, summaries, widgets, errors, empty states, and accessibility labels should be localized when touched.

---

# Visual identity and icons

Preserve the AirAware gas-mask artwork as the application brand identity.

Classify it as:

```text
PRESERVE — AIRAWARE BRAND ASSET
```

Do not replace, redraw, recolor, restyle, simplify, or convert the gas mask to another icon library.

Use icon roles consistently:

- AirAware gas mask: brand identity only
- Meteocons: environmental/weather semantics
- Lucide: Activities, navigation, actions, generic UI, and non-environmental health-domain identity where appropriate

Do not use weather icons for generic actions, and do not use the gas mask as a health, infection, radiation, Pro, or navigation substitute unless it is explicitly a brand surface.

---

# UI consistency

The application already has an established visual language.

**Do not invent a new design.**

Before modifying UI:

1. Inspect the existing screen.
2. Identify the most similar existing screen or interaction.
3. Inspect relevant shared UI components.
4. Inspect existing theme/design tokens.
5. Reuse those patterns.

Prefer consistency with AirAware over generic React Native or personal design preferences.

## UI rules

Reuse existing:

- components
- colors
- typography
- spacing
- radii
- cards
- rows
- buttons
- icons
- dialogs
- section layouts
- loading states
- empty states
- error states
- navigation patterns

Do not introduce a new visual pattern when an equivalent pattern already exists.

Do not redesign unrelated portions of a screen while implementing a feature.

Do not use arbitrary colors, font sizes, spacing, border radii, or other visual constants when an appropriate theme token exists.

Do not duplicate the styling of an existing component inside a screen.

Prefer extending an existing shared component when the new behavior is conceptually part of that component.

New reusable visual primitives belong in:

`components/ui/`

Do not create a shared component solely to avoid a few lines of straightforward screen-specific layout.

Preserve navigation structure and information hierarchy unless explicitly requested otherwise.

## Visual reference rule

When implementing a new screen or substantial UI section:

1. Find the closest existing AirAware screen.
2. Treat it as the canonical visual reference.
3. Follow its spacing, hierarchy, typography, component usage, and interaction conventions.

If two existing screens use different patterns, prefer the newer shared-component/theme-based implementation rather than creating a third variation.

## UI change review

Before finishing a UI change, inspect the diff specifically for visual divergence.

Check for:

- duplicated styles
- new arbitrary constants
- inconsistent spacing
- inconsistent typography
- inconsistent controls
- unnecessary component variants
- changed alignment
- inconsistent card/section structure
- accidental changes to unrelated UI

Fix divergence before considering the task complete.

---

# TypeScript

Maintain strict type safety.

Avoid:

- `any`
- unnecessary type assertions
- suppressing TypeScript errors
- `@ts-ignore`
- duplicating types already defined elsewhere

Prefer deriving types from existing domain models and API interfaces.

External API responses must be treated as untrusted input.

Handle missing or optional provider data explicitly.

---

# Error handling

External environmental data is inherently unreliable.

Handle gracefully:

- network failures
- timeouts
- malformed responses
- missing fields
- unavailable measurements
- partial provider responses
- stale cached data

Prefer partial useful results over failing the entire environmental report when individual measurements are unavailable.

Do not silently convert missing measurements to zero unless zero is semantically correct.

---

# Dependencies

Avoid adding dependencies unless they provide substantial value.

Before adding one:

1. Check whether the project already contains equivalent functionality.
2. Check whether Expo or React Native provides it.
3. Consider whether a small implementation is simpler.
4. Consider Android/Expo compatibility.
5. Consider maintenance and bundle impact.

Do not add a dependency merely to simplify a trivial implementation.

---

# Testing

Behavior changes require corresponding test changes.

Add or update tests for:

- environmental calculations
- provider parsing
- fallback behavior
- data normalization
- persistence behavior
- regressions introduced by the change

Tests should be deterministic.

Do not weaken or remove tests simply to make a change pass.

When fixing a bug, add a regression test when practical.

---

# Comments and documentation

Prefer self-explanatory code.

Comments should explain **why**, not restate what the code does.

Do not create new documentation files unless explicitly requested.

Update existing documentation only when the requested change makes it materially incorrect and documentation changes are within scope.

---

# Definition of done

Before finishing a task:

1. Review the complete diff.
2. Remove accidental or unrelated changes.
3. Check for unnecessary abstractions or dependencies.
4. Check for duplicated functionality.
5. For UI work, perform the UI consistency review above.
6. Run the repository's TypeScript/type-check command.
7. Run relevant tests.
8. Run the full test suite when practical.
9. Run the repository's existing lint/format checks when applicable.
10. Confirm that formatting outside the intended changes has not changed.

Do not claim that a check passed unless it was actually executed successfully.

If a check cannot be run, state that explicitly in the final response.

---

# Final response

Keep the final response concise.

Report:

- what changed
- important implementation decisions
- tests/checks executed
- anything that could not be verified

Do not create a separate summary/documentation file for the work.

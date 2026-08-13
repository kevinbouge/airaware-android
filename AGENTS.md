# AirAware — Agent Development Instructions

AirAware is an Android application that estimates environmental allergy burden using environmental data such as pollen, air pollution, weather, vegetation, mold potential, and related environmental conditions.

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

---

# Environmental calculations

Never invent environmental, medical, meteorological, pollution, pollen, or allergy formulas.

When implementing or changing a calculation:

1. Look for an existing implementation first.
2. Preserve the existing formula unless the task requires changing it.
3. If a new formula is required, base it on an authoritative or scientific source where practical.
4. Document the source in code when it materially affects the algorithm.
5. Keep calculations deterministic and testable.

Do not imply medical diagnosis or predict individual symptoms.

AirAware reports environmental conditions and estimated environmental burden.

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

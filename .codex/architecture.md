# Architecture

This document describes the architecture of AirAware and the engineering
principles that guide its implementation.

The goal is to keep the application deterministic, maintainable, privacy-first,
and independent of any particular environmental data provider.

---

# High-Level Architecture

```
                         ┌────────────────────┐
                         │   Open-Meteo APIs  │
                         └─────────┬──────────┘
                                   │
                         ┌─────────▼──────────┐
                         │ OpenStreetMap APIs │
                         └─────────┬──────────┘
                                   │
                         Provider Adapters
                                   │
                                   ▼
                    Response Validation & Normalization
                                   │
                                   ▼
                     Provider-independent Domain Models
                                   │
                                   ▼
                     Environment Assembly Service
                                   │
          ┌──────────────┬──────────────┬───────────────┐
          ▼              ▼              ▼
     Environmental   Personalized   Forecast Logic
        Scoring          Risk
          │              │
          └──────┬───────┘
                 ▼
          Zustand Application State
                 │
     ┌───────────┼─────────────┬──────────────┐
     ▼           ▼             ▼              ▼
   Screens   Notifications   Widgets   Daily Summary
```

---

# Design Goals

AirAware is designed around the following principles.

- Provider-independent
- Privacy-first
- Offline-friendly
- Deterministic
- Worldwide support
- Functional architecture
- Small isolated modules
- Testable business logic

Every feature should respect these goals.

---

# Layered Architecture

## User Interface

The UI layer is responsible only for presentation.

Responsibilities:

- rendering screens
- displaying environmental data
- collecting user input
- navigation
- settings

The UI must never:

- calculate scores
- parse provider JSON
- perform unit conversions
- implement business rules
- access provider-specific fields

Business logic belongs elsewhere.

---

## State Layer

Application state is managed using Zustand.

Responsibilities:

- application state
- refresh orchestration
- loading state
- provider state
- selected location
- user settings
- capability state

The store coordinates the application but should contain very little business
logic.

---

## Services

Services coordinate multiple modules.

Examples:

- location
- notifications
- widgets
- billing
- environment assembly

Services may orchestrate work but should avoid implementing environmental
calculations directly.

---

## Provider Layer

Every external API is isolated behind its own provider.

Current providers include:

- Open-Meteo
- OpenStreetMap

Providers are responsible for:

- requesting remote data
- validating responses
- normalizing units
- converting external JSON into AirAware models

Providers must never:

- calculate scores
- update UI
- know about screens
- know about React
- know about widgets

---

## Core Logic

The core layer contains deterministic environmental calculations.

Examples:

- Environmental Burden Score
- Personalized Risk
- Mold Potential
- Forecast calculations
- Outdoor Window
- Daily Summary

Core modules should consist primarily of pure functions.

They should not depend on React, Zustand, or network code.

---

## Storage

Persistent data is stored locally using AsyncStorage.

Examples:

- settings
- cache
- personalization
- widget snapshot
- notification state

No user account exists.

All personal information remains on the device.

---

# Data Flow

Environmental refresh follows this sequence.

```
Location
    ↓
Provider Requests
    ↓
Validation
    ↓
Normalization
    ↓
Cache Update
    ↓
Environment Assembly
    ↓
Score Calculations
    ↓
Application State
    ↓
UI / Widgets / Notifications
```

Each stage has a single responsibility.

---

# Provider Isolation

AirAware is provider-agnostic.

No application code outside the provider layer should depend on:

- API URLs
- provider JSON
- provider field names
- provider units

If a provider changes, only its adapter should require modification.

---

# Domain Models

The application works exclusively with normalized domain models.

Internal models should never expose raw provider responses.

Every provider converts its response into the same internal representation before
any calculations occur.

---

# Scoring Pipeline

Environmental calculations always use normalized data.

```
Normalized Environment
        │
        ├── Environmental Burden
        │
        ├── Personalized Risk
        │
        ├── Mold Potential
        │
        └── Outdoor Window
```

Each calculator is independent.

Calculators should not call each other unless explicitly required.

---

# Cache Strategy

Provider caches are independent.

A failure in one provider should not invalidate successful responses from
another provider.

Whenever possible:

- reuse valid cached data
- refresh only expired providers
- preserve partial results

Missing data should be omitted rather than treated as zero.

---

# Capabilities

AirAware uses capability-driven development.

Features depend on capabilities rather than product editions.

Examples:

- forecast horizon
- environmental variables
- widgets
- notifications
- billing features

Business logic should query capabilities instead of checking whether a user is
Free or Pro.

This keeps future editions localized to configuration.

---

# Billing Isolation

RevenueCat is isolated behind a billing gateway.

The rest of the application should never:

- parse RevenueCat objects
- inspect purchases
- interpret entitlements

The billing gateway exposes only application-level capability information.

---

# Widget Architecture

Widgets never fetch environmental data.

Instead:

```
Provider Refresh
      ↓
Environment Assembly
      ↓
Score Calculation
      ↓
Widget Snapshot
      ↓
Android Widget
```

Widgets display cached snapshots prepared by the application.

This guarantees consistent presentation between the application and the widget.

---

# Notification Architecture

Notifications are generated from calculated environmental data.

Notifications never:

- fetch providers
- calculate scores
- duplicate business logic

They consume already calculated application state.

---

# Error Handling

Failures should degrade gracefully.

Preferred order:

1. Use fresh provider data.
2. Use valid cached data.
3. Hide unavailable variables.
4. Continue calculations with remaining data.

Never:

- invent values
- silently substitute zero
- fabricate environmental readings

---

# Dependency Rules

Dependencies should always point downward.

```
UI
 ↓

State
 ↓

Services
 ↓

Core
 ↓

Providers
```

Core modules must never depend on:

- React
- Zustand
- AsyncStorage
- RevenueCat
- Android APIs

Providers must never depend on UI components.

---

# Testing Philosophy

Business logic should be deterministic.

Priority for testing:

- calculators
- normalization
- provider adapters
- personalization
- forecast logic

UI tests should focus on rendering rather than environmental calculations.

---

# Privacy

Privacy is a fundamental architectural principle.

AirAware:

- has no accounts
- has no analytics
- has no telemetry
- has no cloud synchronization

Personal Allergy Profile data remains local to the device.

Only the minimum information required to retrieve environmental data is sent to
providers.

---

# Future Extensions

The architecture is designed so additional providers can be added without
modifying existing business logic.

Future providers may include:

- Copernicus CAMS
- NASA FIRMS
- OpenAQ
- ECMWF

Each new provider should implement its own adapter while exposing the same
normalized domain models used throughout the application.

---

# Project Structure

```
src/
├── api/             Provider adapters
├── capabilities/    Feature capabilities
├── components/      Reusable UI
├── core/            Environmental calculations
├── models/          Domain models
├── navigation/      Navigation
├── screens/         Application screens
├── services/        Orchestration services
├── state/           Zustand store
├── storage/         Local persistence
├── theme/           Styling
└── utils/           Shared utilities

tests/
plugins/
```

Every directory should have a single clear responsibility.

Business logic belongs in `core`, provider code belongs in `api`, and UI code
belongs in `screens` or `components`.

# Expo HAS CHANGED

Read the exact versioned docs at https://docs.expo.dev/versions/v57.0.0/ before writing any code.

# Data sources

Also check the latest open meteo API: https://open-meteo.com/en/docs
And the latest openstreetmap API: https://taginfo.openstreetmap.org/taginfo/apidoc and https://wiki.openstreetmap.org/wiki/Map_features

# AirAware Development Instructions

AirAware is an Android application that estimates environmental allergy burden.

Goals:

- deterministic code
- no unnecessary abstractions
- minimal dependencies
- offline-first whenever possible
- privacy-first
- worldwide support

Always:

- preserve backwards compatibility unless requested
- keep commits focused
- avoid creating documentation unless explicitly asked
- never invent environmental formulas
- use scientific references where applicable
- update tests when behaviour changes
- avoid UI regressions

When multiple data providers disagree:

- prefer Open-Meteo when confidence is equivalent
- otherwise choose the provider with higher spatial resolution
- expose uncertainty instead of guessing

Before finishing:

- run TypeScript checks
- run tests
- ensure formatting is unchanged

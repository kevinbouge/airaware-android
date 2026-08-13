# Data Sources

This document describes every external data provider used by AirAware.

## Design Principles

AirAware is provider-agnostic.

The rest of the application should never depend directly on a specific API.
Every provider is isolated behind its own adapter that converts external data
into AirAware domain models.

Goals:

- worldwide coverage
- no vendor lock-in
- deterministic scoring
- graceful degradation
- provider independence
- privacy-first

---

# Current Providers

## Open-Meteo

Status:
Production

Purpose:

- Weather forecast
- Air quality
- Pollen
- UV
- Atmospheric variables

Documentation:

https://open-meteo.com/

API key:

No

Coverage:

Worldwide

Refresh frequency:

Typically hourly depending on the model.

Provides:

### Weather

- temperature
- humidity
- precipitation
- dew point
- pressure
- cloud cover
- visibility
- wind speed
- wind gusts
- sunshine duration
- CAPE
- wet bulb temperature

### Air Quality

- PM2.5
- PM10
- NO₂
- O₃
- SO₂
- CO
- Dust
- Aerosol Optical Depth
- CO₂ (where available)
- NH₃
- CH₄
- NMVOC
- Formaldehyde
- Nitrogen Monoxide

### Pollen

- Alder
- Birch
- Grass
- Mugwort
- Olive
- Ragweed

Used by:

- Environmental Burden Score
- Personalized Risk
- Mold Potential
- Forecast
- Outdoor Window
- Notifications
- Widgets
- Daily Summary

Notes

- Primary provider.
- Highest priority.
- Missing variables must be ignored rather than replaced with zero.

---

## OpenStreetMap

Status:

Production

Purpose:

Nearby environmental context.

Documentation:

https://www.openstreetmap.org/

Services used:

- Map tiles
- Overpass API

Provides:

- woodland
- meadow
- grassland
- scrub
- farmland
- orchard
- park
- mapped tree taxonomy
- land-use

Used by:

- Nearby Vegetation section

Not used by:

- Environmental score
- Personalized score
- Notifications

Reason:

OpenStreetMap describes mapped vegetation, not actual pollen production.

---

# Planned Providers

## Copernicus CAMS

Status:

Planned

Purpose:

Improve atmospheric accuracy.

Potential variables:

- wildfire smoke
- Saharan dust
- aerosol forecasts
- pollen forecasts
- atmospheric composition

Possible usage:

- Advanced notifications
- Forecast confidence
- Dust events
- Smoke events

Priority:

High

---

## NASA FIRMS

Status:

Planned

Purpose:

Wildfire detection.

Variables:

- active fires
- thermal anomalies

Possible usage:

- Smoke alerts
- Air quality explanation

Priority:

Medium

---

## OpenAQ

Status:

Under evaluation

Purpose:

Ground sensor validation.

Possible usage:

- Compare model output
- Confidence indicator

Priority:

Medium

---

## ECMWF

Status:

Future

Purpose:

High quality numerical weather models.

Potential usage:

- Forecast refinement
- Confidence scoring

Priority:

Low

---

# Provider Integration Rules

Every provider must expose:

- fetch()
- normalize()
- metadata()

Providers must never:

- calculate scores
- contain UI logic
- modify settings
- cache globally

Providers return only normalized AirAware models.

---

# Conflict Resolution

When multiple providers disagree:

1. Prefer measured data over modeled data.
2. Prefer higher spatial resolution.
3. Prefer newer timestamps.
4. Prefer official government/scientific providers.
5. Never average incompatible measurements.
6. If confidence is unknown, keep the primary provider.

Never silently merge incompatible datasets.

---

# Missing Data

Missing data must never produce incorrect scores.

Rules:

- omit missing variables
- renormalize score weights
- never treat missing as zero
- never invent values
- never extrapolate medical data

---

# Units

Internal units are fixed.

Temperature:
°C

Wind:
km/h

Pressure:
hPa

Rain:
mm

Visibility:
m

Pollen:
grains/m³ (provider units)

PM2.5:
µg/m³

PM10:
µg/m³

NO₂:
µg/m³

O₃:
µg/m³

CO:
mg/m³

UV:
Index

---

# Privacy

Only the minimum required information is sent to providers.

Open-Meteo:

- latitude
- longitude

OpenStreetMap:

- latitude
- longitude
- map viewport (tile requests)

AirAware never uploads:

- Personal Allergy Profile
- calculated scores
- notifications
- widgets
- user behaviour
- analytics
- medical information

---

# Future Evaluation Checklist

Before introducing a new provider, evaluate:

- Worldwide availability
- Free tier
- Commercial usage
- License compatibility
- API stability
- Rate limits
- Historical availability
- Latency
- Data freshness
- Scientific credibility
- Long-term maintenance risk

A provider should not be added solely because it exposes additional variables.
It must improve AirAware's environmental accuracy, reliability, or user value.

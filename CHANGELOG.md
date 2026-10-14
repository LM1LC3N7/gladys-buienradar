# Changelog

All notable changes to this integration are documented in this file. The format
follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project
uses [semantic versioning](https://semver.org/).

Describe each change under `## [Unreleased]` as you make it. The Release
workflow moves that section under the version it ships, and the section becomes
the notes of the version's GitHub Release.

## [Unreleased]

## [0.1.1] - 2026-10-14

### Added

- Buienradar weather provider for the Netherlands and Belgium: the current
  weather of the nearest Buienradar station (temperature, feels-like,
  humidity, pressure, wind and gusts, visibility, dew point, sunrise and
  sunset; a missing sensor is taken from the next station), the 5-day
  forecast, in metric or US units, with Buienradar's icons mapped to the
  conditions of Gladys. Outside the coverage, a clear error lets Gladys
  fall back to its next provider.
- The Buienradar rain radar maps of the Netherlands and Belgium as images
  of the weather widget (option).
- A rain watcher per located house (the 2-hour Buienradar rain forecast,
  every 5 minutes) with the scene triggers "rain expected" (within 5
  minutes to 2 hours, any, moderate or heavy rain, once per rain episode)
  and "rain stopped" (after 15 dry minutes).
- Scene action "rain in the next 2 hours": dry, raining, minutes until the
  rain or the end of it, peak, total and a summary in English, French or
  Dutch.
- Dashboard widget "Rain next 2 hours": next rain, peak, total and the
  5-minute bars, credited "Data: Buienradar.nl".
- "Test Buienradar" button: the station and the rain forecast of each house.

[Unreleased]: https://github.com/LM1LC3N7/gladys-buienradar/compare/v0.1.1...HEAD
[0.1.1]: https://github.com/LM1LC3N7/gladys-buienradar/releases/tag/v0.1.1

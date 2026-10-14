# CLAUDE.md

Project rules for coding assistants (Claude Code reads this file) and for
human contributors.

## What this is

A Gladys Assistant **external integration** of type `weather`: a Node.js
service (Node 22+, ESM, no build step) in its own sandboxed Docker
container, talking to Gladys through `@gladysassistant/integration-sdk`
(v0.15). It answers `onWeatherGet` with the pivot weather format from the
public **Buienradar** feed (the nearest station for the current weather,
the five-day forecast), serves the Buienradar radar maps as provider
images, and watches the 2-hour rain forecast of the located houses for two
scene triggers, a scene action and a dashboard widget. No key, no account.
Unofficial: not affiliated with Buienradar. Same family as `gladys-dwd`
(weather type, same author).

A weather integration has **no device screen**: the rain lives in the
triggers, the scene action and the widget.

## Commands

```bash
npm install
npm test                                  # node --test, the built-in runner
npm run lint                              # ESLint
npm run format:check                      # Prettier, as the CI runs it
npm run format                            # Prettier, fix in place
npm run audit                             # npm audit --omit=dev
npx github:GladysAssistant/integration-store .   # store admission checks
```

Run `format:check`, `lint`, `test` and `audit` before every commit.

## Architecture

```
index.js            SDK wiring only (handlers registered before connect())
src/app.js          BuienradarApp: feed cache, weather, radar maps, houses,
                    rain watchers, scene action, widget, test button, status
src/buienradar.js   the client: feed, raintext, radar maps
src/model.js        feed -> stations / current / days, raintext -> slots,
                    outlook, Amsterdam local times (pure)
src/conditions.js   icon letters and Dutch descriptions -> pivot conditions (pure)
src/pivot.js        current + days -> pivot weather, metric or us (pure)
src/triggers.js     two rain readings -> scene events, summaries (pure)
src/widget.js       the "rain_forecast" widget (pure)
src/config.js       config_schema normalized
src/constants.js    endpoints, pacing, coverage, thresholds, manifest keys
src/i18n.js         runtime texts (en/fr), scene summaries (en/fr/nl)
src/http.js         the only network access (fetch, timeout, User-Agent)
test/fixtures/      the real feed and a dry raintext (2026-10-14), a shaped
                    shower raintext, a tiny PNG
test/helpers/       fake fetch (+ a raintext builder), fake timers; Gladys is
                    the SDK's fake
```

## What is known of the Buienradar data

- **Feed** (`data.buienradar.nl/2.0/feed/json`, ~33 KB, refreshed every 10
  minutes): `actual.stationmeasurements[]` (39 stations, all in the
  Netherlands; some have no thermometer, a third no barometer),
  `actual.sunrise/sunset`, `forecast.fivedayforecast[]`,
  `forecast.weatherreport`. Units: °C, m/s, hPa, metres, mm.
- **Times are local** (Europe/Amsterdam) everywhere: the station
  `timestamp` even carries a false "Z" ("02:40Z" read at 00:56 UTC).
  `stationTime` keeps a UTC reading only when it is not in the future.
- **Icons**: one letter a to w (python-buienradar / Home Assistant
  mapping), doubled at night (`bb.png`); descriptions are Dutch only. An
  undocumented letter falls back on the Dutch words (`src/conditions.js`).
- **Five days**: `mintemperatureMax` / `maxtemperatureMax` (falling back on
  the other bounds), `rainChance`, `mmRainMin/Max` (0 even with 80 % rain
  chance on 2026-10-14), `wind` a Beaufort force sent as 0 for every day:
  0 is read as unknown.
- **Raintext** (`gpsgadget.buienradar.nl/data/raintext?lat=&lon=`): 24
  lines `NNN|HH:MM`, 5 minutes apart, the first being the current slot,
  local times without date; mm/h = 10^((NNN-109)/32), 0 is dry. Outside
  the Netherlands and Belgium: 404 "location must be inside the
  Netherlands or Belgium".
- **Radar maps** (`image.buienradar.nl/2.0/image/single/RadarMapRain{NL,BE}`):
  a 302 to a ~110 KB 500×512 PNG on the CDN. The old
  `api.buienradar.nl/image/1.0/RadarMapNL` is an animated GIF: not usable.
- **Terms**: free use with attribution (buienradar.nl with a link), non
  commercial; "Data: Buienradar.nl" on every surface showing the data.

## Rules

- **Unofficial.** Every user-facing surface says "unofficial connector, not
  affiliated with Buienradar". Never use the Buienradar logo (the radar maps
  are requested with `renderBranding=False`).
- **Keys are forever**: the manifest keys (`src/constants.js`), the
  intensity keys (`light`, `moderate`, `heavy`), the threshold values and
  the image keys (`radar-nl`, `radar-be`) are stored in user scenes and
  dashboards. Never rename them.
- **Be polite with Buienradar**: the feed at most once per 10 minutes
  (`FEED_TTL`, only on a weather request), the raintext once per location
  and per 5 minutes (`RAIN_TTL`, shared by the watcher, the widget and the
  scene action), a radar map at most every 5 minutes, nothing for a house
  outside `BENELUX_BOX` or after a 404.
- **Gladys awaits `onWeatherGet` under 15 s**: one call of 8 s at most
  (`HTTP_TIMEOUT`); a stale feed (up to an hour) bridges an outage.
- **One event per transition** (`src/triggers.js`): the first reading only
  arms; "rain expected" fires once per threshold and intensity until the
  rain stopped or the forecast turned dry; "rain stopped" needs 15 dry
  minutes.
- **Coordinates** are rounded to 2 decimals before they leave Gladys, and
  never logged.
- **Read-only rootfs**: write nothing on disk.
- **Versions belong to the Release workflow** (Actions → Release). Never edit
  `version` in `package.json` or in the manifest, nor the `docker_image` tag.
- **Changelog**: every user-visible change adds a line under
  `## [Unreleased]` in `CHANGELOG.md`.
- **Manifest texts** are `{ en, fr }` objects; the catalog description holds
  10 to 100 characters per language; `test/manifest.test.js` ties the
  manifest to the code. `source: "houses"` needs Gladys 5.2: houses are
  matched by name (as in `gladys-dwd`).
- **User-facing text** is bilingual, `docs/en.md` and `docs/fr.md` kept in
  sync. Comments explain why, in English.
- **Tests never touch the network** (`installFetch` replaces `fetch`).

## CI and pushes

- Group the commits and push **at most once a day**, unless the maintainer
  explicitly asks otherwise: the GitHub Actions quota is limited.
- If every CI job fails in under 2 seconds, the quota is exhausted: it is
  not a bug in the code.
- The Docker image cannot be built in the Claude Code cloud container (no
  network for `apk` inside `docker build`): the CI builds it.

## Refreshing the fixtures

```bash
curl -s 'https://data.buienradar.nl/2.0/feed/json' | python3 -m json.tool --indent 1 > test/fixtures/feed.json
curl -s 'https://gpsgadget.buienradar.nl/data/raintext?lat=52.37&lon=4.89' > test/fixtures/raintext-dry.txt
```

`FIXTURE_NOW` in `test/helpers/fakeFetch.js` is the time of the recording;
the expected values of the tests follow.

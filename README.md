# gladys-buienradar

[Gladys Assistant](https://gladysassistant.com) external integration for
[Buienradar](https://www.buienradar.nl) (Netherlands and Belgium): current
weather from the nearest station, 5-day forecast, 2-hour rain forecast, rain
radar image, rain scene triggers. **Unofficial, not affiliated with
Buienradar.** Data: Buienradar.nl.

User documentation: [docs/en.md](docs/en.md) · [docs/fr.md](docs/fr.md).

## How it works

```
Gladys ⇄ SDK ⇄ src/app.js (BuienradarApp)
                 ├─ src/buienradar.js  feed, raintext, radar maps (public, no key)
                 ├─ src/model.js       feed -> stations, current, days; raintext -> slots (pure)
                 ├─ src/conditions.js  icon letters / Dutch texts -> pivot conditions (pure)
                 ├─ src/pivot.js       -> the Gladys pivot weather, metric or us (pure)
                 ├─ src/triggers.js    two rain readings -> scene events (pure)
                 └─ src/widget.js      the "rain next 2 hours" widget (pure)
```

- **Weather** (`type: "weather"`): `onWeatherGet` answers with the nearest
  Buienradar station that has a temperature (a missing sensor is taken
  from the next station), the five days of the feed and the radar maps as
  provider images (`onWeatherGetImage`, PNG). The feed is read at most
  every 10 minutes; beyond 80 km of a station the request fails with a
  clear message and Gladys falls back to its next provider.
- **Rain watchers**: with `location: true`, every located house in the
  Benelux is watched through the raintext (`NNN|HH:MM` every 5 minutes,
  intensity = 10^((NNN-109)/32) mm/h), read every 5 minutes. A 404 from
  Buienradar marks the house as outside the coverage.
- **Triggers** come from two consecutive readings: "rain expected" once
  per dry → rain transition per threshold and intensity, "rain stopped"
  after 15 dry minutes; the first reading fires nothing.

## Development

```bash
npm install
npm test                                        # node --test, no network
npm run lint && npm run format:check
npx github:GladysAssistant/integration-store .  # store admission checks
```

The fixtures in `test/fixtures/` are real Buienradar answers recorded on
2026-10-14 (the feed, a dry raintext for Amsterdam); the shower raintext
is shaped after the real format.

## Releasing

**Actions → Release → Run workflow** (patch / minor / major): bumps the
version in `package.json` and the manifest, rolls `CHANGELOG.md`, tags, builds
the multi-arch image to GHCR and publishes the GitHub Release.

## License

Apache-2.0. The data belongs to Buienradar (© Buienradar / RTL): free for
non-commercial use with attribution.

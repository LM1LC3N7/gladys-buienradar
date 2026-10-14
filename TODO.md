# TODO

## Before announcing

- [ ] Test on a real Gladys 5.1+: the weather widget (current, 5 days, the
      radar with "provider images" on), the "Rain next 2 hours" widget, the
      two rain triggers and the scene action during a real shower.
- [ ] Check the CI (Docker build, Node 22 and 24), then run the store
      validator once the image is published.
- [ ] Turn on "Private vulnerability reporting" (SECURITY.md points there).
- [ ] Add the `gladys-assistant-integration` topic to publish in the store.

## To confirm

- [ ] A real shower: the raintext fixture with rain is shaped after the
      format (the recording of 2026-10-14 was dry everywhere); check the
      times, the intensities and the "rain stopped" delay against the
      Buienradar app.
- [ ] The station `timestamp` keeps its false "Z" in winter time (CET).
- [ ] The icon letters never seen in the feed yet (`h`, `i`, `k`, `l`, `p`,
      `r`, and `e`, `x`, `y`, `z` undocumented) and the five-day `wind`
      (always 0 on 2026-10-14: read as unknown) and `mmRainMin/Max` (0 even
      with 80 % rain chance).
- [ ] How the core shows the days (`datetime` at local noon) and whether it
      wants the pressure in inHg for `us` (kept in hPa).
- [ ] The radar map keeps a valid PNG under 500 KB on a rainy day (110 KB
      dry).
- [ ] `getHouses()` is granted with `location: true` on the install screen,
      and a house without coordinates is skipped quietly.

## Ideas

- A house picker (`source: "houses"`) instead of the typed house name once
  Gladys 5.2 is widespread.
- Hourly forecasts (`hours`) from Buienradar's location forecast
  (`forecast.buienradar.nl/2.0/forecast/<location id>`), not used yet.
- The Dutch weather report (`forecast.weatherreport`) as a scene action
  output for Dutch speakers.
- Belgian stations (KMI/IRM open data) for the current weather in southern
  Belgium, where the nearest Dutch station is too far.

# Buienradar

**Unofficial connector, not affiliated with Buienradar.** It makes
[Buienradar](https://www.buienradar.nl) the weather provider of Gladys for
the **Netherlands and Belgium**, and adds what Buienradar is known for: the
rain of the next two hours, in 5-minute steps. No account, no key, nothing
to enter. Data: [Buienradar.nl](https://www.buienradar.nl); Buienradar and
its data are © Buienradar / RTL.

## What you get

| Surface               | Content                                                                                                                                                                                                                    |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Weather** of Gladys | the current weather of the nearest Buienradar station (temperature, feels-like, humidity, pressure, wind and gusts, visibility, dew point, sunrise and sunset) and the 5-day forecast, for the weather widget and the chat |
| **Rain radar**        | the Buienradar radar maps of the Netherlands and of Belgium, in the weather widget                                                                                                                                         |
| Scene triggers        | **rain expected** within 5 minutes to 2 hours (any rain, moderate or heavy), **rain stopped**                                                                                                                              |
| Scene action          | **rain in the next 2 hours** of a house: dry or not, minutes until the rain, peak, total, a summary                                                                                                                        |
| Dashboard widget      | **Rain next 2 hours**: next rain, peak, total and a bar every 5 minutes                                                                                                                                                    |

Once installed, the integration takes precedence over the OpenWeather
service built into Gladys. The weather widget can also pick it explicitly.

## Coverage

- **Weather**: the 40 or so stations Buienradar publishes are all in the
  Netherlands. A house up to 80 km from one of them gets its weather (the
  whole country, northern Belgium, the German border). Farther away, Gladys
  is told the location is outside the coverage and uses its next provider.
- **Rain forecast and radar**: the Netherlands and Belgium.
- Buienradar writes its descriptions in Dutch only: the conditions of
  Gladys (sunny, cloudy, rain, snow…) are read from Buienradar's icons, so
  they show in your language.

## Setup

1. Install the integration from the Gladys catalog (Gladys 5.1 or newer)
   and accept the access to the **location of your houses**: the rain
   triggers, the scene action and the widget watch them.
2. Check that your house is placed on the map (**Settings → Houses**).
3. In the **Configuration** screen, click **Test Buienradar**: the message
   names the station used for each house and its rain forecast.
4. Put the **Rain next 2 hours** widget on a dashboard. For the radar,
   turn on the "provider images" option of the weather widget.

## Configuration

- **Language of the scene texts** (English by default) — the summaries
  sent to the scenes, in English, French or Dutch.
- **Rain check interval** (5 minutes by default, 5 at least) — how often
  the rain forecast of each house is read for the triggers. Buienradar
  updates it every 5 minutes.
- **Rain radar in the weather widget** (on by default).

## Scenes

- **Rain expected (Buienradar)**: pick **Rain within** (5, 10, 15 or 30
  minutes, 1 or 2 hours) and the **minimum intensity**: any rain (from
  0.1 mm/h), moderate (2.5 mm/h) or heavy (10 mm/h). Optional: the exact
  name of the **house**. The scene runs once per rain episode, when the
  radar forecast first shows that rain within that time, not at every
  check. Variables: `house`, `starts_in` (minutes), `start_time` (local
  "14:35"), `max_intensity` (mm/h), `total_mm` and `summary`.
- **Rain stopped (Buienradar)**: it was raining at the house and the radar
  now shows at least 15 dry minutes. Variables: `house`, `next_rain_in`
  (empty when the next 2 hours are dry) and `summary`.

Nothing fires at startup: the first check only learns what is going on.

The action **Buienradar rain in the next 2 hours** (field **house**, empty
for the first located house) gives `dry`, `raining`,
`minutes_until_rain`, `rain_time`, `minutes_until_dry`, `max_intensity`,
`total_mm` and `summary`, for a message or a condition that follows.

Examples: rain within 15 minutes → close the roof window and send "Bring in
the laundry: {{triggerEvent.data.summary}}"; every morning at 7:30, send
the summary of the action before leaving for school.

## How often Buienradar is read

- The weather feed: at most once every 10 minutes (Buienradar refreshes it
  every 10 minutes), only when Gladys asks for the weather.
- The rain forecast: once per house every 5 minutes (the option), shared
  with the widget and the scene action.
- The radar maps: only when the weather widget shows them, at most every
  5 minutes.

## Troubleshooting

- **"Outside the Buienradar coverage"**: the location is more than 80 km
  from a Buienradar station; Gladys takes the weather from its next
  provider.
- **No rain trigger**: the house needs a location in Gladys, in the
  Netherlands or Belgium; the status of the integration and the **Test
  Buienradar** button tell which houses are watched.
- **"Buienradar does not answer"**: the last weather stays served for an
  hour; everything comes back by itself.
- Logs: the integration's log level is set with the `LOG_LEVEL` variable.

## Privacy

The weather feed and the radar maps are the same for everyone: no location
is sent to get them. The rain forecast is asked for the coordinates of
each house rounded to 2 decimals (about 1 km).

## Data and terms of use

The data comes from Buienradar.nl. Buienradar's terms allow
**non-commercial use with attribution**: the source credited as
buienradar.nl with a link to [www.buienradar.nl](https://www.buienradar.nl).
This free, non-commercial connector shows "Data: Buienradar.nl" in the
widget, the radar labels and the configuration screen. Keep your own use
non-commercial too (no paid service built on it).

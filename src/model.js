// -----------------------------------------------------------------------------
// Buienradar answers -> plain objects. Pure: `now` is a parameter
// (milliseconds). Every Buienradar field name lives here and in
// src/conditions.js, so a change of the feed is fixed in one place.
//
// The units stay Buienradar's (°C, m/s, hPa, m, mm/h) until src/pivot.js.
// -----------------------------------------------------------------------------

import { conditionOf, iconOf } from './conditions.js';
import { INTENSITIES, MAX_STATION_KM, RAIN_STEP, TIME_ZONE } from './constants.js';

const round = (value, digits = 1) => Math.round(value * 10 ** digits) / 10 ** digits;
const num = (value) =>
  value === null || value === undefined || value === '' || !Number.isFinite(Number(value))
    ? null
    : Number(value);

// --- Time ------------------------------------------------------------------------

/** The wall clock of `t` in a time zone. */
export function localClock(t, timeZone = TIME_ZONE) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
      .formatToParts(new Date(t))
      .map((p) => [p.type, Number(p.value)]),
  );
  return parts;
}

const offsetAt = (t, timeZone) => {
  const p = localClock(t, timeZone);
  const wall = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return wall - Math.floor(t / 1000) * 1000;
};

/** "2026-10-14T08:00:00" read as a wall clock of the Netherlands -> epoch ms. */
export function localToEpoch(text, timeZone = TIME_ZONE) {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?/.exec(String(text ?? ''));
  if (!m) {
    return NaN;
  }
  const wall = Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +(m[6] ?? 0));
  // Two passes: the offset of the guess, then the offset of the real instant
  // (they differ only around a DST change).
  const guess = wall - offsetAt(wall, timeZone);
  return wall - offsetAt(guess, timeZone);
}

/** "14:35" in the Netherlands. */
export function clockText(t, timeZone = TIME_ZONE) {
  const { hour, minute } = localClock(t, timeZone);
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

/**
 * The measurement time of a station. Buienradar writes the LOCAL time with a
 * "Z" ("02:40Z" read at 00:56 UTC): read as UTC it would be in the future,
 * which no measurement is. Should Buienradar ever write true UTC, the same
 * test keeps it.
 */
export function stationTime(text, now) {
  const asUtc = Date.parse(text);
  if (Number.isFinite(asUtc) && asUtc <= now + 5 * 60_000) {
    return asUtc;
  }
  return localToEpoch(text);
}

// --- Stations ----------------------------------------------------------------------

/** Great-circle distance in km. */
export function distanceKm(lat1, lon1, lat2, lon2) {
  const rad = Math.PI / 180;
  const dLat = (lat2 - lat1) * rad;
  const dLon = (lon2 - lon1) * rad;
  const a =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLon / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.min(1, Math.sqrt(a)));
}

/** One station of `actual.stationmeasurements`. */
export function stationOf(raw, now) {
  const measuredAt = stationTime(raw.timestamp, now);
  return {
    id: raw.stationid,
    name: String(raw.stationname ?? '').replace(/^Meetstation\s+/i, ''),
    region: raw.regio ?? null,
    latitude: num(raw.lat),
    longitude: num(raw.lon),
    measuredAt: Number.isFinite(measuredAt) ? new Date(measuredAt).toISOString() : null,
    temperature: num(raw.temperature),
    feelsLike: num(raw.feeltemperature),
    humidity: num(raw.humidity),
    pressure: num(raw.airpressure),
    windSpeed: num(raw.windspeed),
    windGust: num(raw.windgusts),
    windDirection: num(raw.winddirectiondegrees),
    visibility: num(raw.visibility),
    rainLastHour: num(raw.rainFallLastHour),
    description: raw.weatherdescription || null,
    iconUrl: raw.iconurl || null,
  };
}

export function stationsOf(feed, now) {
  return (feed?.actual?.stationmeasurements ?? [])
    .map((raw) => stationOf(raw, now))
    .filter((s) => s.latitude !== null && s.longitude !== null);
}

/** The nearest station that has `field`, with its distance. */
export function nearestStation(stations, latitude, longitude, field = 'temperature') {
  let best;
  for (const station of stations) {
    if (station[field] === null) {
      continue;
    }
    const km = distanceKm(latitude, longitude, station.latitude, station.longitude);
    if (!best || km < best.km) {
      best = { station, km };
    }
  }
  return best;
}

// A station often lacks a sensor (a third has no barometer): such a value
// comes from the nearest station that has it. Wind values travel together.
const FILLED = [
  ['humidity'],
  ['pressure'],
  ['windSpeed', 'windGust', 'windDirection'],
  ['visibility'],
  ['iconUrl', 'description'],
];

/**
 * The current conditions at a location: the nearest station with a
 * temperature, completed by its neighbours. Undefined when no station is
 * within MAX_STATION_KM (Buienradar only measures in the Netherlands).
 */
export function currentConditions(feed, { latitude, longitude, now }) {
  const stations = stationsOf(feed, now);
  const main = nearestStation(stations, latitude, longitude);
  if (!main || main.km > MAX_STATION_KM) {
    return undefined;
  }
  const values = { ...main.station };
  for (const group of FILLED) {
    if (values[group[0]] !== null) {
      continue;
    }
    const other = nearestStation(stations, latitude, longitude, group[0]);
    if (other && other.km <= MAX_STATION_KM) {
      for (const field of group) {
        values[field] = other.station[field];
      }
    }
  }
  const sunrise = localToEpoch(feed?.actual?.sunrise);
  const sunset = localToEpoch(feed?.actual?.sunset);
  return {
    stationId: main.station.id,
    station: main.station.name,
    distanceKm: round(main.km),
    measuredAt: values.measuredAt ?? new Date(now).toISOString(),
    temperature: values.temperature,
    feelsLike: values.feelsLike,
    humidity: values.humidity,
    pressure: values.pressure,
    windSpeed: values.windSpeed,
    windGust: values.windGust,
    windDirection: values.windDirection,
    visibility: values.visibility,
    rainLastHour: values.rainLastHour,
    description: values.description,
    condition: conditionOf(values.iconUrl, values.description),
    night: iconOf(values.iconUrl).night,
    sunrise: Number.isFinite(sunrise) ? new Date(sunrise).toISOString() : null,
    sunset: Number.isFinite(sunset) ? new Date(sunset).toISOString() : null,
  };
}

// --- Five-day forecast ---------------------------------------------------------------

/** Dutch compass points ("zw", "nno") -> degrees. */
const COMPASS = 'n nno no ono o ozo zo zzo z zzw zw wzw w wnw nw nnw'.split(' ');
export function compassDegrees(text) {
  const index = COMPASS.indexOf(String(text ?? '').toLowerCase());
  return index < 0 ? null : index * 22.5;
}

/** The middle of each Beaufort class, in m/s. */
const BEAUFORT_MS = [0.1, 0.9, 2.5, 4.4, 6.7, 9.4, 12.3, 15.5, 19, 22.6, 26.5, 30.6, 32.7];
export function beaufortToMs(bft) {
  const n = num(bft);
  return n === null || n < 0 ? null : BEAUFORT_MS[Math.min(12, Math.round(n))];
}

/** One day of `forecast.fivedayforecast`. */
export function dayOf(raw) {
  const date = /^\d{4}-\d{2}-\d{2}/.exec(String(raw.day ?? ''))?.[0];
  const min = num(raw.mintemperatureMax) ?? num(raw.mintemperatureMin) ?? num(raw.mintemperature);
  const max = num(raw.maxtemperatureMax) ?? num(raw.maxtemperatureMin) ?? num(raw.maxtemperature);
  if (!date || min === null || max === null) {
    return undefined;
  }
  const rainMin = num(raw.mmRainMin);
  const rainMax = num(raw.mmRainMax);
  // "wind" is a Beaufort force; the feed sends 0 for every day when it has
  // none, and a calm whole day never happens here: 0 means unknown.
  const bft = num(raw.wind);
  return {
    date,
    min: Math.min(min, max),
    max: Math.max(min, max),
    rainChance: num(raw.rainChance),
    sunChance: num(raw.sunChance),
    rainMm: rainMin !== null && rainMax !== null ? round((rainMin + rainMax) / 2) : rainMax,
    windSpeed: bft ? beaufortToMs(bft) : null,
    windDirection: compassDegrees(raw.windDirection),
    description: raw.weatherdescription || null,
    condition: conditionOf(raw.iconurl, raw.weatherdescription),
  };
}

export function forecastDays(feed) {
  return (feed?.forecast?.fivedayforecast ?? []).map(dayOf).filter(Boolean);
}

/** The weather report of Buienradar's meteorologists (Dutch). */
export function weatherReport(feed) {
  const report = feed?.forecast?.weatherreport;
  if (!report?.title) {
    return null;
  }
  return {
    title: String(report.title),
    summary: String(report.summary ?? '').trim(),
    publishedAt: Number.isFinite(localToEpoch(report.published))
      ? new Date(localToEpoch(report.published)).toISOString()
      : null,
  };
}

// --- Two-hour rain forecast -----------------------------------------------------------

/** The raintext value (0 to 255) -> mm/h: 10^((value - 109) / 32), 0 is dry. */
export function intensityOf(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) {
    return 0;
  }
  return Math.round(10 ** ((n - 109) / 32) * 100) / 100;
}

/**
 * "NNN|HH:MM" lines -> 5-minute slots { at, t, mmh }. The times are local
 * and carry no date: the first one is placed next to `now` (it is the
 * current slot), the others follow every 5 minutes, which also holds across
 * midnight and a DST change.
 */
export function parseRainText(text, now) {
  const rows = String(text ?? '')
    .split(/\r?\n/)
    .map((line) => /^(\d{1,3})\|(\d{1,2}):(\d{2})$/.exec(line.trim()))
    .filter(Boolean);
  if (rows.length === 0) {
    return [];
  }
  const clock = localClock(now);
  const first = Number(rows[0][2]) * 60 + Number(rows[0][3]);
  const delta = ((first - (clock.hour * 60 + clock.minute) + 1440 + 720) % 1440) - 720;
  const start = Math.floor(now / 60_000) * 60_000 + delta * 60_000;
  return rows.map((row, i) => {
    const t = start + i * RAIN_STEP;
    return { at: new Date(t).toISOString(), t, value: Number(row[1]), mmh: intensityOf(row[1]) };
  });
}

/** The slots not over yet (the current one first). */
export const upcomingSlots = (slots, now) => slots.filter((s) => s.t + RAIN_STEP > now);

/** Minutes from `now` to the start of a slot (0 for the current one). */
export const minutesTo = (slot, now) => Math.max(0, Math.round((slot.t - now) / 60_000));

/** The first upcoming slot at or above `threshold` mm/h, or undefined. */
export function firstWet(slots, now, threshold = INTENSITIES.light) {
  return upcomingSlots(slots, now).find((s) => s.mmh >= threshold);
}

/** What the next two hours hold, in mm/h and minutes. */
export function rainOutlook(slots, now) {
  const upcoming = upcomingSlots(slots, now);
  const wet = (s) => s.mmh >= INTENSITIES.light;
  const first = upcoming.find(wet);
  const raining = upcoming.length > 0 && wet(upcoming[0]);
  const stop = raining ? upcoming.find((s) => !wet(s)) : undefined;
  const values = upcoming.map((s) => s.mmh);
  return {
    raining,
    dry: !first,
    minutesUntilRain: first ? minutesTo(first, now) : null,
    rainAt: first ? first.at : null,
    minutesUntilDry: stop ? minutesTo(stop, now) : null,
    dryAt: stop ? stop.at : null,
    maxIntensity: values.length > 0 ? Math.max(...values) : 0,
    totalMm: round(values.reduce((a, b) => a + b, 0) / 12, 2),
    slots: upcoming,
  };
}

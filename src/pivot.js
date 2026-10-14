// -----------------------------------------------------------------------------
// Current conditions and days (Buienradar units) -> the Gladys pivot weather
// format, in the unit system of the request. Pure.
//
//   metric: °C, m/s, hPa, mm, km      us: °F, mph, hPa, in, mi
//
// The pressure stays in hPa for "us": the contract names no other unit for it.
// -----------------------------------------------------------------------------

import { localClock, localToEpoch } from './model.js';

const round = (value, digits = 1) => Math.round(value * 10 ** digits) / 10 ** digits;
const defined = (object) =>
  Object.fromEntries(Object.entries(object).filter(([, v]) => v !== null && v !== undefined));

/** Dew point (Magnus formula), °C. */
export function dewPoint(temperature, humidity) {
  if (temperature === null || !humidity) {
    return null;
  }
  const g = Math.log(humidity / 100) + (17.62 * temperature) / (243.12 + temperature);
  return round((243.12 * g) / (17.62 - g));
}

export function converters(units) {
  const us = units === 'us';
  const keep = (fn) => (value) => (value === null || value === undefined ? null : fn(value));
  return {
    temperature: keep((c) => (us ? round((c * 9) / 5 + 32) : c)),
    speed: keep((ms) => (us ? round(ms * 2.236936) : ms)),
    /** metres -> km or mi */
    distance: keep((m) => (us ? round((m / 1000) * 0.621371) : round(m / 1000))),
    /** mm (or mm/h) -> in (or in/h) */
    rain: keep((mm) => (us ? round(mm / 25.4, 2) : mm)),
  };
}

/** A day "2026-10-14" -> local noon: the same calendar date in every time zone of Europe. */
export const dayInstant = (date) => new Date(localToEpoch(`${date}T12:00:00`)).toISOString();

const localDate = (t) => {
  const { year, month, day } = localClock(t);
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
};

/**
 * The pivot weather: `current` from model.currentConditions, `days` from
 * model.forecastDays, `images` the radar metadata (or none).
 */
export function toPivot({ current, days = [], images = [], now }, units = 'metric') {
  const to = converters(units);
  const sunrise = Date.parse(current.sunrise ?? '');
  const sunset = Date.parse(current.sunset ?? '');
  const sunKnown =
    Number.isFinite(sunrise) && Number.isFinite(sunset) && Math.abs(now - sunrise) < 36 * 3600_000;
  // The sun times of the feed are those of the current local day; without
  // them, the night icon of the station tells.
  const isDay = sunKnown ? now >= sunrise && now < sunset : !current.night;
  const today = sunKnown ? localDate(sunrise) : null;
  return defined({
    temperature: to.temperature(current.temperature),
    weather: current.condition,
    datetime: current.measuredAt,
    apparent_temperature: to.temperature(current.feelsLike),
    humidity: current.humidity,
    pressure: current.pressure,
    dew_point: to.temperature(dewPoint(current.temperature, current.humidity)),
    wind_speed: to.speed(current.windSpeed),
    wind_direction: current.windDirection,
    wind_gust: to.speed(current.windGust),
    visibility: to.distance(current.visibility),
    sunrise: current.sunrise,
    sunset: current.sunset,
    is_day: isDay,
    days: days.map((d) =>
      defined({
        temperature_min: to.temperature(d.min),
        temperature_max: to.temperature(d.max),
        datetime: dayInstant(d.date),
        weather: d.condition,
        precipitation_probability: d.rainChance,
        precipitation: to.rain(d.rainMm),
        wind_speed: to.speed(d.windSpeed),
        wind_direction: d.windDirection,
        sunrise: d.date === today ? current.sunrise : null,
        sunset: d.date === today ? current.sunset : null,
      }),
    ),
    images: images.length > 0 ? images : null,
  });
}

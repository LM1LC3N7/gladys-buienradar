// -----------------------------------------------------------------------------
// The pure layers: the feed (real answer of 2026-10-14), the conditions, the
// pivot conversions and the raintext.
// -----------------------------------------------------------------------------

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { conditionOf, describe, iconOf } from '../src/conditions.js';
import {
  compassDegrees,
  currentConditions,
  forecastDays,
  intensityOf,
  localToEpoch,
  parseRainText,
  rainOutlook,
  stationsOf,
  stationTime,
  weatherReport,
} from '../src/model.js';
import { dewPoint, toPivot } from '../src/pivot.js';
import { normalizeConfig } from '../src/config.js';
import { FIXTURE_NOW, fixture, fixtureText, rainText } from './helpers/fakeFetch.js';

const feed = fixture('feed.json');
const AMSTERDAM = { latitude: 52.37, longitude: 4.89, now: FIXTURE_NOW };

test('the stations of the feed, their local timestamps read right', () => {
  const stations = stationsOf(feed, FIXTURE_NOW);
  assert.equal(stations.length, 39);
  const schiphol = stations.find((s) => s.id === 6240);
  assert.equal(schiphol.name, 'Schiphol');
  // "2026-10-14T02:40:00Z" read at 00:56 UTC is the local time of Amsterdam.
  assert.equal(schiphol.measuredAt, '2026-10-14T00:40:00.000Z');
  assert.equal(
    stations.find((s) => s.id === 6225).temperature,
    null,
    'IJmuiden has no thermometer',
  );
  // A true UTC time (in the past) is kept as is.
  assert.equal(
    stationTime('2026-10-14T00:40:00Z', FIXTURE_NOW),
    Date.parse('2026-10-14T00:40:00Z'),
  );
});

test('local times of the Netherlands, summer and winter', () => {
  assert.equal(localToEpoch('2026-10-14T08:00:00'), Date.parse('2026-10-14T06:00:00Z'));
  assert.equal(localToEpoch('2026-12-01T08:00:00'), Date.parse('2026-12-01T07:00:00Z'));
  assert.ok(Number.isNaN(localToEpoch('tomorrow')));
});

test('current conditions: the nearest station with a temperature', () => {
  const current = currentConditions(feed, AMSTERDAM);
  assert.equal(current.station, 'Schiphol');
  assert.equal(current.distanceKm, 11.3);
  assert.equal(current.temperature, 14.3);
  assert.equal(current.condition, 'cloud');
  assert.equal(current.night, true, 'cc.png is the night icon');
  assert.equal(current.sunrise, '2026-10-14T06:00:00.000Z');
  assert.equal(current.sunset, '2026-10-14T16:45:00.000Z');
});

test('a missing sensor comes from the nearest station that has it', () => {
  // Berkhout has no barometer: Den Helder (33 km) lends its pressure.
  const current = currentConditions(feed, { latitude: 52.65, longitude: 4.98, now: FIXTURE_NOW });
  assert.equal(current.station, 'Berkhout');
  assert.equal(current.pressure, 1024.7);
  assert.equal(current.windSpeed, 6);
  // IJmuiden measures nothing: the next station answers for it.
  const ijmuiden = currentConditions(feed, { latitude: 52.47, longitude: 4.57, now: FIXTURE_NOW });
  assert.notEqual(ijmuiden.station, 'IJmuiden');
});

test('outside the coverage: no station within 80 km', () => {
  assert.equal(
    currentConditions(feed, { latitude: 48.85, longitude: 2.35, now: FIXTURE_NOW }),
    undefined,
  );
  // Brussels is still within reach of the Dutch stations.
  assert.ok(currentConditions(feed, { latitude: 50.85, longitude: 4.35, now: FIXTURE_NOW }));
});

test('the five days', () => {
  const days = forecastDays(feed);
  assert.equal(days.length, 5);
  assert.deepEqual(days[2], {
    date: '2026-10-16',
    min: 12,
    max: 19,
    rainChance: 80,
    sunChance: 20,
    rainMm: 0,
    windSpeed: null,
    windDirection: 225,
    description: 'Zwaar bewolkt en regen',
    condition: 'rain',
  });
  assert.equal(compassDegrees('nno'), 22.5);
  assert.equal(compassDegrees('?'), null);
  assert.equal(weatherReport(feed).title, 'Vandaag druilerig, morgen weer zon');
});

test('icon letters and Dutch descriptions -> conditions', () => {
  assert.deepEqual(iconOf('https://cdn.buienradar.nl/x/30x30/bb.png'), {
    letter: 'b',
    night: true,
  });
  assert.deepEqual(iconOf('https://cdn.buienradar.nl/x/96x96/Q.png'), {
    letter: 'q',
    night: false,
  });
  const cases = { a: 'clear', b: 'partly-cloudy', c: 'cloud', d: 'fog', f: 'drizzle' };
  Object.assign(cases, { q: 'rain', w: 'sleet', t: 'snow', s: 'thunderstorm' });
  for (const [letter, condition] of Object.entries(cases)) {
    assert.equal(conditionOf(`https://x/${letter}.png`), condition, letter);
  }
  // A letter nobody documented: the description decides.
  assert.equal(conditionOf('https://x/e.png', 'Kans op onweer'), 'thunderstorm');
  assert.equal(conditionOf('https://x/z.png', 'Vrijwel onbewolkt (zonnig/helder)'), 'clear');
  assert.equal(conditionOf(null, 'Half bewolkt'), 'partly-cloudy');
  assert.equal(conditionOf(null, 'Iets onbekends'), 'unknown');
  assert.equal(describe('drizzle', 'fr'), 'Pluie faible');
  assert.equal(describe('cloud', 'nl', 'Zwaar bewolkt'), 'Zwaar bewolkt', 'Dutch keeps Buienradar');
});

test('the pivot, metric and us', () => {
  const current = currentConditions(feed, AMSTERDAM);
  const days = forecastDays(feed);
  const metric = toPivot({ current, days, now: FIXTURE_NOW }, 'metric');
  assert.equal(metric.temperature, 14.3);
  assert.equal(metric.weather, 'cloud');
  assert.equal(metric.datetime, '2026-10-14T00:40:00.000Z');
  assert.equal(metric.visibility, 80.6);
  assert.equal(metric.wind_speed, 4.6);
  assert.equal(metric.is_day, false, 'before the sunrise');
  assert.equal(metric.days.length, 5);
  assert.equal(metric.days[0].datetime, '2026-10-14T10:00:00.000Z', 'local noon');
  assert.equal(metric.days[0].sunrise, current.sunrise);
  assert.equal(metric.days[1].sunrise, undefined);
  assert.equal(metric.images, undefined);
  const us = toPivot({ current, days, now: FIXTURE_NOW }, 'us');
  assert.equal(us.temperature, 57.7);
  assert.equal(us.wind_speed, 10.3);
  assert.equal(us.visibility, 50.1);
  assert.equal(us.pressure, 1025.5);
  assert.equal(us.days[0].temperature_max, 62.6);
  const noon = toPivot({ current, days, now: Date.parse('2026-10-14T10:00:00Z') });
  assert.equal(noon.is_day, true);
  assert.equal(dewPoint(14.3, 70), 8.9);
});

test('raintext: values to mm/h, local times placed next to now', () => {
  assert.equal(intensityOf(0), 0);
  assert.equal(intensityOf(77), 0.1);
  assert.equal(intensityOf(109), 1);
  assert.equal(intensityOf(141), 10);
  const slots = parseRainText(fixtureText('raintext-dry.txt'), FIXTURE_NOW);
  assert.equal(slots.length, 24);
  assert.equal(slots[0].at, '2026-10-14T00:55:00.000Z', '02:55 in Amsterdam');
  assert.equal(slots[23].at, '2026-10-14T02:50:00.000Z');
  assert.equal(rainOutlook(slots, FIXTURE_NOW).dry, true);
  // Across midnight: 23:55 then 00:00 the next day.
  const late = Date.parse('2026-10-14T21:57:00Z');
  const crossing = parseRainText(rainText([0, 120], late), late);
  assert.equal(crossing[0].at, '2026-10-14T21:55:00.000Z');
  assert.equal(crossing[1].at, '2026-10-14T22:00:00.000Z');
  assert.deepEqual(parseRainText('<html>', FIXTURE_NOW), []);
});

test('the outlook of a shower', () => {
  const slots = parseRainText(fixtureText('raintext-shower.txt'), FIXTURE_NOW);
  const outlook = rainOutlook(slots, FIXTURE_NOW);
  assert.equal(outlook.raining, false);
  assert.equal(outlook.dry, false);
  assert.equal(outlook.minutesUntilRain, 18);
  assert.equal(outlook.rainAt, '2026-10-14T01:15:00.000Z');
  assert.equal(outlook.maxIntensity, 19.11);
  assert.equal(outlook.totalMm, 4.07);
  // 25 minutes later it rains, until 01:55.
  const later = rainOutlook(slots, FIXTURE_NOW + 25 * 60_000);
  assert.equal(later.raining, true);
  assert.equal(later.minutesUntilRain, 0);
  assert.equal(later.minutesUntilDry, 33);
});

test('the configuration is bounded', () => {
  assert.deepEqual(normalizeConfig(), { language: 'en', rainPollMinutes: 5, radarImage: true });
  assert.deepEqual(normalizeConfig({ language: 'NL', rain_poll_interval: 1, radar_image: false }), {
    language: 'nl',
    rainPollMinutes: 5,
    radarImage: false,
  });
  assert.equal(normalizeConfig({ language: 'de', rain_poll_interval: '15' }).language, 'en');
  assert.equal(normalizeConfig({ rain_poll_interval: '15' }).rainPollMinutes, 15);
});

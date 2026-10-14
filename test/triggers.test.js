// -----------------------------------------------------------------------------
// Rain readings -> scene events: the first reading arms, one event per
// transition, the rain "stops" only after 15 dry minutes.
// -----------------------------------------------------------------------------

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SCENE_TRIGGERS } from '../src/constants.js';
import { parseRainText, rainOutlook } from '../src/model.js';
import { outlookSummary, rainEvents } from '../src/triggers.js';
import { FIXTURE_NOW, rainText } from './helpers/fakeFetch.js';

const DRY = Array(24).fill(0);
const minutes = (n) => FIXTURE_NOW + n * 60_000;

/** One reading of the house "Home": raw raintext values from the current slot. */
const read = (state, values, now = FIXTURE_NOW, language = 'en') =>
  rainEvents(state, {
    house: 'Home',
    slots: parseRainText(rainText(values, now), now),
    now,
    language,
  });

const expected = (events) =>
  events
    .filter((e) => e.key === SCENE_TRIGGERS.RAIN_EXPECTED)
    .map((e) => `${e.data.intensity}:${e.data.minutes}`);

test('the first reading fires nothing, even under the rain', () => {
  const raining = read(undefined, [120, 120, 120]);
  assert.deepEqual(raining.events, []);
  assert.equal(raining.state.wet, true);
  const soon = read(undefined, [0, 0, 0, 0, 100]);
  assert.deepEqual(soon.events, []);
  assert.deepEqual(soon.state.fired.light, [30, 60, 120], 'what is already true is armed');
});

test('dry -> rain fires every threshold reached, once', () => {
  let { state } = read(undefined, DRY);
  // Light rain at 03:15 (18 min), moderate from 03:20 (23 min).
  let result = read(state, [0, 0, 0, 0, 100, 130]);
  assert.deepEqual(expected(result.events), [
    'light:30',
    'light:60',
    'light:120',
    'moderate:30',
    'moderate:60',
    'moderate:120',
  ]);
  const first = result.events[0].data;
  assert.equal(first.house, 'Home');
  assert.equal(first.starts_in, 18);
  assert.equal(first.start_time, '03:15');
  assert.equal(first.starts_at, '2026-10-14T01:15:00.000Z');
  assert.equal(first.max_intensity, 4.53);
  assert.match(
    first.summary,
    /^Rain expected at Home from 03:15 \(in 18 min\), up to 4\.5 mm\/h\.$/,
  );
  // Ten minutes later the same shower is 8 minutes away: 10 and 15 fire.
  state = result.state;
  result = read(state, [0, 0, 100, 130], minutes(10));
  assert.deepEqual(expected(result.events), ['light:10', 'light:15', 'moderate:15']);
  // The forecast wavers (35 minutes, then 8 again): nothing more.
  state = result.state;
  result = read(state, [0, 0, 0, 0, 0, 0, 0, 100], minutes(15));
  assert.deepEqual(result.events, []);
  // 3 minutes away now: only the 5-minute mark is new. The moderate core
  // left the forecast: re-armed, announced again if it comes back.
  result = read(result.state, [0, 100], minutes(20));
  assert.deepEqual(expected(result.events), ['light:5']);
  assert.deepEqual(result.state.fired.moderate, []);
});

test('the rain stops after 15 dry minutes, once, and re-arms', () => {
  let { state } = read(undefined, [120, 120]);
  // A 5-minute pause is no end.
  let result = read(state, [0, 120, 120], minutes(5));
  assert.deepEqual(result.events, []);
  // Dry now and for the next 15 minutes: stopped.
  result = read(result.state, [0, 0, 0, 0, 0, 0, 100], minutes(10));
  const stopped = result.events.filter((e) => e.key === SCENE_TRIGGERS.RAIN_STOPPED);
  assert.equal(stopped.length, 1);
  assert.equal(stopped[0].data.next_rain_in, 28);
  assert.match(stopped[0].data.summary, /The rain stopped at Home\. Next rain in 28 min\./);
  // Re-armed: the next shower (28 min) is announced in the same reading.
  assert.deepEqual(expected(result.events), ['light:30', 'light:60', 'light:120']);
  state = result.state;
  result = read(state, [0, 0, 0, 0, 0, 0, 100], minutes(15));
  assert.deepEqual(result.events, [], 'no second "stopped"');
});

test('a forecast that turns dry re-arms the announcement', () => {
  let { state } = read(undefined, DRY);
  let result = read(state, [...Array(20).fill(0), 100]);
  assert.deepEqual(expected(result.events), ['light:120']);
  result = read(result.state, DRY, minutes(5));
  assert.deepEqual(result.events, []);
  assert.deepEqual(result.state.fired.light, []);
  result = read(result.state, [...Array(18).fill(0), 100], minutes(10));
  assert.deepEqual(expected(result.events), ['light:120']);
});

test('heavy rain only from 10 mm/h, summaries in the configured language', () => {
  let { state } = read(undefined, DRY);
  let result = read(state, [0, 0, 0, 141], FIXTURE_NOW, 'nl');
  const heavy = result.events.filter((e) => e.data.intensity === 'heavy');
  assert.deepEqual(
    heavy.map((e) => e.data.minutes),
    ['15', '30', '60', '120'],
  );
  assert.match(
    heavy[0].data.summary,
    /^Regen verwacht bij Home vanaf 03:10 \(over 13 min\), tot 10 mm\/u\.$/,
  );
  ({ state } = read(undefined, DRY));
  result = read(state, [0, 0, 0, 130]);
  assert.equal(result.events.filter((e) => e.data.intensity === 'heavy').length, 0);
});

test('the scene summaries of an outlook', () => {
  const outlook = (values, now = FIXTURE_NOW) =>
    rainOutlook(parseRainText(rainText(values, now), now), now);
  assert.equal(
    outlookSummary(outlook(DRY), 'Home').en,
    'No rain expected in the next 2 hours at Home.',
  );
  assert.equal(
    outlookSummary(outlook([120, 120, 0]), 'Maison').fr,
    "Il pleut à Maison (jusqu'à 2,2 mm/h), sec à partir de 03:05 (dans 8 min).",
  );
  assert.match(outlookSummary(outlook(Array(24).fill(120)), 'Home').en, /for the next 2 hours\.$/);
});

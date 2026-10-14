// -----------------------------------------------------------------------------
// The integration against the SDK's fake Gladys and a fake Buienradar.
// -----------------------------------------------------------------------------

import { afterEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { validateWidgetContent } from '@gladysassistant/integration-sdk';
import { createFakeGladys } from '@gladysassistant/integration-sdk/testing';
import { BuienradarApp } from '../src/app.js';
import { ACTIONS, SCENE_ACTIONS, SCENE_TRIGGERS, WIDGETS } from '../src/constants.js';
import {
  FIXTURE_NOW,
  fixture,
  fixtureBytes,
  fixtureText,
  installFetch,
  json,
  png,
  rainText,
  text,
} from './helpers/fakeFetch.js';
import { createFakeTimers } from './helpers/fakeTimers.js';

const quiet = {
  info() {},
  warn: (...a) => process.env.DEBUG_TEST && console.error(...a),
  error() {},
  debug() {},
};

const HOME = { id: 1, name: 'Home', selector: 'home', latitude: 52.37, longitude: 4.89 };
const PARIS = { id: 2, name: 'Paris flat', selector: 'paris', latitude: 48.85, longitude: 2.35 };
const BOAT = { id: 3, name: 'Boat', selector: 'boat', latitude: null, longitude: null };
const LUXEMBOURG = { id: 4, name: 'Lux', selector: 'lux', latitude: 49.61, longitude: 6.13 };
const WEATHER = { latitude: 52.37, longitude: 4.89, language: 'en', units: 'metric' };

let fake;
afterEach(() => fake?.restore());

async function setup({ config = {}, houses = [HOME] } = {}) {
  const state = {
    feed: () => json(fixture('feed.json')),
    rain: () => text(fixtureText('raintext-dry.txt')),
    radar: () => png(fixtureBytes('radar.png')),
  };
  fake = installFetch([
    [/data\.buienradar\.nl\/2\.0\/feed\/json$/, (call) => state.feed(call)],
    [/gpsgadget\.buienradar\.nl\/data\/raintext\?/, (call) => state.rain(call)],
    [/image\.buienradar\.nl\/2\.0\/image\/single\//, (call) => state.radar(call)],
  ]);
  const gladys = createFakeGladys({ selector: 'buienradar', config, houses });
  const timers = createFakeTimers();
  const clock = { now: FIXTURE_NOW };
  const app = new BuienradarApp({ gladys, logger: quiet, now: () => clock.now, timers });
  gladys.onWeatherGet((options) => app.getWeather(options));
  gladys.onWeatherGetImage((key) => app.getImage(key));
  gladys.onSceneAction(SCENE_ACTIONS.RAIN_FORECAST, (fields) => app.getRainForecast(fields));
  gladys.onWidgetGet(WIDGETS.RAIN, (request) => app.getWidget(WIDGETS.RAIN, request));
  gladys.onAction(ACTIONS.TEST, () => app.testConnection());
  await gladys.connect();
  return { app, gladys, timers, clock, state };
}

const calls = (pattern) => fake.calls.filter((c) => pattern.test(c.url)).length;

test('the weather of a location: the nearest station, the feed read once per 10 minutes', async () => {
  const { gladys, clock } = await setup();
  const ack = await gladys.fake.weatherGet(WEATHER);
  assert.equal(ack.success, true);
  const weather = ack.data.weather;
  assert.equal(weather.temperature, 14.3);
  assert.equal(weather.weather, 'cloud');
  assert.equal(weather.is_day, false);
  assert.equal(weather.days.length, 5);
  assert.deepEqual(
    weather.images.map((i) => i.key),
    ['radar-nl', 'radar-be'],
  );
  assert.match(weather.images[0].label.en, /Buienradar\.nl$/);
  await gladys.fake.weatherGet({ ...WEATHER, units: 'us' });
  assert.equal(calls(/feed/), 1, 'served from the cache');
  clock.now += 11 * 60_000;
  await gladys.fake.weatherGet(WEATHER);
  assert.equal(calls(/feed/), 2);
  // A house in Belgium gets the Belgian radar first.
  const brussels = await gladys.fake.weatherGet({ ...WEATHER, latitude: 50.85, longitude: 4.35 });
  assert.equal(brussels.data.weather.images[0].key, 'radar-be');
});

test('outside the coverage: an error the core can show', async () => {
  const { gladys } = await setup();
  const ack = await gladys.fake.weatherGet({ ...WEATHER, latitude: 48.85, longitude: 2.35 });
  assert.equal(ack.success, false);
  assert.match(ack.error, /Outside the Buienradar coverage.*Netherlands and Belgium/);
});

test('Buienradar down: the last feed bridges an hour, the status says so', async () => {
  const { gladys, clock, state } = await setup();
  await gladys.fake.weatherGet(WEATHER);
  state.feed = () => json({ message: 'boom' }, 503);
  clock.now += 11 * 60_000;
  const stale = await gladys.fake.weatherGet(WEATHER);
  assert.equal(stale.success, true);
  assert.equal(gladys.fake.connectionStatus.connected, false);
  assert.match(gladys.fake.connectionStatus.message.en, /Buienradar does not answer: HTTP 503/);
  clock.now += 60 * 60_000;
  assert.equal((await gladys.fake.weatherGet(WEATHER)).success, false);
  state.feed = () => json(fixture('feed.json'));
  assert.equal((await gladys.fake.weatherGet(WEATHER)).success, true);
  assert.equal(gladys.fake.connectionStatus.connected, true);
});

test('the radar maps: raw base64 PNG, cached, refused when not an image, off by option', async () => {
  const { app, gladys, state } = await setup();
  const ack = await gladys.fake.weatherGetImage('radar-nl');
  assert.equal(ack.data.image, fixtureBytes('radar.png').toString('base64'));
  assert.match(fake.calls.at(-1).url, /RadarMapRainNL\?height=512&width=500/);
  await gladys.fake.weatherGetImage('radar-nl');
  assert.equal(calls(/image\.buienradar/), 1);
  assert.equal((await gladys.fake.weatherGetImage('satellite')).success, false);
  state.radar = () => new Response('GIF89a........', { status: 200 });
  assert.match((await gladys.fake.weatherGetImage('radar-be')).error, /PNG or JPEG/);
  await app.start({ radar_image: false });
  assert.equal((await gladys.fake.weatherGet(WEATHER)).data.weather.images, undefined);
});

test('the rain watcher: located houses only, every 5 minutes, one event per transition', async () => {
  const { app, gladys, timers, clock, state } = await setup({ houses: [HOME, PARIS, BOAT] });
  await app.start({});
  // Paris is outside the box and the boat has no location: one call.
  assert.equal(calls(/raintext/), 1);
  assert.deepEqual(fake.calls[0].params, { lat: '52.37', lon: '4.89' });
  assert.equal(timers.intervals()[0].ms, 5 * 60_000);
  assert.equal(gladys.fake.sceneEvents.length, 0, 'nothing on the first reading');
  assert.match(
    gladys.fake.connectionStatus.message.en,
    /Rain forecast watched for 1 house\. 1 house outside the coverage/,
  );
  // A heavy shower appears, 8 minutes away.
  clock.now += 5 * 60_000;
  state.rain = () => text(rainText([0, 0, 141, 141], clock.now));
  await timers.runIntervals();
  assert.equal(calls(/raintext/), 2);
  const expected = gladys.fake.sceneEvents.filter((e) => e.key === SCENE_TRIGGERS.RAIN_EXPECTED);
  assert.equal(expected.length, 15, '10 to 120 minutes, at three intensities');
  assert.equal(expected[0].data.house, 'Home');
  assert.equal(expected[0].data.minutes, '10');
  assert.ok(gladys.fake.widgetRefreshes.includes(WIDGETS.RAIN));
  // The same shower five minutes later: only the 5-minute mark is new.
  clock.now += 5 * 60_000;
  state.rain = () => text(rainText([0, 141, 141], clock.now));
  await timers.runIntervals();
  assert.deepEqual(
    gladys.fake.sceneEvents.slice(15).map((e) => `${e.data.intensity}:${e.data.minutes}`),
    ['light:5', 'moderate:5', 'heavy:5'],
  );
  // It rains, then it is dry for good.
  clock.now += 10 * 60_000;
  state.rain = () => text(rainText([141, 141], clock.now));
  await timers.runIntervals();
  clock.now += 10 * 60_000;
  state.rain = () => text(rainText([0], clock.now));
  await timers.runIntervals();
  const stopped = gladys.fake.sceneEvents.filter((e) => e.key === SCENE_TRIGGERS.RAIN_STOPPED);
  assert.equal(stopped.length, 1);
  assert.equal(stopped[0].data.summary, 'The rain stopped at Home. Dry for the next 2 hours.');
  app.stop();
  assert.equal(timers.intervals().length, 0);
});

test('a house Buienradar refuses (404) is never asked again', async () => {
  const { app, gladys, timers, clock, state } = await setup({ houses: [LUXEMBOURG] });
  state.rain = () => text('Not found: location must be inside the Netherlands or Belgium.', 404);
  await app.start({});
  assert.equal(calls(/raintext/), 1);
  assert.equal(gladys.fake.connectionStatus.connected, false);
  assert.match(gladys.fake.connectionStatus.message.fr, /hors de la couverture de Buienradar/);
  clock.now += 5 * 60_000;
  await timers.runIntervals();
  // Even when the houses are read again (the test button does).
  const message = (await gladys.fake.action(ACTIONS.TEST)).data.message;
  assert.match(message.en, /Lux: no Buienradar station within 80 km/);
  assert.match(message.en, /Netherlands and Belgium only/);
  assert.equal(calls(/raintext/), 1);
});

test('the rain forecast down: the status says so and the loop keeps running', async () => {
  const { app, gladys, timers, state } = await setup();
  state.rain = () => text('boom', 500);
  await app.start({});
  assert.equal(gladys.fake.connectionStatus.connected, false);
  assert.match(gladys.fake.connectionStatus.message.en, /rain forecast does not answer: HTTP 500/);
  assert.equal(timers.intervals().length, 1);
});

test('the scene action: by name or the first house, from the cache', async () => {
  const { app, gladys, state } = await setup({ houses: [HOME, PARIS] });
  state.rain = () => text(fixtureText('raintext-shower.txt'));
  await app.start({ language: 'fr' });
  const ack = await gladys.fake.sceneAction(SCENE_ACTIONS.RAIN_FORECAST, {});
  assert.equal(ack.success, true);
  assert.deepEqual(ack.data.outputs, {
    house: 'Home',
    dry: false,
    raining: false,
    minutes_until_rain: 18,
    rain_time: '03:15',
    minutes_until_dry: null,
    max_intensity: 19.11,
    total_mm: 4.07,
    summary: "Pluie attendue à Home à partir de 03:15 (dans 18 min), jusqu'à 19,1 mm/h.",
  });
  const byName = await gladys.fake.sceneAction(SCENE_ACTIONS.RAIN_FORECAST, { house: ' home ' });
  assert.equal(byName.data.outputs.house, 'Home');
  assert.equal(calls(/raintext/), 1, 'the watcher read is reused');
  const unknown = await gladys.fake.sceneAction(SCENE_ACTIONS.RAIN_FORECAST, { house: 'Atlantis' });
  assert.match(unknown.error, /No house named "Atlantis"/);
  const paris = await gladys.fake.sceneAction(SCENE_ACTIONS.RAIN_FORECAST, { house: 'Paris flat' });
  assert.match(paris.error, /outside the Buienradar rain forecast/);
});

test('the widget through the core', async () => {
  const { app, gladys, state } = await setup({ houses: [HOME, PARIS] });
  state.rain = () => text(fixtureText('raintext-shower.txt'));
  await app.start({});
  const content = (await gladys.fake.widgetGet(WIDGETS.RAIN, { settings: {}, language: 'fr' })).data
    .content;
  assert.deepEqual(validateWidgetContent(content), []);
  assert.equal(content.components[0].text.fr, 'Pluie · Home');
  const paris = (await gladys.fake.widgetGet(WIDGETS.RAIN, { settings: { house: 'Paris flat' } }))
    .data.content;
  assert.match(paris.components[1].text.en, /Netherlands and Belgium only/);
  gladys.fake.houses = [];
  await app.start({});
  const none = (await gladys.fake.widgetGet(WIDGETS.RAIN, { settings: {} })).data.content;
  assert.match(none.components[1].text.en, /No house with a location/);
});

test('the test button names the station and the rain of each house', async () => {
  const { app, gladys } = await setup({ houses: [HOME, PARIS] });
  await app.start({});
  const message = (await gladys.fake.action(ACTIONS.TEST)).data.message;
  const lines = message.en.split('\n');
  assert.match(lines[0], /^Buienradar answers: 39 stations, report "Vandaag druilerig/);
  assert.equal(lines[1], 'Home: station Schiphol (11.3 km), 14.3 °C, Cloudy.');
  assert.equal(lines[2], '  No rain expected in the next 2 hours at Home.');
  assert.equal(lines[3], 'Paris flat: no Buienradar station within 80 km.');
  assert.equal(message.fr.split('\n')[1], 'Home : station Schiphol (11,3 km), 14,3 °C, Nuageux.');
});

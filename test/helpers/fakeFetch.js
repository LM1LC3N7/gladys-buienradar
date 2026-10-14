// -----------------------------------------------------------------------------
// Fake `fetch` for the tests: routes requests to handlers, records every
// call, and fails loudly on an unexpected URL. No test touches the network.
// -----------------------------------------------------------------------------

import { readFileSync } from 'node:fs';
import { setFetch } from '../../src/http.js';

setFetch(async (url) => {
  throw new Error(`Network call without a fake fetch in a test: ${url}`);
});

const path = (name) => new URL(`../fixtures/${name}`, import.meta.url);

export const fixture = (name) => JSON.parse(readFileSync(path(name), 'utf8'));
export const fixtureText = (name) => readFileSync(path(name), 'utf8');
export const fixtureBytes = (name) => readFileSync(path(name));

export const json = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
export const text = (body, status = 200) =>
  new Response(body, { status, headers: { 'content-type': 'text/plain' } });
export const png = (bytes) =>
  new Response(bytes, { status: 200, headers: { 'content-type': 'image/png' } });

/** Install a fake fetch; `routes` is a list of [RegExp, handler({ url, params })]. */
export function installFetch(routes) {
  const calls = [];
  const previous = setFetch(async (url, init = {}) => {
    const call = { url, params: Object.fromEntries(new URL(url).searchParams), init };
    calls.push(call);
    const route = routes.find(([pattern]) => pattern.test(url));
    if (!route) {
      throw new Error(`Unexpected network call in a test: ${url}`);
    }
    return route[1](call);
  });
  return { calls, restore: () => setFetch(previous) };
}

/** The instant the feed and the raintexts were recorded (2026-10-14, 02:56 in Amsterdam). */
export const FIXTURE_NOW = Date.parse('2026-10-14T00:56:36Z');

/** Where the raintext fixtures were recorded. */
export const AMSTERDAM = { latitude: 52.37, longitude: 4.89 };

/**
 * A raintext like Buienradar's, from mm/h-ish raw values, starting at the
 * current slot of `now` (local time of the Netherlands).
 */
export function rainText(values, now = FIXTURE_NOW) {
  const clock = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Amsterdam',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  });
  const start = Math.floor(now / 300_000) * 300_000;
  const padded = [...values, ...Array(24).fill(0)].slice(0, 24);
  return padded
    .map((v, i) => `${String(v).padStart(3, '0')}|${clock.format(new Date(start + i * 300_000))}`)
    .join('\r\n');
}

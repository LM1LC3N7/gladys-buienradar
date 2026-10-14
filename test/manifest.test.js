// -----------------------------------------------------------------------------
// The manifest is the contract with Gladys and the store: these tests tie it
// to the code, so a key renamed on one side only fails here.
// -----------------------------------------------------------------------------

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  ACTIONS,
  INTENSITIES,
  LANGUAGES,
  RADAR_MAPS,
  RAIN_THRESHOLDS,
  SCENE_ACTIONS,
  SCENE_TRIGGERS,
  WIDGETS,
} from '../src/constants.js';
import { DEFAULTS } from '../src/config.js';
import { T } from '../src/i18n.js';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const manifest = JSON.parse(read('gladys-assistant-integration.json'));
const index = read('index.js');

function* texts(node, path = '') {
  if (Array.isArray(node)) {
    for (const [i, item] of node.entries()) {
      yield* texts(item, `${path}[${i}]`);
    }
  } else if (node && typeof node === 'object') {
    if ('en' in node || 'fr' in node) {
      yield [path, node];
      return;
    }
    for (const [key, value] of Object.entries(node)) {
      yield* texts(value, `${path}.${key}`);
    }
  }
}

test('the store basics', () => {
  assert.equal(manifest.manifest_version, 1);
  assert.equal(manifest.type, 'weather');
  assert.equal(manifest.location, true, 'the rain watchers need the houses');
  assert.match(manifest.gladys_version, />=5\.1\.0/);
  assert.equal(manifest.docker_image, `ghcr.io/lm1lc3n7/gladys-buienradar:${manifest.version}`);
  assert.equal(manifest.version, JSON.parse(read('package.json')).version);
  for (const lang of ['en', 'fr']) {
    const length = manifest.description[lang].length;
    assert.ok(length >= 10 && length <= 100, `description.${lang}: ${length} characters`);
    const docs = read(`docs/${lang}.md`);
    assert.ok(docs.length >= 300, `docs/${lang}.md is too short for the store`);
    assert.match(docs, /Buienradar\.nl/, `docs/${lang}.md credits the source`);
  }
  assert.match(manifest.description.en, /Unofficial/);
  assert.match(manifest.description.fr, /non officiel/);
  assert.match(manifest.config_schema[0].description.en, /not affiliated with Buienradar/);
});

test('every text is bilingual', () => {
  for (const [path, text] of texts(manifest)) {
    assert.ok(text.en?.trim() && text.fr?.trim(), `${path} needs en and fr`);
  }
});

test('the configuration matches the code', () => {
  const fields = Object.fromEntries(manifest.config_schema.map((f) => [f.key, f]));
  for (const [key, value] of Object.entries(DEFAULTS)) {
    assert.equal(fields[key].default, value, key);
  }
  assert.equal(fields.rain_poll_interval.min, 5, 'Buienradar moves every 5 minutes');
  assert.deepEqual(
    fields.language.options.map((o) => o.value),
    LANGUAGES,
  );
});

test('the keys of the manifest are the keys of the code', () => {
  assert.deepEqual(manifest.actions.map((a) => a.key).sort(), Object.values(ACTIONS).sort());
  assert.deepEqual(
    manifest.scene_actions.map((a) => a.key).sort(),
    Object.values(SCENE_ACTIONS).sort(),
  );
  assert.deepEqual(
    manifest.scene_triggers.map((t) => t.key).sort(),
    Object.values(SCENE_TRIGGERS).sort(),
  );
  assert.deepEqual(manifest.widgets.map((w) => w.key).sort(), Object.values(WIDGETS).sort());
  for (const name of Object.keys(SCENE_ACTIONS)) {
    assert.ok(index.includes(`onSceneAction(SCENE_ACTIONS.${name}`), name);
  }
  assert.ok(index.includes('onWeatherGet(') && index.includes('onWeatherGetImage('));
  const trigger = manifest.scene_triggers.find((t) => t.key === SCENE_TRIGGERS.RAIN_EXPECTED);
  const option = (key) => trigger.fields.find((f) => f.key === key).options.map((o) => o.value);
  assert.deepEqual(option('minutes'), RAIN_THRESHOLDS.map(String));
  assert.deepEqual(option('intensity'), Object.keys(INTENSITIES));
  // Both filters are required: an empty one would match every threshold.
  assert.ok(trigger.fields.filter((f) => f.key !== 'house').every((f) => f.required));
  for (const key of Object.keys(RADAR_MAPS)) {
    assert.match(key, /^[a-z0-9][a-z0-9-]{0,31}$/, 'a pivot image key');
    for (const label of Object.values(T.radar[key])) {
      assert.ok(label.length <= 50 && label.includes('Buienradar.nl'), label);
    }
  }
});

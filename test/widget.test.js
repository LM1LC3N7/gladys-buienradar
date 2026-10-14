// -----------------------------------------------------------------------------
// The "rain next 2 hours" widget: valid for the core, credited, in both unit
// systems.
// -----------------------------------------------------------------------------

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateWidgetContent } from '@gladysassistant/integration-sdk';
import { T } from '../src/i18n.js';
import { parseRainText, rainOutlook } from '../src/model.js';
import { messageWidget, rainWidget } from '../src/widget.js';
import { FIXTURE_NOW, fixtureText, rainText } from './helpers/fakeFetch.js';

const house = { name: 'Home' };
const outlookOf = (text, now = FIXTURE_NOW) => rainOutlook(parseRainText(text, now), now);

test('a shower: next rain, peak, total, 24 bars and the credit', () => {
  const content = rainWidget({
    house,
    outlook: outlookOf(fixtureText('raintext-shower.txt')),
    readAt: FIXTURE_NOW,
  });
  assert.deepEqual(validateWidgetContent(content), []);
  const [heading, next, max, total, chart, caption] = content.components;
  assert.equal(heading.text.en, 'Rain · Home');
  assert.equal(next.value, 18);
  assert.equal(next.unit, 'min');
  assert.equal(max.value, 19.11);
  assert.equal(max.unit, 'mm/h');
  assert.equal(total.value, 4.07);
  assert.equal(chart.chart_type, 'bar');
  assert.equal(chart.series[0].points.length, 24);
  assert.deepEqual(chart.series[0].points[8], { t: '2026-10-14T01:35:00.000Z', v: 19.11 });
  assert.equal(caption.text.en, 'Data: Buienradar.nl · 02:56');
  assert.equal(caption.text.fr, 'Données : Buienradar.nl · 02:56');
});

test('dry, raining, and the us units', () => {
  const dry = rainWidget({
    house,
    outlook: outlookOf(fixtureText('raintext-dry.txt')),
    readAt: FIXTURE_NOW,
  });
  assert.deepEqual(validateWidgetContent(dry), []);
  assert.deepEqual(dry.components[1].value, T.widget.dry);
  const wet = rainWidget({
    house,
    outlook: outlookOf(rainText([141, 141])),
    readAt: FIXTURE_NOW,
    units: 'us',
  });
  assert.deepEqual(validateWidgetContent(wet), []);
  assert.deepEqual(wet.components[1].value, T.widget.now);
  assert.equal(wet.components[2].value, 0.39);
  assert.equal(wet.components[2].unit, 'in/h');
  assert.equal(wet.components[3].unit, 'in');
});

test('the empty states fit the vocabulary', () => {
  for (const text of [
    T.widget.noHouse,
    T.widget.outside,
    T.widget.down,
    T.widget.unknownHouse('X'),
  ]) {
    assert.deepEqual(validateWidgetContent(messageWidget(text)), []);
  }
});

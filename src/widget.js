// -----------------------------------------------------------------------------
// The "rain in the next 2 hours" dashboard widget. Pure.
// -----------------------------------------------------------------------------

import { WIDGET_COLORS } from '@gladysassistant/integration-sdk';
import { T } from './i18n.js';
import { clockText } from './model.js';
import { converters } from './pivot.js';

/** An empty or degraded state: a heading and one explanation. */
export function messageWidget(text, ttl = 300) {
  return {
    ttl_seconds: ttl,
    components: [
      { type: 'text', text: T.widget.heading, variant: 'heading' },
      { type: 'text', text, variant: 'body' },
    ],
  };
}

/** The forecast of one house: next rain, peak, total, the 5-minute bars. */
export function rainWidget({ house, outlook, readAt, units = 'metric' }) {
  const to = converters(units);
  const rate = units === 'us' ? 'in/h' : 'mm/h';
  const amount = units === 'us' ? 'in' : 'mm';
  let next;
  if (outlook.raining) {
    next = { value: T.widget.now, color: WIDGET_COLORS.INFO };
  } else if (outlook.dry) {
    next = { value: T.widget.dry, color: WIDGET_COLORS.SUCCESS };
  } else {
    next = {
      value: outlook.minutesUntilRain,
      unit: 'min',
      color: outlook.minutesUntilRain <= 15 ? WIDGET_COLORS.WARNING : WIDGET_COLORS.INFO,
    };
  }
  const components = [
    { type: 'text', text: T.widget.title(house.name), variant: 'heading' },
    { type: 'value', label: T.widget.nextRain, icon: 'cloud-rain', ...next },
    {
      type: 'value',
      label: T.widget.max,
      value: to.rain(outlook.maxIntensity),
      unit: rate,
      icon: 'droplet',
    },
    {
      type: 'value',
      label: T.widget.total,
      value: to.rain(outlook.totalMm),
      unit: amount,
      icon: 'umbrella',
    },
  ];
  if (outlook.slots.length > 0) {
    components.push({
      type: 'chart',
      chart_type: 'bar',
      title: T.widget.chart,
      unit: rate,
      now_marker: true,
      series: [
        { name: 'Buienradar', points: outlook.slots.map((s) => ({ t: s.at, v: to.rain(s.mmh) })) },
      ],
    });
  }
  // Buienradar's terms: the source is credited wherever its data shows.
  components.push({
    type: 'text',
    text: T.widget.caption(clockText(readAt)),
    variant: 'caption',
  });
  return { ttl_seconds: 300, components };
}

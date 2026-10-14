// -----------------------------------------------------------------------------
// Two consecutive rain readings of a house -> scene events. Pure.
//
// The state of a house remembers whether it rains (`wet`) and, per
// intensity, the thresholds already announced (`fired`): "rain expected
// within N minutes" fires once per dry -> rain transition, even when the
// forecast wavers around N, and is re-armed when the rain stopped or the
// forecast became dry. The first reading fires nothing: it only arms.
// -----------------------------------------------------------------------------

import { DRY_CONFIRM_MINUTES, INTENSITIES, RAIN_THRESHOLDS, SCENE_TRIGGERS } from './constants.js';
import { T } from './i18n.js';
import { clockText, firstWet, minutesTo, rainOutlook, upcomingSlots } from './model.js';

const pick = (text, language) => text[language] ?? text.en;

/** Raining now: the current slot holds at least light rain. */
export function wetNow(slots, now) {
  const [current] = upcomingSlots(slots, now);
  return Boolean(current && current.mmh >= INTENSITIES.light);
}

/** Dry now and for the next DRY_CONFIRM_MINUTES: a pause of 5 minutes is no end. */
export function dryAhead(slots, now) {
  const window = upcomingSlots(slots, now).filter((s) => s.t < now + DRY_CONFIRM_MINUTES * 60_000);
  return window.length > 0 && window.every((s) => s.mmh < INTENSITIES.light);
}

/** Per intensity, the first slot at that intensity: { minutes, t, at } or null. */
export function rainStarts(slots, now) {
  return Object.fromEntries(
    Object.entries(INTENSITIES).map(([level, min]) => {
      const slot = firstWet(slots, now, min);
      return [level, slot ? { minutes: minutesTo(slot, now), t: slot.t, at: slot.at } : null];
    }),
  );
}

/** The scene summary of an outlook: { en, fr, nl }. */
export function outlookSummary(outlook, house) {
  if (outlook.raining) {
    const dry =
      outlook.minutesUntilDry === null
        ? null
        : { time: clockText(Date.parse(outlook.dryAt)), minutes: outlook.minutesUntilDry };
    return T.summary.raining(house, outlook.maxIntensity, dry);
  }
  if (outlook.dry) {
    return T.summary.dry(house);
  }
  return T.summary.expected(
    house,
    { time: clockText(Date.parse(outlook.rainAt)), minutes: outlook.minutesUntilRain },
    outlook.maxIntensity,
  );
}

/**
 * The events of a house for a new reading, and its next state.
 *   previous: the state returned last time (undefined the first time)
 */
export function rainEvents(previous, { house, slots, now, language = 'en' }) {
  const starts = rainStarts(slots, now);
  if (!previous) {
    const fired = Object.fromEntries(
      Object.entries(starts).map(([level, start]) => [
        level,
        start ? RAIN_THRESHOLDS.filter((n) => start.minutes <= n) : [],
      ]),
    );
    return { state: { wet: wetNow(slots, now), fired }, events: [] };
  }
  const outlook = rainOutlook(slots, now);
  const events = [];
  const fired = Object.fromEntries(
    Object.keys(INTENSITIES).map((level) => [level, [...(previous.fired?.[level] ?? [])]]),
  );
  let wet = previous.wet;
  if (previous.wet && dryAhead(slots, now)) {
    wet = false;
    for (const level of Object.keys(fired)) {
      fired[level] = [];
    }
    events.push({
      key: SCENE_TRIGGERS.RAIN_STOPPED,
      data: {
        house,
        next_rain_in: outlook.minutesUntilRain,
        summary: pick(T.summary.stopped(house, outlook.minutesUntilRain), language),
      },
    });
  } else if (wetNow(slots, now)) {
    wet = true;
  }
  for (const [level, start] of Object.entries(starts)) {
    if (!start) {
      fired[level] = []; // the forecast is dry at this intensity: re-armed
      continue;
    }
    for (const threshold of RAIN_THRESHOLDS) {
      if (start.minutes > threshold || fired[level].includes(threshold)) {
        continue;
      }
      fired[level].push(threshold);
      const time = clockText(start.t);
      events.push({
        key: SCENE_TRIGGERS.RAIN_EXPECTED,
        data: {
          house,
          minutes: String(threshold),
          intensity: level,
          starts_in: start.minutes,
          start_time: time,
          starts_at: start.at,
          max_intensity: outlook.maxIntensity,
          total_mm: outlook.totalMm,
          summary: pick(
            T.summary.expected(house, { time, minutes: start.minutes }, outlook.maxIntensity),
            language,
          ),
        },
      });
    }
  }
  return { state: { wet, fired }, events };
}

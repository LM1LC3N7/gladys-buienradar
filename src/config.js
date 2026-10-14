// -----------------------------------------------------------------------------
// The configuration the user fills (manifest `config_schema`), normalized.
// -----------------------------------------------------------------------------

import { LANGUAGES } from './constants.js';

// Defaults: they MUST match the `default` values of the manifest.
export const DEFAULTS = {
  language: 'en',
  rain_poll_interval: 5,
  radar_image: true,
};

const number = (value, fallback, min, max) => {
  const n = Number(value);
  return value !== '' && value !== null && Number.isFinite(n)
    ? Math.min(max, Math.max(min, Math.round(n)))
    : fallback;
};

export function normalizeConfig(raw = {}) {
  const language = String(raw.language ?? DEFAULTS.language).toLowerCase();
  return {
    language: LANGUAGES.includes(language) ? language : DEFAULTS.language,
    // The rain forecast moves every 5 minutes: reading it faster is useless.
    rainPollMinutes: number(raw.rain_poll_interval, DEFAULTS.rain_poll_interval, 5, 60),
    radarImage: raw.radar_image !== false && raw.radar_image !== 'false',
  };
}

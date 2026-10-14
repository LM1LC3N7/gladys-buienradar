// -----------------------------------------------------------------------------
// Buienradar weather icons and descriptions -> the conditions of the Gladys
// pivot weather format, and their names. Pure.
//
// Buienradar names its icons with one letter (a to w), doubled at night
// ("bb.png"), and writes its descriptions in Dutch only. The letters come from
// python-buienradar and the Home Assistant component; a letter nobody
// documented falls back on the Dutch description.
// -----------------------------------------------------------------------------

import { WEATHER_CONDITIONS as C } from '@gladysassistant/integration-sdk';

const BY_LETTER = {
  a: C.CLEAR, // Vrijwel onbewolkt (zonnig/helder)
  b: C.PARTLY_CLOUDY, // Mix van opklaringen en middelbare of lage bewolking
  j: C.PARTLY_CLOUDY, // Mix van opklaringen en hoge bewolking
  o: C.PARTLY_CLOUDY, // Half bewolkt
  r: C.PARTLY_CLOUDY,
  c: C.CLOUD, // Zwaar bewolkt
  p: C.CLOUD,
  d: C.FOG, // Afwisselend bewolkt met lokaal mist(banken)
  n: C.FOG, // Opklaring en lokaal nevel of mist
  f: C.DRIZZLE, // Afwisselend bewolkt met (mogelijk) wat lichte regen
  k: C.DRIZZLE,
  m: C.DRIZZLE, // Zwaar bewolkt met wat lichte regen
  h: C.RAIN,
  l: C.RAIN,
  q: C.RAIN, // Zwaar bewolkt en regen
  w: C.SLEET, // Zwaar bewolkt met regen en winterse neerslag
  u: C.SNOW, // Afwisselend bewolkt met lichte sneeuwval
  i: C.SNOW,
  v: C.SNOW, // Zwaar bewolkt met lichte sneeuwval
  t: C.SNOW, // Zware sneeuwval
  g: C.THUNDERSTORM, // Opklaringen en kans op enkele pittige (onweers)buien
  s: C.THUNDERSTORM, // Bewolkt en kans op enkele pittige (onweers)buien
};

// Most specific first: "onbewolkt" contains "bewolkt", a thunder shower is
// also a shower.
const BY_WORDS = [
  [/onweer/, C.THUNDERSTORM],
  [/hagel/, C.HAIL],
  [/ijzel/, C.FREEZING_RAIN],
  [/winterse neerslag|natte sneeuw|sneeuw.*regen|regen.*sneeuw/, C.SLEET],
  [/sneeuw/, C.SNOW],
  [/motregen|lichte regen/, C.DRIZZLE],
  [/zware regen|zware buien|stortregen/, C.POURING],
  [/regen|bui/, C.RAIN],
  [/mist|nevel/, C.FOG],
  [/onbewolkt|zonnig|helder/, C.CLEAR],
  [/zwaar bewolkt|geheel bewolkt|^bewolkt/, C.CLOUD],
  [/opklaring|bewolk/, C.PARTLY_CLOUDY],
];

/** "https://…/30x30/bb.png" -> { letter: 'b', night: true }. */
export function iconOf(url) {
  const name = /\/([a-z]+)\.(?:png|gif|svg)$/i.exec(String(url ?? ''))?.[1]?.toLowerCase();
  if (!name) {
    return { letter: null, night: false };
  }
  return { letter: name[0], night: name.length === 2 && name[0] === name[1] };
}

/** The pivot condition of a Buienradar icon, or of its Dutch description. */
export function conditionOf(iconUrl, description) {
  const { letter } = iconOf(iconUrl);
  if (letter && BY_LETTER[letter]) {
    return BY_LETTER[letter];
  }
  const text = String(description ?? '').toLowerCase();
  return BY_WORDS.find(([pattern]) => pattern.test(text))?.[1] ?? C.UNKNOWN;
}

const NAMES = {
  [C.CLEAR]: { en: 'Clear', fr: 'Ciel dégagé', nl: 'Onbewolkt' },
  [C.PARTLY_CLOUDY]: { en: 'Partly cloudy', fr: 'Partiellement nuageux', nl: 'Half bewolkt' },
  [C.CLOUD]: { en: 'Cloudy', fr: 'Nuageux', nl: 'Bewolkt' },
  [C.FOG]: { en: 'Fog', fr: 'Brouillard', nl: 'Mist' },
  [C.DRIZZLE]: { en: 'Light rain', fr: 'Pluie faible', nl: 'Lichte regen' },
  [C.RAIN]: { en: 'Rain', fr: 'Pluie', nl: 'Regen' },
  [C.POURING]: { en: 'Heavy rain', fr: 'Forte pluie', nl: 'Zware regen' },
  [C.SLEET]: { en: 'Sleet', fr: 'Neige fondue', nl: 'Natte sneeuw' },
  [C.HAIL]: { en: 'Hail', fr: 'Grêle', nl: 'Hagel' },
  [C.SNOW]: { en: 'Snow', fr: 'Neige', nl: 'Sneeuw' },
  [C.THUNDERSTORM]: { en: 'Thunderstorms', fr: 'Orages', nl: 'Onweer' },
  [C.FREEZING_RAIN]: { en: 'Freezing rain', fr: 'Pluie verglaçante', nl: 'IJzel' },
  [C.UNKNOWN]: { en: 'Unknown', fr: 'Inconnu', nl: 'Onbekend' },
};

/**
 * The name of a condition in the configured language. In Dutch, Buienradar's
 * own description is more precise than our name: it wins when there is one.
 */
export function describe(condition, language = 'en', description) {
  if (language === 'nl' && description) {
    return description;
  }
  const names = NAMES[condition] ?? NAMES[C.UNKNOWN];
  return names[language] ?? names.en;
}

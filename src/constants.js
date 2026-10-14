// -----------------------------------------------------------------------------
// Constants of the Buienradar integration.
// -----------------------------------------------------------------------------

/** The public feed: the stations of the Netherlands, the 5-day forecast. */
export const FEED_URL = 'https://data.buienradar.nl/2.0/feed/json';
/** The 2-hour rain forecast of one location ("NNN|HH:MM", every 5 minutes). */
export const RAINTEXT_URL = 'https://gpsgadget.buienradar.nl/data/raintext';
/** The radar maps (a 302 to a PNG on Buienradar's CDN). */
export const RADAR_URL = 'https://image.buienradar.nl/2.0/image/single';

export const USER_AGENT = 'gladys-buienradar/0.1 (https://github.com/LM1LC3N7/gladys-buienradar)';
/** Gladys awaits the weather under 15 s: one call must fit with room to spare. */
export const HTTP_TIMEOUT = 8_000;

/** Every time Buienradar writes is the local time of the Netherlands. */
export const TIME_ZONE = 'Europe/Amsterdam';

/** Buienradar refreshes the feed every 10 minutes: never read it faster. */
export const FEED_TTL = 10 * 60_000;
/** Buienradar down: the last feed still serves the weather for this long. */
export const FEED_STALE_MAX = 60 * 60_000;
/** The rain forecast moves every 5 minutes: one read per location and per 5 minutes. */
export const RAIN_TTL = 5 * 60_000;
/** The radar maps move every 5 minutes (and the core keeps an image 10 minutes). */
export const RADAR_TTL = 5 * 60_000;
/** One raintext line every 5 minutes. */
export const RAIN_STEP = 5 * 60_000;

/** Beyond this distance from the nearest station, the location is not covered. */
export const MAX_STATION_KM = 80;
/** Houses outside this box are never sent to the rain forecast (it answers 404 anyway). */
export const BENELUX_BOX = { south: 49.4, north: 53.8, west: 2.4, east: 7.4 };

/** The radar maps offered as provider images, with the center of their country. */
export const RADAR_MAPS = {
  'radar-nl': { map: 'RadarMapRainNL', latitude: 52.2, longitude: 5.3 },
  'radar-be': { map: 'RadarMapRainBE', latitude: 50.6, longitude: 4.6 },
};
export const RADAR_MAX_BYTES = 500 * 1024;

/**
 * Rain intensities (mm/h) a scene can wait for: any rain, moderate, heavy
 * (the KNMI classes). Below 0.1 mm/h the radar sees drizzle at most: dry.
 */
export const INTENSITIES = { light: 0.1, moderate: 2.5, heavy: 10 };
/** The "rain expected within N minutes" marks a scene can wait for. */
export const RAIN_THRESHOLDS = [5, 10, 15, 30, 60, 120];
/** The rain "stopped" once the current slot and the next ones are dry for this long. */
export const DRY_CONFIRM_MINUTES = 15;

export const LANGUAGES = ['en', 'fr', 'nl'];

/** Manifest keys (forever: stored in user scenes and dashboards). */
export const ACTIONS = { TEST: 'test_connection' };
export const SCENE_ACTIONS = { RAIN_FORECAST: 'get_rain_forecast' };
export const SCENE_TRIGGERS = { RAIN_EXPECTED: 'rain_expected', RAIN_STOPPED: 'rain_stopped' };
export const WIDGETS = { RAIN: 'rain_forecast' };

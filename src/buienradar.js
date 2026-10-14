// -----------------------------------------------------------------------------
// The Buienradar client: the feed, the 2-hour rain forecast of a location and
// the radar maps, as raw answers. Turning them into weather is src/model.js's
// job. No key, no account: every endpoint is public.
// -----------------------------------------------------------------------------

import { FEED_URL, RADAR_URL, RAINTEXT_URL } from './constants.js';
import { getBytes, getJson, getText } from './http.js';

/** Two decimals (about 1 km): enough for the radar, and the house stays vague. */
export const roundCoordinate = (value) => Math.round(Number(value) * 100) / 100;

export class BuienradarClient {
  constructor({ feedUrl = FEED_URL, raintextUrl = RAINTEXT_URL, radarUrl = RADAR_URL } = {}) {
    this.feedUrl = feedUrl;
    this.raintextUrl = raintextUrl;
    this.radarUrl = radarUrl;
  }

  /** The whole feed: `actual` (stations, sun) and `forecast` (report, 5 days). */
  async feed() {
    return getJson(this.feedUrl);
  }

  /**
   * The raintext of a location: 24 lines "NNN|HH:MM". Buienradar answers 404
   * ("location must be inside the Netherlands or Belgium") elsewhere.
   */
  async rainText(latitude, longitude) {
    const search = new URLSearchParams({
      lat: roundCoordinate(latitude).toFixed(2),
      lon: roundCoordinate(longitude).toFixed(2),
    });
    return getText(`${this.raintextUrl}?${search}`);
  }

  /** One radar map (RadarMapRainNL, RadarMapRainBE) as PNG bytes. */
  async radarMap(map) {
    const search = new URLSearchParams({
      height: '512',
      width: '500',
      renderBackground: 'True',
      renderBranding: 'False',
      renderText: 'True',
    });
    return getBytes(`${this.radarUrl}/${map}?${search}`);
  }
}

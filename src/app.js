// -----------------------------------------------------------------------------
// The integration itself: the weather of a location (feed cached 10
// minutes), the radar maps, the rain watchers of the located houses (one
// raintext read per house every 5 minutes), the scene triggers, the scene
// action, the widget and the test button. index.js only wires the SDK
// handlers to it.
// -----------------------------------------------------------------------------

import { createLogger } from '@gladysassistant/integration-sdk';
import { BuienradarClient, roundCoordinate } from './buienradar.js';
import { describe } from './conditions.js';
import { normalizeConfig } from './config.js';
import {
  BENELUX_BOX,
  FEED_STALE_MAX,
  FEED_TTL,
  MAX_STATION_KM,
  RADAR_MAPS,
  RADAR_MAX_BYTES,
  RADAR_TTL,
  RAIN_TTL,
  WIDGETS,
} from './constants.js';
import { HttpError } from './http.js';
import { T, decimal } from './i18n.js';
import {
  clockText,
  currentConditions,
  distanceKm,
  forecastDays,
  parseRainText,
  rainOutlook,
  weatherReport,
} from './model.js';
import { toPivot } from './pivot.js';
import { outlookSummary, rainEvents } from './triggers.js';
import { messageWidget, rainWidget } from './widget.js';

const defaultTimers = { setInterval, clearInterval };

/** Thrown to the core when a location is outside Buienradar's coverage. */
export class OutsideCoverageError extends Error {
  constructor(message = T.outsideError) {
    super(message);
    this.name = 'OutsideCoverageError';
  }
}

const inBox = (lat, lon) =>
  lat >= BENELUX_BOX.south &&
  lat <= BENELUX_BOX.north &&
  lon >= BENELUX_BOX.west &&
  lon <= BENELUX_BOX.east;

const coordinate = (value) => (value === null || value === undefined ? NaN : Number(value));

/** The location of a house as Buienradar sees it (2 decimals). */
const locationKey = (house) =>
  `${roundCoordinate(house.latitude)},${roundCoordinate(house.longitude)}`;

/** PNG or JPEG magic numbers: the core refuses anything else. */
const isImage = (bytes) =>
  bytes.length > 8 &&
  ((bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) ||
    (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff));

export class BuienradarApp {
  constructor({
    gladys,
    logger = createLogger({ name: 'buienradar' }),
    now = Date.now,
    timers = defaultTimers,
  }) {
    this.gladys = gladys;
    this.logger = logger;
    this.now = now;
    this.timers = timers;
    this.config = normalizeConfig();
    this.client = new BuienradarClient();
    this.feedCache = undefined;
    this.feedLoading = undefined;
    /** "lat,lon" (2 decimals) -> { at, slots } */
    this.rainCache = new Map();
    this.rainLoading = new Map();
    /** Locations Buienradar refused (404): outside its coverage for good. */
    this.refused = new Set();
    /** image key -> { at, base64 } */
    this.radarCache = new Map();
    /** The located houses: { name, selector, latitude, longitude, outside }. */
    this.houses = [];
    /** house selector -> trigger state (src/triggers.js) */
    this.trackers = new Map();
    this.health = { feed: 'ok', rain: 'ok' };
    this.pollTimer = undefined;
    this.polling = undefined;
    this.lastStatus = undefined;
    this.generation = 0;
  }

  // --- Lifecycle -------------------------------------------------------------

  async start(raw = {}) {
    this.stop();
    const generation = ++this.generation;
    this.config = normalizeConfig(raw);
    this.trackers.clear();
    this.radarCache.clear();
    this.health.rain = 'ok';
    this.lastStatus = undefined;
    // A check of the previous configuration still running: let it end first.
    await this.polling?.catch(() => {});
    await this.loadHouses();
    await this.pollRain();
    if (generation !== this.generation) {
      return;
    }
    this.pollTimer = this.timers.setInterval(
      () => this.pollRain().catch((err) => this.logger.warn(`Rain check failed: ${err.message}`)),
      this.config.rainPollMinutes * 60_000,
    );
  }

  stop() {
    this.generation += 1;
    this.timers.clearInterval(this.pollTimer);
    this.pollTimer = undefined;
  }

  async setStatus(connected, message) {
    const key = JSON.stringify([connected, message ?? null]);
    if (key === this.lastStatus) {
      return;
    }
    this.lastStatus = key;
    await this.gladys
      .setConnectionStatus(connected, message)
      .catch((err) => this.logger.warn(`setConnectionStatus failed: ${err.message}`));
  }

  /** One status from the health of the sources and the coverage of the houses. */
  async refreshStatus() {
    if (this.health.feed !== 'ok') {
      return this.setStatus(false, T.feedDown(this.health.feed));
    }
    if (this.health.rain !== 'ok') {
      return this.setStatus(false, T.rainDown(this.health.rain));
    }
    if (this.houses.length === 0) {
      return this.setStatus(true, T.noHouse);
    }
    const covered = this.houses.filter((h) => !h.outside).length;
    if (covered === 0) {
      return this.setStatus(false, T.allOutside);
    }
    const message = T.ok(covered);
    const outside = this.houses.length - covered;
    if (outside > 0) {
      const extra = T.someOutside(outside);
      message.en += extra.en;
      message.fr += extra.fr;
    }
    return this.setStatus(true, message);
  }

  // --- Houses ---------------------------------------------------------------------

  /** The located houses (`location: true`); a house without coordinates is skipped. */
  async loadHouses() {
    let houses = [];
    try {
      houses = (await this.gladys.getHouses()) ?? [];
    } catch (err) {
      this.logger.warn(`Houses unavailable (location not granted?): ${err.message}`);
    }
    const located = houses
      .map((h) => ({
        name: String(h.name ?? h.selector ?? '?'),
        selector: h.selector ?? String(h.id),
        latitude: coordinate(h.latitude),
        longitude: coordinate(h.longitude),
      }))
      .filter((h) => Number.isFinite(h.latitude) && Number.isFinite(h.longitude));
    // A house far from the Benelux, or refused once, is never sent to Buienradar.
    this.houses = located.map((h) => ({
      ...h,
      outside: !inBox(h.latitude, h.longitude) || this.refused.has(locationKey(h)),
    }));
  }

  /** The house of a scene action or a widget: by name, or the first covered one. */
  async pickHouse(name) {
    if (this.houses.length === 0) {
      await this.loadHouses();
    }
    if (this.houses.length === 0) {
      return { reason: 'none' };
    }
    const wanted = String(name ?? '')
      .trim()
      .toLowerCase();
    const house = wanted
      ? this.houses.find((h) => h.name.trim().toLowerCase() === wanted)
      : (this.houses.find((h) => !h.outside) ?? this.houses[0]);
    return house ? { house } : { reason: 'unknown' };
  }

  // --- Weather (onWeatherGet) ------------------------------------------------------

  /** The feed, read at most once per FEED_TTL; a stale one bridges an outage. */
  async feed() {
    const now = this.now();
    if (this.feedCache && now - this.feedCache.at < FEED_TTL) {
      return this.feedCache.feed;
    }
    if (!this.feedLoading) {
      this.feedLoading = this.client
        .feed()
        .then((feed) => {
          if (!Array.isArray(feed?.actual?.stationmeasurements)) {
            throw new Error('the feed holds no station');
          }
          this.feedCache = { feed, at: now };
          return feed;
        })
        .finally(() => {
          this.feedLoading = undefined;
        });
    }
    try {
      const feed = await this.feedLoading;
      this.health.feed = 'ok';
      return feed;
    } catch (err) {
      this.health.feed = err.message;
      await this.refreshStatus();
      if (this.feedCache && now - this.feedCache.at < FEED_STALE_MAX) {
        this.logger.warn(`Feed unavailable (${err.message}): serving the last one`);
        return this.feedCache.feed;
      }
      throw err;
    }
  }

  /** The radar maps of the payload, the one of the house's country first. */
  imagesFor(latitude, longitude) {
    if (!this.config.radarImage) {
      return [];
    }
    return Object.entries(RADAR_MAPS)
      .map(([key, map]) => ({
        key,
        km: distanceKm(latitude, longitude, map.latitude, map.longitude),
      }))
      .sort((a, b) => a.km - b.km)
      .map(({ key }) => ({ key, label: T.radar[key] }));
  }

  async getWeather({ latitude, longitude, units } = {}) {
    const lat = coordinate(latitude);
    const lon = coordinate(longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
      throw new Error('The weather request carries no coordinates.');
    }
    const feed = await this.feed();
    await this.refreshStatus();
    const now = this.now();
    const current = currentConditions(feed, { latitude: lat, longitude: lon, now });
    if (!current) {
      throw new OutsideCoverageError();
    }
    return toPivot(
      { current, days: forecastDays(feed), images: this.imagesFor(lat, lon), now },
      units === 'us' ? 'us' : 'metric',
    );
  }

  /** onWeatherGetImage: the raw base64 of a radar map. */
  async getImage(key) {
    const map = RADAR_MAPS[key];
    if (!map) {
      throw new Error(`Unknown image "${key}"`);
    }
    const now = this.now();
    const cached = this.radarCache.get(key);
    if (cached && now - cached.at < RADAR_TTL) {
      return cached.base64;
    }
    const { bytes } = await this.client.radarMap(map.map);
    if (!isImage(bytes)) {
      throw new Error('Buienradar did not send a PNG or JPEG radar map');
    }
    if (bytes.length > RADAR_MAX_BYTES) {
      throw new Error(`The radar map weighs ${Math.round(bytes.length / 1024)} KB, over 500 KB`);
    }
    const base64 = bytes.toString('base64');
    this.radarCache.set(key, { at: now, base64 });
    return base64;
  }

  // --- Rain (raintext) -------------------------------------------------------------

  /** The 2-hour forecast of a house, read at most once per RAIN_TTL per location. */
  async rain(house) {
    const key = locationKey(house);
    const now = this.now();
    const cached = this.rainCache.get(key);
    if (cached && now - cached.at < RAIN_TTL) {
      return cached;
    }
    if (!this.rainLoading.has(key)) {
      const loading = this.client
        .rainText(house.latitude, house.longitude)
        .then((text) => {
          const entry = { at: now, slots: parseRainText(text, now) };
          if (entry.slots.length === 0) {
            throw new Error('the rain forecast is empty');
          }
          this.rainCache.set(key, entry);
          return entry;
        })
        .catch((err) => {
          // 404 "location must be inside the Netherlands or Belgium".
          if (err instanceof HttpError && err.status === 404) {
            this.refused.add(key);
            throw new OutsideCoverageError();
          }
          throw err;
        })
        .finally(() => this.rainLoading.delete(key));
      this.rainLoading.set(key, loading);
    }
    return this.rainLoading.get(key);
  }

  pollRain() {
    if (!this.polling) {
      this.polling = this.doPollRain().finally(() => {
        this.polling = undefined;
      });
    }
    return this.polling;
  }

  async doPollRain() {
    const generation = this.generation;
    let failure;
    let read = 0;
    for (const house of this.houses) {
      if (house.outside) {
        continue;
      }
      if (generation !== this.generation) {
        return;
      }
      try {
        await this.watchHouse(house);
        read += 1;
      } catch (err) {
        if (err instanceof OutsideCoverageError) {
          // Buienradar said so: never asked again (see `refused`).
          house.outside = true;
          this.logger.info(`${house.name} is outside the Buienradar rain forecast`);
        } else {
          failure = err;
          this.logger.warn(`Rain forecast of ${house.name} failed: ${err.message}`);
        }
      }
    }
    this.health.rain = failure ? failure.message : 'ok';
    if (read > 0) {
      this.gladys.requestWidgetRefresh(WIDGETS.RAIN);
    }
    await this.refreshStatus();
  }

  async watchHouse(house) {
    const entry = await this.rain(house);
    const { state, events } = rainEvents(this.trackers.get(house.selector), {
      house: house.name,
      slots: entry.slots,
      now: this.now(),
      language: this.config.language,
    });
    this.trackers.set(house.selector, state);
    for (const event of events) {
      await this.gladys
        .publishSceneEvent(event.key, event.data)
        .catch((err) => this.logger.warn(`Scene event ${event.key} failed: ${err.message}`));
    }
  }

  // --- Scene action -----------------------------------------------------------------

  async getRainForecast(fields = {}) {
    const { house, reason } = await this.pickHouse(fields.house);
    if (!house) {
      throw new Error(reason === 'none' ? T.noLocatedHouse : T.unknownHouse(fields.house));
    }
    let entry;
    try {
      if (house.outside) {
        throw new OutsideCoverageError();
      }
      entry = await this.rain(house);
    } catch (err) {
      if (err instanceof OutsideCoverageError) {
        house.outside = true;
        throw new Error(T.houseOutside(house.name), { cause: err });
      }
      throw err;
    }
    const outlook = rainOutlook(entry.slots, this.now());
    const summary = outlookSummary(outlook, house.name);
    return {
      house: house.name,
      dry: outlook.dry,
      raining: outlook.raining,
      minutes_until_rain: outlook.minutesUntilRain,
      rain_time: outlook.rainAt ? clockText(Date.parse(outlook.rainAt)) : null,
      minutes_until_dry: outlook.minutesUntilDry,
      max_intensity: outlook.maxIntensity,
      total_mm: outlook.totalMm,
      summary: summary[this.config.language] ?? summary.en,
    };
  }

  // --- Widget ---------------------------------------------------------------------

  async getWidget(_key, { settings = {}, units } = {}) {
    const { house, reason } = await this.pickHouse(settings.house);
    if (!house) {
      return messageWidget(
        reason === 'none' ? T.widget.noHouse : T.widget.unknownHouse(String(settings.house)),
      );
    }
    if (house.outside) {
      return messageWidget(T.widget.outside, 3600);
    }
    try {
      const entry = await this.rain(house);
      return rainWidget({
        house,
        outlook: rainOutlook(entry.slots, this.now()),
        readAt: entry.at,
        units: units === 'us' ? 'us' : 'metric',
      });
    } catch (err) {
      if (err instanceof OutsideCoverageError) {
        house.outside = true;
        return messageWidget(T.widget.outside, 3600);
      }
      this.logger.warn(`Rain widget of ${house.name}: ${err.message}`);
      return messageWidget(T.widget.down, 60);
    }
  }

  // --- Configuration screen button ---------------------------------------------------

  async testConnection() {
    let feed;
    try {
      feed = await this.feed();
    } catch (err) {
      return T.feedDown(err.message);
    }
    const now = this.now();
    const report = weatherReport(feed);
    const stations = feed.actual.stationmeasurements.length;
    const lines = {
      en: [
        `Buienradar answers: ${stations} stations${report ? `, report "${report.title}"` : ''}.`,
      ],
      fr: [
        `Buienradar répond : ${stations} stations${report ? `, bulletin « ${report.title} »` : ''}.`,
      ],
    };
    await this.loadHouses();
    if (this.houses.length === 0) {
      lines.en.push(T.noHouse.en);
      lines.fr.push(T.noHouse.fr);
    }
    for (const house of this.houses) {
      const current = currentConditions(feed, { ...house, now });
      if (current) {
        const line = (lang) =>
          `station ${current.station} (${decimal(current.distanceKm, lang)} km), ${decimal(current.temperature, lang)} °C, ${describe(current.condition, lang)}.`;
        lines.en.push(`${house.name}: ${line('en')}`);
        lines.fr.push(`${house.name} : ${line('fr')}`);
      } else {
        lines.en.push(`${house.name}: no Buienradar station within ${MAX_STATION_KM} km.`);
        lines.fr.push(`${house.name} : aucune station Buienradar à moins de ${MAX_STATION_KM} km.`);
      }
      if (house.outside) {
        lines.en.push(`  ${T.widget.outside.en}`);
        lines.fr.push(`  ${T.widget.outside.fr}`);
        continue;
      }
      try {
        const summary = outlookSummary(
          rainOutlook((await this.rain(house)).slots, now),
          house.name,
        );
        lines.en.push(`  ${summary.en}`);
        lines.fr.push(`  ${summary.fr}`);
      } catch (err) {
        const outside = err instanceof OutsideCoverageError;
        house.outside ||= outside;
        lines.en.push(`  ${outside ? T.widget.outside.en : T.rainDown(err.message).en}`);
        lines.fr.push(`  ${outside ? T.widget.outside.fr : T.rainDown(err.message).fr}`);
      }
    }
    await this.refreshStatus();
    return { en: lines.en.join('\n'), fr: lines.fr.join('\n') };
  }
}

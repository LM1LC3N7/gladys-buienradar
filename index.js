// -----------------------------------------------------------------------------
// Entry point: SDK wiring only. Every handler is registered BEFORE connect(),
// and delegates to the BuienradarApp (src/app.js).
//
// Environment variables provided by the Gladys supervisor, read by the SDK:
// GLADYS_HOST_API_URL, GLADYS_INTEGRATION_TOKEN, GLADYS_INTEGRATION_SELECTOR.
// -----------------------------------------------------------------------------

import { GladysIntegration, logger } from '@gladysassistant/integration-sdk';
import { BuienradarApp } from './src/app.js';
import { ACTIONS, SCENE_ACTIONS, WIDGETS } from './src/constants.js';

const gladys = new GladysIntegration();
const app = new BuienradarApp({ gladys });

// --- Weather provider (manifest type "weather") ----------------------------------
// Answered under 15 s; the feed cache (10 min) keeps it far below in practice.
gladys.onWeatherGet((options) => app.getWeather(options));
gladys.onWeatherGetImage((key) => app.getImage(key));

// --- Scene actions --------------------------------------------------------------
gladys.onSceneAction(SCENE_ACTIONS.RAIN_FORECAST, (fields) => app.getRainForecast(fields));

// --- Dashboard widgets ----------------------------------------------------------
for (const key of Object.values(WIDGETS)) {
  gladys.onWidgetGet(key, (request) => app.getWidget(key, request));
}

// --- Configuration screen buttons ----------------------------------------------
gladys.onAction(ACTIONS.TEST, () => app.testConnection());

// --- Configuration changed by the user ----------------------------------------
gladys.onConfigUpdated(async (config) => {
  logger.info('Configuration updated: restarting');
  await app.start(config);
  // The radar option changes the images of the weather: re-pull it.
  gladys.requestWeatherRefresh();
});

// --- Connection lifecycle ------------------------------------------------------
gladys.on('connected', async () => {
  try {
    await app.start(await gladys.getConfig());
  } catch (err) {
    logger.error('Start failed', err);
  }
});
gladys.on('disconnected', () => app.stop());
gladys.handleShutdown(() => app.stop());

logger.info('Starting the Buienradar integration...');
gladys.connect().catch((err) => {
  logger.error('Initial connection failed', err);
  process.exit(1);
});

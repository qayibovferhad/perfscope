import { createApp } from './app.js';
import { config, validateConfig } from './config/index.js';
import { installChromeReaper } from './lib/chromeReaper.js';
import { connectDatabase } from './config/database.js';
import { registerNightlyCron } from './cron/nightlyAudit.cron.js';

validateConfig();
installChromeReaper();

await connectDatabase(config.mongoUri).catch(err => {
  console.warn('[Database] MongoDB unavailable — history will be skipped:', (err as Error).message);
});

const { httpServer } = createApp();

httpServer.listen(config.port, () => {
  console.log(`[Server] Running on http://localhost:${config.port}`);
  console.log(`[Server] WebSocket ready`);
  console.log(`[Server] Environment: ${config.nodeEnv}`);
  registerNightlyCron();
});

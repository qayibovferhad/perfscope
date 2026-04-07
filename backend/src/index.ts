import { createApp } from './app.js';
import { config, validateConfig } from './config/index.js';

validateConfig();

const { httpServer } = createApp();

httpServer.listen(config.port, () => {
  console.log(`[Server] Running on http://localhost:${config.port}`);
  console.log(`[Server] WebSocket ready`);
  console.log(`[Server] Environment: ${config.nodeEnv}`);
});

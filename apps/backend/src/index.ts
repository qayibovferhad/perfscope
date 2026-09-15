import { createApp } from './app.js';
import { config, validateConfig } from './config/index.js';
import { installChromeReaper } from './lib/chromeReaper.js';
import { connectDatabase, retryDatabase } from './config/database.js';
import { registerNightlyCron } from './cron/nightlyAudit.cron.js';
import { registerDigestCron } from './cron/digest.cron.js';
import { registerFlowCron } from './cron/flowRuns.cron.js';
import { registerRumBudgetCron } from './cron/rumBudget.cron.js';
import { configureLogger, log, loggerSettings } from './lib/logger.js';
import { initErrorReporting, flushErrorReporting } from './lib/errorReporting.js';

// Before anything that might log: the first lines of a boot are the ones read when a boot
// goes wrong.
configureLogger({ level: config.logLevel, format: config.logFormat });
await initErrorReporting();

validateConfig();
installChromeReaper();

/**
 * A crash still gets to say what happened.
 *
 * Node prints an unhandled rejection and exits; in a container that line is the last thing
 * anyone sees, and it arrives in a different shape from every other line. Routing both
 * through `log.error` means the same JSON, the same fields, and — with a DSN configured —
 * a report, flushed before the process goes.
 *
 * `uncaughtException` exits deliberately. The process is in an unknown state after one,
 * and a restart by the orchestrator is the honest response; `unhandledRejection` is left
 * running, because in this server they come from fire-and-forget work (an alert webhook,
 * an AI enrichment) whose failure is not the server's death.
 */
process.on('unhandledRejection', (reason) => {
  log.error('Process', 'unhandled promise rejection', { err: reason });
});

process.on('uncaughtException', (err) => {
  log.error('Process', 'uncaught exception — exiting', { err });
  void flushErrorReporting().finally(() => process.exit(1));
});

/** SIGTERM is how a container is asked to stop; anything queued should still be sent. */
for (const signal of ['SIGTERM', 'SIGINT'] as const) {
  process.on(signal, () => {
    log.info('Server', 'shutting down', { signal });
    void flushErrorReporting().finally(() => process.exit(0));
  });
}

await connectDatabase(config.mongoUri).catch(err => {
  log.warn('Database', 'MongoDB unavailable — history will be skipped', { err });
  // Mongoose only self-heals a connection that succeeded once, so poll until it does.
  retryDatabase(config.mongoUri);
});

const { httpServer } = createApp();

httpServer.listen(config.port, () => {
  const { level, format } = loggerSettings();
  log.info('Server', 'listening', {
    url:         `http://localhost:${config.port}`,
    environment: config.nodeEnv,
    version:     config.appVersion,
    logs:        `${format}/${level}`,
  });
  log.info('Server', 'WebSocket ready');
  registerNightlyCron();
  registerDigestCron();
  registerFlowCron();
  registerRumBudgetCron();
});

/** Chrome launch flags for headless audit instances (service main thread + workers). */
export const CHROME_ARGS = [
  '--no-sandbox',
  '--disable-setuid-sandbox',
  '--disable-dev-shm-usage',
  '--disable-gpu',
  '--disable-background-timer-throttling',
  '--disable-renderer-backgrounding',
  '--disable-backgrounding-occluded-windows',
];

/**
 * Flags for the VISIBLE auth-audit browser the user logs in with — deliberately
 * without the gpu/backgrounding flags so the window behaves like a normal Chrome.
 */
export const VISIBLE_CHROME_ARGS = [
  '--no-sandbox',
  '--disable-setuid-sandbox',
  '--disable-dev-shm-usage',
];

import 'dotenv/config';

function requireEnv(key: string): string {
  const value = process.env[key];
  if (!value) throw new Error(`Missing required environment variable: ${key}`);
  return value;
}

function optionalEnv(key: string, fallback: string): string {
  return process.env[key] ?? fallback;
}

export const config = {
  port:        parseInt(optionalEnv('PORT', '3101'), 10),
  clientUrl:   optionalEnv('CLIENT_URL', 'http://localhost:5173'),
  nodeEnv:     optionalEnv('NODE_ENV', 'development'),
  geminiApiKey: process.env['GEMINI_API_KEY'],
  /** Chrome UX Report field data is disabled unless this is set. */
  cruxApiKey:  process.env['CRUX_API_KEY'],
  mongoUri:    optionalEnv('MONGODB_URI', 'mongodb://localhost:27017/perfscope'),
  jwtSecret:   optionalEnv('JWT_SECRET', 'perfscope-dev-secret-change-in-prod'),

  /**
   * Audits running at once. Each owns a Chrome instance, and Lighthouse numbers
   * degrade when runs compete for CPU — so this is a measurement-accuracy knob,
   * not just a resource limit.
   */
  maxConcurrentAudits: Math.max(1, parseInt(optionalEnv('MAX_CONCURRENT_AUDITS', '2'), 10) || 2),

  /** Email alerts are disabled unless SMTP_HOST is set. */
  smtp: {
    host:   process.env['SMTP_HOST'],
    port:   parseInt(optionalEnv('SMTP_PORT', '587'), 10),
    secure: optionalEnv('SMTP_SECURE', 'false') === 'true',
    user:   process.env['SMTP_USER'],
    pass:   process.env['SMTP_PASS'],
    from:   optionalEnv('SMTP_FROM', 'PerfScope Alerts <alerts@perfscope.local>'),
  },
} as const;

export function validateConfig(): void {
  if (!config.geminiApiKey) {
    console.warn('[Config] GEMINI_API_KEY not found — AI insights will be disabled');
  }
}

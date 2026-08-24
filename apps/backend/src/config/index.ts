import 'dotenv/config';

function optionalEnv(key: string, fallback: string): string {
  return process.env[key] ?? fallback;
}

export const config = {
  port:        parseInt(optionalEnv('PORT', '3101'), 10),
  clientUrl:   optionalEnv('CLIENT_URL', 'http://localhost:5173'),
  nodeEnv:     optionalEnv('NODE_ENV', 'development'),
  geminiApiKey: process.env['GEMINI_API_KEY'],
  /**
   * Which Gemini model every prompt runs on. An env var rather than a constant because
   * moving tiers is an operational decision measured with `probes/model-tier.probe.mts`
   * — see docs/ai/PLAN.md phase 5: no model change ships without that number.
   * Rolling aliases only; pinned versions get retired and 404 silently.
   */
  geminiModel: optionalEnv('GEMINI_MODEL', 'gemini-flash-lite-latest'),
  /** Must match the client id the dashboard signs in with: it is what proves a Google
   *  token was issued for this app and not obtained by some other site. */
  googleClientId: process.env['GOOGLE_CLIENT_ID'],
  /** Chrome UX Report field data is disabled unless this is set. */
  cruxApiKey:  process.env['CRUX_API_KEY'],
  mongoUri:    optionalEnv('MONGODB_URI', 'mongodb://localhost:27017/perfscope'),

  /**
   * Whether a URL that resolves into a private network may be fetched by this server.
   *
   * Off on a laptop, where auditing `http://localhost:5173` is the ordinary case and always
   * has been; on in production, where the same feature is a request-forgery primitive
   * pointed at cloud metadata and internal admin panels. `ALLOW_PRIVATE_TARGETS=true` turns
   * it off again for an install that deliberately audits an intranet — a real deployment,
   * so it gets a switch rather than a code change. See lib/ssrf.ts.
   */
  blockPrivateTargets:
    optionalEnv('NODE_ENV', 'development') === 'production' &&
    optionalEnv('ALLOW_PRIVATE_TARGETS', 'false') !== 'true',
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
  if (!config.googleClientId) {
    console.warn('[Config] GOOGLE_CLIENT_ID not set — Google sign-in still works, but tokens cannot be checked against this app');
  }
}

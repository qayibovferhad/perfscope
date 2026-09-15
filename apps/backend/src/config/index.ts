import 'dotenv/config';
import { log } from '../lib/logger.js';

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

  /**
   * How much gets logged, and in what shape. `text` is the human format this server always
   * printed; `json` is one object per line, which is the only form a log collector can
   * filter. Production defaults to json/info, a laptop to text/debug — see lib/logger.ts.
   */
  logLevel:    optionalEnv('LOG_LEVEL', optionalEnv('NODE_ENV', 'development') === 'production' ? 'info' : 'debug'),
  logFormat:   (optionalEnv('LOG_FORMAT', optionalEnv('NODE_ENV', 'development') === 'production' ? 'json' : 'text') === 'json'
    ? 'json' : 'text') as 'json' | 'text',

  /**
   * How many reverse proxies sit in front of this server.
   *
   * With this unset Express reports the *proxy's* address as `req.ip`, so a containerised
   * install logs its own nginx for every request. `1` means "trust the last hop", which is
   * the deployment's own nginx; trusting the whole `X-Forwarded-For` chain would let a
   * caller write any address it likes into the log. `false` (the development default) is
   * correct when nothing is in front.
   */
  trustProxy:  (() => {
    const raw = optionalEnv('TRUST_PROXY', optionalEnv('NODE_ENV', 'development') === 'production' ? '1' : '0');
    const hops = parseInt(raw, 10);
    return Number.isFinite(hops) && hops > 0 ? hops : false;
  })(),

  /**
   * Guards `/metrics` when set. Unset is the ordinary case: the dashboard's nginx does not
   * proxy that path, so on the standard deployment the endpoint exists only inside the
   * compose network. An install that publishes the backend port wants this.
   */
  metricsToken: process.env['METRICS_TOKEN'],

  /** Error reporting is disabled unless this is set. See lib/errorReporting.ts. */
  sentryDsn:   process.env['SENTRY_DSN'],

  /**
   * Which build is running. Stamped into the image at release time and reported by
   * `/health`; also the release an error is filed against.
   */
  appVersion:  optionalEnv('APP_VERSION', process.env['npm_package_version'] ?? '1.0.0'),

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
    log.warn('Config', 'GEMINI_API_KEY not found — AI insights will be disabled');
  }
  if (!config.googleClientId) {
    log.warn('Config', 'GOOGLE_CLIENT_ID not set — Google sign-in still works, but tokens cannot be checked against this app');
  }
}

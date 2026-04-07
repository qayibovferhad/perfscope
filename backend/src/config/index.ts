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
  port: parseInt(optionalEnv('PORT', '3101'), 10),
  clientUrl: optionalEnv('CLIENT_URL', 'http://localhost:5173'),
  nodeEnv: optionalEnv('NODE_ENV', 'development'),
  geminiApiKey: process.env['GEMINI_API_KEY'],

  get isDev(): boolean {
    return this.nodeEnv === 'development';
  },
} as const;

export function validateConfig(): void {
  if (!config.geminiApiKey) {
    console.warn('[Config] GEMINI_API_KEY not found — AI insights will be disabled');
  }
}

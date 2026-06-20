import { readFileSync, writeFileSync, mkdirSync, existsSync, rmSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

const CONFIG_DIR = join(homedir(), '.config', 'perfscope');
const CREDS_FILE = join(CONFIG_DIR, 'credentials.json');

export function getConfigPath() {
  return CREDS_FILE;
}

export function loadCredentials() {
  try {
    if (!existsSync(CREDS_FILE)) return null;
    return JSON.parse(readFileSync(CREDS_FILE, 'utf8'));
  } catch {
    return null;
  }
}

export function saveCredentials(token, email) {
  mkdirSync(CONFIG_DIR, { recursive: true });
  writeFileSync(
    CREDS_FILE,
    JSON.stringify({ token, email, savedAt: new Date().toISOString() }, null, 2),
    { mode: 0o600 },
  );
}

export function clearCredentials() {
  if (existsSync(CREDS_FILE)) rmSync(CREDS_FILE);
}

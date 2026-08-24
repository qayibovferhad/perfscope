import { readFileSync, writeFileSync, mkdirSync, existsSync, rmSync } from 'fs';
import { join } from 'path';
import { homedir, platform } from 'os';

function getConfigDir() {
  const home = homedir();
  switch (platform()) {
    case 'win32':  return join(process.env.APPDATA ?? join(home, 'AppData', 'Roaming'), 'perfscope');
    case 'darwin': return join(home, 'Library', 'Application Support', 'perfscope');
    default:       return join(process.env.XDG_CONFIG_HOME ?? join(home, '.config'), 'perfscope');
  }
}

const CONFIG_DIR = getConfigDir();
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

/**
 * Store the session.
 *
 * Takes the whole pair rather than a token: access tokens live thirty minutes now, so what
 * is worth persisting is the refresh token that renews them — see session.js. Accepts a
 * bare string as well, so an older caller (or an older backend that answers without a
 * refresh token) still writes a usable file.
 */
export function saveCredentials(tokens, email) {
  const { token, refreshToken = null } = typeof tokens === 'string' ? { token: tokens } : tokens;

  mkdirSync(CONFIG_DIR, { recursive: true });
  writeFileSync(
    CREDS_FILE,
    JSON.stringify({ token, refreshToken, email, savedAt: new Date().toISOString() }, null, 2),
    // 0o600 = only owner can read/write (ignored on Windows, handled by NTFS ACL)
    { mode: 0o600 },
  );
}

export function clearCredentials() {
  if (existsSync(CREDS_FILE)) rmSync(CREDS_FILE);
}

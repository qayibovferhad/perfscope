import net from 'node:net';

/** Where the browser half of `perfscope login` lives — the local dev server if one is up. */

const PROD_URL  = 'https://app.perfscope.com';
const LOCAL_URL = 'http://127.0.0.1:5173';

export function probeLocal() {
  return new Promise(resolve => {
    const sock = net.createConnection({ host: '127.0.0.1', port: 5173 });
    sock.setTimeout(1200);
    sock.on('connect', () => { sock.destroy(); resolve(LOCAL_URL); });
    sock.on('error',   () => resolve(PROD_URL));
    sock.on('timeout', () => { sock.destroy(); resolve(PROD_URL); });
  });
}

export async function resolveAppUrl(explicit) {
  if (explicit && explicit !== PROD_URL) return explicit.replace(/\/$/, '');
  return probeLocal();
}

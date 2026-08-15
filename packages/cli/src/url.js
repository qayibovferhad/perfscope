/** Recognising local addresses, so a localhost audit knows it needs a tunnel. */

const LOCAL_HOSTS = [
  /^localhost$/i,
  /^127\.\d+\.\d+\.\d+$/,
  /^::1$/,
  /^0\.0\.0\.0$/,
  /^10\.\d+\.\d+\.\d+$/,
  /^172\.(1[6-9]|2\d|3[01])\.\d+\.\d+$/,
  /^192\.168\.\d+\.\d+$/,
];

export function isLocal(urlStr) {
  try {
    const { hostname } = new URL(urlStr);
    return LOCAL_HOSTS.some(r => r.test(hostname));
  } catch {
    return false;
  }
}

export function portOf(urlStr) {
  try {
    const u = new URL(urlStr);
    if (u.port) return parseInt(u.port, 10);
    return u.protocol === 'https:' ? 443 : 80;
  } catch {
    return 80;
  }
}

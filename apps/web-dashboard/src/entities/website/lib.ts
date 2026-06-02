export function getHostname(url: string, fallback = url): string {
  try { return new URL(url).hostname; } catch { return fallback; }
}

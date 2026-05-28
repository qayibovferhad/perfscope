import puppeteer, { type Browser } from 'puppeteer';
import { v4 as uuidv4 } from 'uuid';

const CHROME_ARGS = [
  '--no-sandbox',
  '--disable-setuid-sandbox',
  '--disable-dev-shm-usage',
];

export interface AuthSessionData {
  cookies: Array<{
    name:     string;
    value:    string;
    domain:   string | undefined;
    path:     string | undefined;
    expires:  number | undefined;
    httpOnly: boolean | undefined;
    secure:   boolean | undefined;
    sameSite: string  | undefined;
  }>;
  localStorage: Record<string, string>;
}

interface AuthSession {
  browser: Browser;
}

const sessions = new Map<string, AuthSession>();

export async function createAuthAuditSession(url: string): Promise<string> {
  const browser = await puppeteer.launch({
    headless: false,
    args: CHROME_ARGS,
    defaultViewport: null,
  });

  const page = await browser.newPage();
  await page.goto(url, { waitUntil: 'domcontentloaded' }).catch(() => {});

  const sessionId = uuidv4();
  sessions.set(sessionId, { browser });

  return sessionId;
}

export async function extractSessionData(sessionId: string): Promise<AuthSessionData> {
  const session = sessions.get(sessionId);
  if (!session) return { cookies: [], localStorage: {} };

  const allPages = await session.browser.pages();
  const activePage = allPages.find(p => {
    const u = p.url();
    return u !== 'about:blank' && u !== '' && !u.startsWith('chrome://');
  });

  if (!activePage) return { cookies: [], localStorage: {} };

  const [rawCookies, ls] = await Promise.all([
    activePage.cookies().catch(() => []),
    activePage.evaluate(() => {
      const items: Record<string, string> = {};
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k) items[k] = localStorage.getItem(k) ?? '';
      }
      return items;
    }).catch((): Record<string, string> => ({})),
  ]);

  const cookies = rawCookies.map(c => ({
    name:     c.name,
    value:    c.value,
    domain:   c.domain   as string | undefined,
    path:     c.path     as string | undefined,
    expires:  c.expires  as number | undefined,
    httpOnly: c.httpOnly as boolean | undefined,
    secure:   c.secure   as boolean | undefined,
    sameSite: c.sameSite as string  | undefined,
  }));

  return { cookies, localStorage: ls };
}

export function hasSession(sessionId: string): boolean {
  return sessions.has(sessionId);
}

export function destroySession(sessionId: string): void {
  const session = sessions.get(sessionId);
  if (!session) return;
  sessions.delete(sessionId);
  session.browser.close().catch(() => {});
}

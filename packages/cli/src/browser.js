import { execSync } from 'node:child_process';

export function openBrowser(url) {
  try {
    const p = process.platform;
    if      (p === 'darwin')  execSync(`open "${url}"`,              { stdio: 'ignore' });
    else if (p === 'win32')   execSync(`start "" "${url}"`,          { stdio: 'ignore', shell: true });
    else                      execSync(`xdg-open "${url}"`,          { stdio: 'ignore' });
  } catch {
    // user will open manually
  }
}

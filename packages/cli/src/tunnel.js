import chalk from 'chalk';
import { createRequire } from 'module';

const _require = createRequire(import.meta.url);

export async function openTunnel(port, spinner) {
  const lt = _require('localtunnel');
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error('Tunnel timed out after 30 s — is your local server running?'));
    }, 30_000);

    lt({ port })
      .then(tunnel => {
        clearTimeout(timeout);
        tunnel.on('error', err => {
          spinner.warn(chalk.yellow(`Tunnel warning: ${err.message}`));
        });
        resolve(tunnel);
      })
      .catch(err => {
        clearTimeout(timeout);
        reject(new Error(`Could not open tunnel: ${err.message}`));
      });
  });
}

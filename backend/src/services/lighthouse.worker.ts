import { workerData, parentPort } from 'worker_threads';
import puppeteer from 'puppeteer';
import lighthouse from 'lighthouse';
import type { RunnerResult } from 'lighthouse';

const CHROME_ARGS = [
  '--no-sandbox',
  '--disable-setuid-sandbox',
  '--disable-dev-shm-usage',
  '--disable-gpu',
  '--disable-background-timer-throttling',
  '--disable-renderer-backgrounding',
  '--disable-backgrounding-occluded-windows',
];

interface WorkerInput { url: string; categories: string[] }
type WorkerMessage =
  | { type: 'result'; lhr: RunnerResult['lhr'] }
  | { type: 'error'; message: string };

async function run(): Promise<void> {
  const { url, categories } = workerData as WorkerInput;
  const browser = await puppeteer.launch({ headless: true, args: CHROME_ARGS });

  try {
    const port = Number(new URL(browser.wsEndpoint()).port);
    const result = await lighthouse(url, {
      port,
      output: 'json',
      logLevel: 'error',
      onlyCategories: categories,
      screenEmulation: { disabled: true },
      throttlingMethod: 'provided',
    });

    if (!result) throw new Error('Lighthouse returned no result');
    parentPort!.postMessage({ type: 'result', lhr: result.lhr } satisfies WorkerMessage);
  } finally {
    await browser.close().catch(() => void 0);
  }
}

run().catch((err) => {
  const message = err instanceof Error ? err.message : 'Unknown error';
  parentPort!.postMessage({ type: 'error', message } satisfies WorkerMessage);
});

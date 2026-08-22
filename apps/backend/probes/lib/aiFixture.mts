/**
 * Stored audits, on disk, that the AI metric is measured against.
 *
 * The concreteness number in `ai-quality.probe.mts` used to come from whatever the local
 * database happened to hold — one site, changing every time a new audit ran. A metric
 * that moves because the fixture moved cannot tell you whether a prompt change helped,
 * which is the only question it exists to answer. These files pin it: same pages, same
 * evidence, same number, on any machine and after any prune.
 *
 * **What is kept.** Only the fields `buildPageContext` and the scorer actually read. The
 * model never sees a filmstrip, a heap trace or a dependency graph, so carrying them
 * would add megabytes of base64 screenshots to git without changing a single answer. The
 * stored AI text of the original run is stripped too — a fixture must not contain the
 * output it is used to grade.
 */
import { readFileSync, writeFileSync, readdirSync, mkdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import type { AnalysisResult } from '@perfscope/shared';

export const FIXTURE_DIR = join(dirname(dirname(fileURLToPath(import.meta.url))), 'fixtures');

export interface AiFixture {
  /** File name without extension — how a row is labelled in the table. */
  name:   string;
  result: AnalysisResult;
}

/** `https://www.bbc.com/news` → `www.bbc.com-news`, so a file name says what it holds. */
export function fixtureName(url: string): string {
  const u = new URL(url);
  const path = u.pathname.replace(/\/+$/, '').replace(/[^\w-]+/g, '-').replace(/^-|-$/g, '');
  return (path ? `${u.host}-${path}` : u.host).toLowerCase();
}

export function trimForAi(result: AnalysisResult): AnalysisResult {
  const requests = (result.resources?.requests ?? []).map(r => {
    // `advice` is AI text from the run that produced this audit; a fixture carrying it
    // would be grading a prompt against its own earlier answer.
    const { advice: _advice, ...rest } = r as typeof r & { advice?: string };
    return rest;
  });

  return {
    id:         result.id,
    url:        result.url,
    timestamp:  result.timestamp,
    formFactor: result.formFactor,
    scores:     result.scores,
    metrics:    result.metrics,
    measurement: result.measurement,
    audits:     result.audits,
    resources:  result.resources
      ? {
          ...result.resources,
          requests,
          // Rebuilt from the trimmed list rather than copied: these are the same objects,
          // and a fixture with two versions of one request is a fixture nobody trusts.
          thirdPartyRequests: requests.filter(r => (result.resources!.thirdPartyRequests ?? []).some(t => t.url === r.url)),
          jsFiles:            requests.filter(r => (result.resources!.jsFiles ?? []).some(j => j.url === r.url)),
        }
      : undefined,
    thirdParty:      result.thirdParty,
    clsData:         result.clsData,
    // Kept whole since the context started summarising them (peak/average/sample count,
    // INP and input delay): trimming the point list would change the sample count the
    // prompt quotes, and a fixture that feeds the model something the product does not
    // is worse than a slightly larger file.
    heapMemoryData:  result.heapMemoryData,
    interactionData: result.interactionData,
    // Long tasks only. `buildPageContext` filters to `isLongTask` and takes the six
    // longest, and the scorer looks at nothing else, so the other 3000 trace events on a
    // news site cannot change a single word of the answer — they were just half the file.
    flameChartData: result.flameChartData
      ? { ...result.flameChartData, events: result.flameChartData.events.filter(e => e.isLongTask) }
      : undefined,
  } as AnalysisResult;
}

export function saveFixture(result: AnalysisResult): { path: string; bytes: number } {
  mkdirSync(FIXTURE_DIR, { recursive: true });
  const path = join(FIXTURE_DIR, `${fixtureName(result.url)}.json`);
  writeFileSync(path, JSON.stringify(trimForAi(result), null, 2));
  return { path, bytes: statSync(path).size };
}

/** Every fixture on disk, in a stable order so two runs list the same rows the same way. */
export function loadFixtures(match?: string): AiFixture[] {
  let files: string[];
  try { files = readdirSync(FIXTURE_DIR).filter(f => f.endsWith('.json')).sort(); }
  catch { return []; }

  return files
    .filter(f => !match || f.includes(match))
    .map(f => ({
      name:   f.replace(/\.json$/, ''),
      result: JSON.parse(readFileSync(join(FIXTURE_DIR, f), 'utf8')) as AnalysisResult,
    }));
}

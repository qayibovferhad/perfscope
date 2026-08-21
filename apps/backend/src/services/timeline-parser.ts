import type { RunnerResult } from 'lighthouse';
import type { TimelineData, TimelineFrame } from '@perfscope/shared';
import { parseFailed } from '../lib/parse.js';

/** Filmstrip frames + key metric timings from a performance LHR. */
export function parseTimeline(lhr: RunnerResult['lhr']): TimelineData | null {
  try {
    const filmstripAudit = lhr.audits['screenshot-thumbnails'];
    const metricsAudit   = lhr.audits['metrics'];

    if (!filmstripAudit?.details || !metricsAudit?.details) return null;

    const filmstrip = filmstripAudit.details as {
      type: string;
      items: Array<{ timing?: number; timestamp?: number; data?: string }>;
    };
    if (filmstrip.type !== 'filmstrip' || !Array.isArray(filmstrip.items)) return null;

    const frames: TimelineFrame[] = filmstrip.items
      .filter((item) => !!item.data)
      .map((item) => ({
        timing: item.timing ?? (item.timestamp !== undefined ? Math.round(item.timestamp / 1000) : 0),
        data:   item.data as string,
      }));

    if (frames.length === 0) return null;

    const metricsDetails = metricsAudit.details as {
      type: string;
      items: Array<Record<string, number>>;
    };
    const m = metricsDetails?.items?.[0] ?? {};

    let networkOffsetMs = 0;
    try {
      const netAudit     = lhr.audits['network-requests'];
      const debugData    = (netAudit?.details as Record<string, unknown> | undefined)?.debugData as Record<string, unknown> | undefined;
      const networkStartTs = debugData?.networkStartTimeTs as number | undefined;
      const firstRaw     = filmstrip.items.find(i => !!i.data);
      if (networkStartTs !== undefined && firstRaw?.timestamp !== undefined) {
        const navStartTs = firstRaw.timestamp - (firstRaw.timing ?? 0) * 1000;
        networkOffsetMs  = Math.max(0, Math.min((networkStartTs - navStartTs) / 1000, 2000));
      }
    } catch {
      networkOffsetMs = 0;
    }

    const lastFrameMs = frames.at(-1)!.timing;
    const clampToFilmstrip = (val: number) => val > 0 && val > lastFrameMs ? lastFrameMs : val;

    return {
      frames,
      metrics: {
        fcp: clampToFilmstrip(m.firstContentfulPaint   ?? 0),
        lcp: clampToFilmstrip(m.largestContentfulPaint ?? 0),
        tti: clampToFilmstrip(m.interactive            ?? 0),
        tbt: m.totalBlockingTime ?? 0,
      },
      networkOffsetMs,
    };
  } catch (err) {
    return parseFailed('timeline', err);
  }
}

import type { RunnerResult } from 'lighthouse';
import type { CLSData, CLSShiftElement } from '@perfscope/shared';

/** Layout-shift elements with viewport-relative rects from a performance LHR. */
export function parseCLSData(lhr: RunnerResult['lhr']): CLSData | null {
  try {
    const clsAudit  = lhr.audits['cumulative-layout-shift'];
    // Lighthouse v12 uses 'layout-shifts'; earlier versions used 'layout-shift-elements'
    const shiftAudit = lhr.audits['layout-shifts'] ?? lhr.audits['layout-shift-elements'];
    if (!clsAudit || !shiftAudit?.details) return null;

    const totalScore = clsAudit.numericValue ?? 0;
    if (totalScore < 0.001) return null;

    const details = shiftAudit.details as { type: string; items: unknown[] };
    if (details.type !== 'table' || !Array.isArray(details.items) || details.items.length === 0) return null;

    // Viewport dimensions: prefer configSettings.screenEmulation, else Puppeteer default
    const cfgAny    = lhr.configSettings as unknown as Record<string, unknown> | undefined;
    const emulation = cfgAny?.['screenEmulation'] as Record<string, unknown> | undefined;
    const vw = typeof emulation?.['width']  === 'number' ? (emulation['width']  as number) : 800;
    const vh = typeof emulation?.['height'] === 'number' ? (emulation['height'] as number) : 600;

    const elements: CLSShiftElement[] = details.items
      .map((item: unknown): CLSShiftElement | null => {
        const row  = item as Record<string, unknown>;
        const node = row['node'] as Record<string, unknown> | undefined;
        // In Lighthouse v12 'layout-shifts', the node is the biggest-impact element.
        // Some shift events have no identified DOM element — skip those.
        if (!node || typeof node['selector'] !== 'string') return null;

        const score = ((row['score'] ?? row['cumulativeShiftScore'] ?? 0) as number);
        const br    = node['boundingRect'] as Record<string, number | undefined> | undefined;

        // Extract root cause from Lighthouse v12 subItems
        type SubItemRaw = { cause?: { value?: string } };
        const subItems = (row['subItems'] as { items?: SubItemRaw[] } | undefined)?.items ?? [];
        let rootCause: string | undefined;
        if (subItems.length > 0 && subItems[0]) {
          const causeStr = (subItems[0].cause?.value ?? '').toLowerCase();
          if (causeStr.includes('media') || causeStr.includes('size'))  rootCause = 'unsized-media';
          else if (causeStr.includes('font'))                           rootCause = 'web-font';
          else if (causeStr.includes('iframe'))                         rootCause = 'injected-iframe';
        }

        const el: CLSShiftElement = {
          selector: node['selector'] as string,
          snippet:  (node['snippet'] ?? '') as string,
          score,
          impact: score >= 0.05 ? 'high' : score >= 0.015 ? 'medium' : 'low',
          ...(rootCause ? { rootCause } : {}),
        };

        if (br && typeof br['top'] === 'number') {
          const top    = br['top']    ?? 0;
          const left   = br['left']   ?? 0;
          const width  = br['width']  ?? 0;
          const height = br['height'] ?? 0;
          el.rect = {
            topPct:    Math.max(0, Math.min(top    / vh, 1)),
            leftPct:   Math.max(0, Math.min(left   / vw, 1)),
            widthPct:  Math.max(0, Math.min(width  / vw, 1)),
            heightPct: Math.max(0, Math.min(height / vh, 1)),
          };
        }
        return el;
      })
      .filter(Boolean) as CLSShiftElement[];

    if (elements.length === 0) return null;
    return { totalScore, elements, viewportWidth: vw, viewportHeight: vh };
  } catch {
    return null;
  }
}

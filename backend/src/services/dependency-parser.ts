/**
 * Parses Network.requestWillBeSent DevTools events into a DependencyGraph.
 *
 * Each graph edge is an initiator → target relationship:
 *   - Parser-initiated (HTML/CSS inline): initiator.url → request.url
 *   - Script-initiated (JS fetch/import): first non-empty stack frame URL → request.url
 */
import type { NetworkRequest, DependencyNode, DependencyLink, DependencyGraph, ResourceType } from '../types/index.js';

// ─── Compact event shape passed from the worker ───────────────────────────────

interface InitiatorData {
  type: 'parser' | 'script' | 'other' | 'preload' | 'redirect';
  url?: string;
  stack?: {
    callFrames?: Array<{ url?: string; scriptId?: string }>;
    parent?: { callFrames?: Array<{ url?: string }> };
  };
}

export interface CompactNetworkEvent {
  url: string;
  initiator: InitiatorData;
}

// ─── DevTools log resolution (direct artifacts access — REST path) ────────────

interface CdpEntry {
  method: string;
  params: {
    request?: { url?: string };
    initiator?: InitiatorData;
  };
}

function resolveDevtoolsLog(artifacts: unknown): CdpEntry[] | undefined {
  if (!artifacts || typeof artifacts !== 'object') return undefined;
  const obj = artifacts as Record<string, unknown>;

  // Lighthouse v12: artifacts.DevtoolsLog
  if (Array.isArray(obj['DevtoolsLog'])) return obj['DevtoolsLog'] as CdpEntry[];

  // Lighthouse v10/v11: artifacts.devtoolsLogs.defaultPass
  const logs = obj['devtoolsLogs'] as Record<string, unknown> | undefined;
  if (logs && Array.isArray(logs['defaultPass'])) return logs['defaultPass'] as CdpEntry[];

  return undefined;
}

/** Extract compact Network.requestWillBeSent events from a Lighthouse artifact object.
 *  Called inside the worker thread where parsing is not possible. */
export function extractCompactNetworkEvents(artifacts: unknown): CompactNetworkEvent[] | undefined {
  const log = resolveDevtoolsLog(artifacts);
  if (!log || log.length === 0) return undefined;

  const events: CompactNetworkEvent[] = [];
  for (const entry of log) {
    if (entry.method !== 'Network.requestWillBeSent') continue;
    const url = entry.params?.request?.url;
    const initiator = entry.params?.initiator;
    if (url && initiator) {
      events.push({ url, initiator });
    }
  }
  return events.length > 0 ? events : undefined;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getInitiatorUrl(initiator: InitiatorData): string | null {
  // Parser-initiated (HTML/CSS document loaded a resource directly)
  if (initiator.url && initiator.url.startsWith('http')) return initiator.url;

  // Script-initiated: walk call stack for the first real script URL
  if (initiator.stack) {
    const frames = [
      ...(initiator.stack.callFrames ?? []),
      ...(initiator.stack.parent?.callFrames ?? []),
    ];
    for (const frame of frames) {
      const u = frame.url;
      if (u && u.startsWith('http') && !u.includes('v8-compile-cache')) {
        return u;
      }
    }
  }

  return null;
}

function shortLabel(url: string): string {
  try {
    const u = new URL(url);
    const file = u.pathname.split('/').pop()?.replace(/\?.*$/, '') ?? '';
    return file || u.hostname;
  } catch {
    return url.split('/').pop()?.replace(/\?.*$/, '') ?? url;
  }
}

// ─── Main export ─────────────────────────────────────────────────────────────

/**
 * Build a DependencyGraph from compact network events + known NetworkRequests.
 *
 * @param events  CompactNetworkEvent[] — from worker or direct artifact extraction
 * @param requests  Already-parsed NetworkRequest[] for transferSize/resourceType lookup
 */
export function parseDependencies(
  events: CompactNetworkEvent[],
  requests: NetworkRequest[],
): DependencyGraph | null {
  try {
    if (!events || events.length === 0) return null;

    const requestMap = new Map<string, NetworkRequest>(requests.map(r => [r.url, r]));

    const links: DependencyLink[] = [];
    const urlSet = new Set<string>();

    for (const event of events) {
      const targetUrl = event.url;
      const sourceUrl = getInitiatorUrl(event.initiator);
      if (!sourceUrl || sourceUrl === targetUrl) continue;

      const req = requestMap.get(targetUrl);
      links.push({
        source: sourceUrl,
        target: targetUrl,
        transferSize: req?.transferSize ?? 0,
      });
      urlSet.add(sourceUrl);
      urlSet.add(targetUrl);
    }

    if (links.length === 0) return null;

    const nodes: DependencyNode[] = Array.from(urlSet).map(url => {
      const req = requestMap.get(url);
      return {
        url,
        label: shortLabel(url),
        resourceType: (req?.resourceType ?? 'other') as ResourceType,
        transferSize: req?.transferSize ?? 0,
      };
    });

    return { nodes, links };
  } catch {
    return null;
  }
}

/** Convenience: parse directly from Lighthouse artifacts (REST path, no worker). */
export function parseDependenciesFromArtifacts(
  artifacts: unknown,
  requests: NetworkRequest[],
): DependencyGraph | null {
  const events = extractCompactNetworkEvents(artifacts);
  if (!events) return null;
  return parseDependencies(events, requests);
}

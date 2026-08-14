/**
 * Server-side socket state — the two pieces of the Socket.io generics that have no client
 * counterpart. Everything both ends must agree on (event maps, payloads, AuditPrecision)
 * lives in @perfscope/shared/types/socket; domain types live in @perfscope/shared too.
 *
 * This used to be types/index.ts, a re-export barrel kept "for backwards-compatible
 * imports" after the domain types moved to the shared package. Every importer now reads
 * from the real address, so the bridge is gone and the file says what it is.
 */

export interface InterServerEvents {
  ping: () => void;
}

export interface SocketData {
  analysisId?: string;
}

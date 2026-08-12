/**
 * History entity — persisted audit records, project audits, route trends.
 */
export type {
  HistoryEntry,
  ProjectAuditEntry,
  RouteGroup,
  ProjectAuditsResult,
  ScheduledSiteReport,
  AuditSource,
} from '@perfscope/shared'

export { useHistory, useAllHistory, useScheduledRuns, useDeleteAudit, fetchHistoryResult } from './model/useHistory'
export { hasResult } from './lib/hasResult'

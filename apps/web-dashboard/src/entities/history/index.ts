/**
 * History entity — persisted audit records, project audits, route trends.
 */
export type {
  HistoryEntry,
  ProjectAuditEntry,
  RouteGroup,
  ProjectAuditsResult,
} from '@perfscope/shared'

export { useHistory, useAllHistory, useDeleteAudit, fetchHistoryResult } from './model/useHistory'
export { hasResult } from './lib/hasResult'

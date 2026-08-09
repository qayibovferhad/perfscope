/**
 * Auth-audit feature — capture a logged-in browser session and audit behind login walls.
 * Public API for the other slices (compare, websites) that embed these modals.
 */
export { AuthAuditModal } from './ui/AuthAuditModal'
export { SessionCaptureModal } from './ui/SessionCaptureModal'
export { useAuthAuditStore } from './model/authAuditStore'

/**
 * Website entity — user's tracked websites.
 */
export type {
  WebsiteDoc      as Website,
  WebsiteSession,
  WebsiteAutomation,
} from '@perfscope/shared'

export { getHostname, sessionState, type SessionState } from './lib'
export { useWebsites } from './model/useWebsites'
export { useUrlSuggestions } from './model/useUrlSuggestions'

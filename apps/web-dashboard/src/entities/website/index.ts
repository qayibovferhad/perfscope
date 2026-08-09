/**
 * Website entity — user's tracked websites.
 */
export type {
  WebsiteDoc      as Website,
  WebsiteSession,
  WebsiteAutomation,
} from '@perfscope/shared'

export { getHostname } from './lib'
export { useWebsites } from './model/useWebsites'

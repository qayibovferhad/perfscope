/**
 * Teams — one account's data, seen by more than one person.
 *
 * Everything in this product is scoped by `userId`, and that is deliberately left alone: a
 * team has an **owner**, and working "inside" a team means working against the owner's
 * data. A member's request is resolved to the owner's id before any query runs, so a site,
 * an audit, a flow and an alert are the same document whoever is looking at it — there is
 * no second copy, no migration, and no query that can forget to filter by team.
 *
 * What that buys is also what it costs: a team is not a container that owns things, it is
 * *permission to act as the owner*. Deleting a team therefore deletes no data — it takes
 * away everyone else's access to the owner's account, which is the only thing it ever
 * granted.
 */

/** What a person may do inside a team. Ordered: every role can do what the next one can. */
export const TEAM_ROLES = ['viewer', 'member', 'owner'] as const
export type TeamRole = typeof TEAM_ROLES[number]

/** Higher is more. Comparisons run through this so no check spells out the ordering. */
const RANK: Record<TeamRole, number> = { viewer: 0, member: 1, owner: 2 }

/** May change anything: run audits, edit sites, write flows, set budgets. */
export function canWrite(role: TeamRole): boolean {
  return RANK[role] >= RANK.member
}

/** May invite, change roles, remove people, rename or delete the team. */
export function canManage(role: TeamRole): boolean {
  return RANK[role] >= RANK.owner
}

/** A person on a team, as the members list shows them. */
export interface TeamMemberInfo {
  userId:   string
  name:     string
  email:    string
  role:     TeamRole
  joinedAt: string
}

/** A team in a list — enough to switch to it and to say what you can do there. */
export interface TeamSummary {
  id:      string
  name:    string
  /** The caller's own role, not the team's. A list is read to decide where to work. */
  role:    TeamRole
  members: number
  ownerName: string
}

/** One team with its people. */
export interface TeamDetail extends TeamSummary {
  ownerId: string
  memberList: TeamMemberInfo[]
  createdAt: string
}

/**
 * An outstanding invitation.
 *
 * `url` is present exactly once — in the response that mints it. The token is stored
 * hashed, the same way refresh tokens and password resets are, so a listing can name an
 * invite and revoke it but can never hand out the link again.
 */
export interface TeamInviteInfo {
  id:        string
  role:      TeamRole
  createdAt: string
  expiresAt: string
  invitedBy: string
  url?:      string
}

/** What the accept page shows before anyone commits to anything. */
export interface TeamInvitePreview {
  team:    string
  role:    TeamRole
  invitedBy: string
  /** False when it is spent or past its date — the page says so instead of failing on accept. */
  valid:   boolean
}

/** Teams a person may hold. A ceiling exists so one account cannot mint them forever. */
export const MAX_TEAMS_PER_USER = 10

/** How long an invite link works. Long enough to be read after a weekend, short enough
 *  that a leaked link in a chat log is not a standing door. */
export const INVITE_TTL_DAYS = 7

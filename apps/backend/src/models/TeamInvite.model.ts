import { Schema, model, type Types } from 'mongoose';
import { TEAM_ROLES, type TeamRole } from '@perfscope/shared';

/**
 * An invitation link, stored the way every other bearer credential here is: **hashed**.
 *
 * The link is a standing grant to read (and usually write) somebody's whole account, so a
 * database dump must not be a pile of working invitations — the same reasoning as
 * `RefreshToken` and `PasswordReset`. SHA-256 rather than bcrypt for the same reason too:
 * this is a 256-bit random string with no entropy to stretch, and the lookup has to be an
 * indexed equality match.
 *
 * Spent invites are kept rather than deleted, so a team's owner can see that the link they
 * sent was used and by whom. Mongo removes them once `expiresAt` passes.
 */
const teamInviteSchema = new Schema(
  {
    teamId:    { type: Schema.Types.ObjectId, ref: 'Team', required: true, index: true },
    tokenHash: { type: String, required: true, unique: true },
    role:      { type: String, enum: TEAM_ROLES, required: true },
    invitedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    expiresAt: { type: Date, required: true },
    /** Single use: set on accept, and checked before anything else. */
    usedAt:    { type: Date, default: null },
    usedBy:    { type: Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true },
);

/**
 * Invitations delete themselves once they expire.
 *
 * A spent invite outliving its own deadline would be a row nobody reads and a token hash
 * nobody can use — and the owner has the members list to tell them who joined.
 */
teamInviteSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export interface ITeamInvite {
  _id:       Types.ObjectId;
  teamId:    Types.ObjectId;
  tokenHash: string;
  role:      TeamRole;
  invitedBy: Types.ObjectId;
  expiresAt: Date;
  usedAt:    Date | null;
  usedBy:    Types.ObjectId | null;
  createdAt: Date;
}

export const TeamInvite = model<ITeamInvite>('TeamInvite', teamInviteSchema);

import { Schema, model, type HydratedDocument, type Types } from 'mongoose';
import { TEAM_ROLES, type TeamRole } from '@perfscope/shared';

/**
 * A team, and the people allowed to act inside it.
 *
 * Members are embedded rather than kept in their own collection: the two questions ever
 * asked are "which teams may this person enter" and "what may they do in this one", and
 * both are answered by a single document. A separate membership collection would buy
 * pagination for a list that is never long enough to need it.
 *
 * `ownerId` is the scope: a member's request runs against **that** user's documents. It is
 * therefore not decoration — see `teamScope.ts`, where it becomes `req.userId`.
 */
const memberSchema = new Schema(
  {
    userId:   { type: Schema.Types.ObjectId, ref: 'User', required: true },
    role:     { type: String, enum: TEAM_ROLES, required: true },
    joinedAt: { type: Date, default: Date.now },
  },
  { _id: false },
);

const teamSchema = new Schema(
  {
    name:    { type: String, required: true, trim: true, maxlength: 60 },
    ownerId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    /** The owner is a member too, with role `owner` — one list, no special case to forget. */
    members: { type: [memberSchema], default: [] },
  },
  { timestamps: true },
);

/** Every request carrying a team header asks this: is this person in this team. */
teamSchema.index({ 'members.userId': 1 });

export interface ITeamMember {
  userId:   Types.ObjectId;
  role:     TeamRole;
  joinedAt: Date;
}

export interface ITeam {
  _id:       Types.ObjectId;
  name:      string;
  ownerId:   Types.ObjectId;
  members:   ITeamMember[];
  createdAt: Date;
  updatedAt: Date;
}

/** The stored document, with the methods — `ITeam` is the shape, this is the thing that
 *  can be saved. Handed between the service and the routes so a team is fetched once. */
export type TeamDoc = HydratedDocument<ITeam>;

export const Team = model<ITeam>('Team', teamSchema);

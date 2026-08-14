import { Schema, model, type Types } from 'mongoose';
import { sessionSchema, redactSession, type ISessionData } from './session.schema.js';

const competitorSessionSchema = new Schema(
  {
    userId:  { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    url:     { type: String, required: true, trim: true },
    name:    { type: String, trim: true, default: '' },
    session: { type: sessionSchema, required: true },
  },
  { timestamps: true, toJSON: { transform: (_doc, ret) => { redactSession(ret); } } },
);

competitorSessionSchema.index({ userId: 1, url: 1 }, { unique: true });

export interface ICompetitorSession {
  _id:    Types.ObjectId;
  userId: Types.ObjectId;
  url:    string;
  name:   string;
  session: ISessionData;
}

export const CompetitorSession = model<ICompetitorSession>('CompetitorSession', competitorSessionSchema);

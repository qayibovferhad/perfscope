import { Schema, model, type Types } from 'mongoose';

const cookieSchema = new Schema({
  name:     { type: String },
  value:    { type: String },
  domain:   { type: String },
  path:     { type: String },
  expires:  { type: Number },
  httpOnly: { type: Boolean },
  secure:   { type: Boolean },
  sameSite: { type: String },
}, { _id: false });

const sessionSchema = new Schema({
  cookies:      { type: [cookieSchema], default: [] },
  localStorage: { type: Schema.Types.Mixed, default: {} },
  capturedAt:   { type: Date, default: Date.now },
}, { _id: false });

const websiteSchema = new Schema(
  {
    userId:  { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    url:     { type: String, required: true, trim: true },
    name:    { type: String, trim: true, default: '' },
    session: { type: sessionSchema, default: null },
  },
  { timestamps: true },
);

websiteSchema.index({ userId: 1, url: 1 }, { unique: true });

export interface IWebsiteSession {
  cookies: Array<{
    name?: string; value?: string; domain?: string; path?: string;
    expires?: number; httpOnly?: boolean; secure?: boolean; sameSite?: string;
  }>;
  localStorage: Record<string, string>;
  capturedAt: Date;
}

export interface IWebsite {
  _id:     Types.ObjectId;
  userId:  Types.ObjectId;
  url:     string;
  name:    string;
  session: IWebsiteSession | null;
}

export const Website = model<IWebsite>('Website', websiteSchema);

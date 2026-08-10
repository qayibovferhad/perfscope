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

const automationSchema = new Schema(
  {
    enabled:      { type: Boolean, default: false },
    routes:       { type: [String], default: [] },
    scheduleTime: { type: String, default: '00:00' },
    lastRunAt:    { type: Date, default: null },
  },
  { _id: false },
);

// Remembers that an audit hit a login screen, so the dashboard can flag the site
// instead of the warning living only in that one analysis result.
const requiresLoginSchema = new Schema(
  {
    url:        { type: String },  // the URL that was requested when the wall was hit
    loginUrl:   { type: String },  // where it landed instead
    detectedAt: { type: Date, default: Date.now },
  },
  { _id: false },
);

const budgetsSchema = new Schema(
  {
    performance: { type: Number, default: null },
    lcp:         { type: Number, default: null },
    tbt:         { type: Number, default: null },
    cls:         { type: Number, default: null },
    webhookUrl:  { type: String, default: null },
  },
  { _id: false },
);

const budgetBreachSchema = new Schema(
  {
    analysisId: { type: String, required: true },
    url:        { type: String, required: true },
    formFactor: { type: String, default: null },
    failures:   [{ metric: String, value: Number, budget: Number, _id: false }],
    at:         { type: Date, required: true },
  },
  { _id: false },
);

const websiteSchema = new Schema(
  {
    userId:        { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    url:           { type: String, required: true, trim: true },
    name:          { type: String, trim: true, default: '' },
    session:       { type: sessionSchema, default: null },
    requiresLogin: { type: requiresLoginSchema, default: null },
    automation:    { type: automationSchema, default: () => ({ enabled: false, lastRunAt: null }) },
    budgets:          { type: budgetsSchema, default: null },
    lastBudgetBreach: { type: budgetBreachSchema, default: null },
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

export interface IWebsiteAutomation {
  enabled:      boolean;
  routes:       string[];
  scheduleTime: string;
  lastRunAt:    Date | null;
}

export interface IWebsiteBudgets {
  performance: number | null;
  lcp:         number | null;
  tbt:         number | null;
  cls:         number | null;
  webhookUrl:  string | null;
}

export interface IBudgetBreach {
  analysisId: string;
  url:        string;
  formFactor: string | null;
  failures:   Array<{ metric: string; value: number; budget: number }>;
  at:         Date;
}

export interface IRequiresLogin {
  url:        string;
  loginUrl:   string;
  detectedAt: Date;
}

export interface IWebsite {
  _id:              Types.ObjectId;
  userId:           Types.ObjectId;
  url:              string;
  name:             string;
  session:          IWebsiteSession | null;
  requiresLogin:    IRequiresLogin | null;
  automation:       IWebsiteAutomation;
  budgets:          IWebsiteBudgets | null;
  lastBudgetBreach: IBudgetBreach | null;
  createdAt?:       Date;
}

export const Website = model<IWebsite>('Website', websiteSchema);

import { Schema, model, type Types } from 'mongoose';
import { sessionSchema, redactSession, type ISessionData } from './session.schema.js';
import type {
  AutomationSlot, WebsiteAutomation, WebsiteBudgets, BudgetBreach, WebsiteLoginWall,
} from '@perfscope/shared';

/** One group of routes and the time of day they run. */
const automationSlotSchema = new Schema(
  {
    time:   { type: String, required: true },   // 'HH:MM', validated at the route
    routes: { type: [String], default: [] },
  },
  { _id: false },
);

const automationSchema = new Schema(
  {
    enabled:      { type: Boolean, default: false },
    routes:       { type: [String], default: [] },
    scheduleTime: { type: String, default: '00:00' },
    /**
     * Documents written before this existed have no scheduleMode; `expandSchedule` reads
     * that as 'single', which is exactly what they did before — so no migration.
     */
    scheduleMode:  { type: String, enum: ['single', 'slots', 'spread'], default: 'single' },
    slots:         { type: [automationSlotSchema], default: [] },
    spreadMinutes: { type: Number, default: 60 },
    lastRunAt:     { type: Date, default: null },
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
    /** Field-only: no lab run can measure INP, so this is checked against RUM p75. */
    inp:         { type: Number, default: null },
    webhookUrl:  { type: String, default: null },
    alertEmail:  { type: String, default: null },
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
    /**
     * Public key embedded in the RUM snippet. Not a secret — it is visible in the page
     * source by design; it identifies the site, and the ingest endpoint checks nothing
     * else. Absent until the user asks for a snippet.
     */
    rumKey:           { type: String, default: null, index: true, sparse: true },
    lastBudgetBreach: { type: budgetBreachSchema, default: null },
  },
  { timestamps: true, toJSON: { transform: (_doc, ret) => { redactSession(ret); } } },
);

websiteSchema.index({ userId: 1, url: 1 }, { unique: true });

/** @deprecated name kept for existing importers — the definition lives in session.schema.ts. */
export type IWebsiteSession = ISessionData;

// Derived from the shared wire types rather than mirrored by hand — the mirrors had
// already drifted (`IBudgetBreach.formFactor` said `string | null` while the client type
// said `AuditFormFactor | undefined`, for the same stored field). `Date` binds the
// generic; `Required<>` reflects that the schemas above default every field, so a
// hydrated document always carries them even where the wire shape is optional.
export type IWebsiteAutomationSlot = AutomationSlot;
export type IWebsiteAutomation     = Required<WebsiteAutomation<Date>>;
export type IWebsiteBudgets        = Required<WebsiteBudgets>;
export type IBudgetBreach          = Required<BudgetBreach<Date>>;
export type IRequiresLogin         = WebsiteLoginWall<Date>;

export interface IWebsite {
  _id:              Types.ObjectId;
  userId:           Types.ObjectId;
  url:              string;
  name:             string;
  session:          IWebsiteSession | null;
  requiresLogin:    IRequiresLogin | null;
  automation:       IWebsiteAutomation;
  budgets:          IWebsiteBudgets | null;
  rumKey:           string | null;
  lastBudgetBreach: IBudgetBreach | null;
  createdAt?:       Date;
}

export const Website = model<IWebsite>('Website', websiteSchema);

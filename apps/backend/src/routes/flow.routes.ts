import { Router } from 'express';
import { ok } from '../lib/respond.js';
import { requireAuth, type AuthedRequest } from '../middleware/auth.middleware.js';
import { requireStorageForWrites } from '../middleware/storage.middleware.js';
import { AppError, asyncHandler } from '../lib/errors.js';
import { Flow } from '../models/Flow.model.js';
import { FlowRun } from '../models/FlowRun.model.js';
import { parseFlowInput } from '../services/flowInput.js';
import { intParam } from '../lib/params.js';
import { collectFlowTargetFailures, type FlowDefinition, type FlowRunResult } from '@perfscope/shared';

export const flowRouter: Router = Router();

/** Running a flow happens over the socket — it takes minutes and reports per step. These
 *  routes are the definitions and the history of what they produced. */
flowRouter.use('/flows', requireAuth, requireStorageForWrites);
flowRouter.use('/flow-runs', requireAuth);

const RUNS_PER_PAGE = 20;

/** The `:id` from the path as a plain string — Express types it as `string | string[]`,
 *  which Mongoose will not take as an `_id`. */
const flowId = (req: { params: Record<string, unknown> }) => String(req.params['id'] ?? '');

/** The wire shape, with the ids the client addresses things by. */
function toDefinition(doc: {
  _id: unknown; websiteId: unknown; name: string; url: string; steps: FlowDefinition['steps'];
  snapshotAtEnd: boolean; formFactor: 'mobile' | 'desktop';
  schedule?: { enabled: boolean; time: string };
  targets?: { inp: number | null; tbt: number | null; cls: number | null };
  createdAt: Date; updatedAt: Date;
}): FlowDefinition {
  return {
    id: String(doc._id),
    websiteId: doc.websiteId ? String(doc.websiteId) : null,
    name: doc.name,
    url: doc.url,
    steps: doc.steps,
    snapshotAtEnd: doc.snapshotAtEnd,
    formFactor: doc.formFactor,
    // Documents written before these existed read as undefined; the client renders the same
    // defaults the model would have given them.
    schedule: doc.schedule ?? { enabled: false, time: '03:00' },
    targets:  doc.targets  ?? { inp: null, tbt: null, cls: null },
    createdAt: doc.createdAt?.toISOString(),
    updatedAt: doc.updatedAt?.toISOString(),
  };
}

// GET /api/flows — every flow this account has, newest edit first
flowRouter.get('/flows', asyncHandler<AuthedRequest>(async (req, res) => {
  const flows = await Flow.find({ userId: req.userId }).sort({ updatedAt: -1 }).lean();

  // The last run per flow, in one query rather than one per flow: the list shows "ran an
  // hour ago, 2 steps failing" against each row and N+1 queries for a decoration is how a
  // list page becomes slow for the accounts that use the feature most.
  const runs = await FlowRun.find({ flowId: { $in: flows.map(f => f._id) } })
    .sort({ createdAt: -1 })
    .select('flowId steps createdAt')
    .lean();

  const lastByFlow = new Map<string, typeof runs[number]>();
  for (const run of runs) {
    const key = String(run.flowId);
    if (!lastByFlow.has(key)) lastByFlow.set(key, run);
  }

  ok(res, flows.map((flow) => {
    const last = lastByFlow.get(String(flow._id));
    return {
      ...toDefinition(flow),
      lastRun: last
        ? {
            id: String(last._id),
            at: last.createdAt.toISOString(),
            // "How many steps have something failing" is the one number a list row can carry
            // that means the same thing for every mode.
            failedSteps: last.steps.filter((step) => step.audits.length > 0).length,
            // Computed here rather than stored on the run: targets can change after a run,
            // and a card showing the verdict of a threshold nobody has any more is worse
            // than showing none.
            missedTargets: collectFlowTargetFailures(last.steps, flow.targets).length,
          }
        : null,
    };
  }));
}));

// POST /api/flows
flowRouter.post('/flows', asyncHandler<AuthedRequest>(async (req, res) => {
  const input = parseFlowInput(req.body as Record<string, unknown>);
  const flow = await Flow.create({ ...input, userId: req.userId });
  ok(res, toDefinition(flow), 201);
}));

// PUT /api/flows/:id — the editor saves the whole definition, not a patch: a flow is a
// sequence, and a partial update of a sequence is ambiguous about what happened to it.
flowRouter.put('/flows/:id', asyncHandler<AuthedRequest>(async (req, res) => {
  const input = parseFlowInput(req.body as Record<string, unknown>);
  const flow = await Flow.findOneAndUpdate(
    { _id: flowId(req), userId: req.userId },
    input,
    { new: true },
  ).lean();
  if (!flow) throw new AppError(404, 'Flow not found');
  ok(res, toDefinition(flow));
}));

// DELETE /api/flows/:id
flowRouter.delete('/flows/:id', asyncHandler<AuthedRequest>(async (req, res) => {
  const flow = await Flow.findOneAndDelete({ _id: flowId(req), userId: req.userId }).lean();
  if (!flow) throw new AppError(404, 'Flow not found');
  // Its runs go with it: they are reports of a definition that no longer exists, and
  // nothing else ever reads them.
  await FlowRun.deleteMany({ flowId: flow._id });
  ok(res);
}));

// GET /api/flows/:id/runs — that flow's own history
flowRouter.get('/flows/:id/runs', asyncHandler<AuthedRequest>(async (req, res) => {
  const limit = intParam(req.query['limit'], { def: RUNS_PER_PAGE, min: 1, max: 50 });
  const runs = await FlowRun.find({ flowId: flowId(req), userId: req.userId })
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();

  ok(res, runs.map((run): FlowRunResult => ({
    id: String(run._id),
    flowId: String(run.flowId),
    name: run.name,
    url: run.url,
    formFactor: run.formFactor,
    timestamp: run.createdAt.toISOString(),
    steps: run.steps,
    durationMs: run.durationMs,
  })));
}));

// GET /api/flow-runs/:id — one stored report
flowRouter.get('/flow-runs/:id', asyncHandler<AuthedRequest>(async (req, res) => {
  const run = await FlowRun.findOne({ _id: flowId(req), userId: req.userId }).lean();
  if (!run) throw new AppError(404, 'Flow run not found');

  const result: FlowRunResult = {
    id: String(run._id),
    flowId: String(run.flowId),
    name: run.name,
    url: run.url,
    formFactor: run.formFactor,
    timestamp: run.createdAt.toISOString(),
    steps: run.steps,
    durationMs: run.durationMs,
  };
  ok(res, result);
}));

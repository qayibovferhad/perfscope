import type { Server, Socket } from 'socket.io';
import { v4 as uuidv4 } from 'uuid';
import type { ClientToServerEvents, ServerToClientEvents, FlowDefinition } from '@perfscope/shared';
import type { InterServerEvents, SocketData } from '../types/socket.js';
import { runFlow } from '../services/flow.service.js';
import { Flow } from '../models/Flow.model.js';
import { FlowRun } from '../models/FlowRun.model.js';
import { parseFlowInput } from '../services/flowInput.js';
import { findSessionFor } from '../services/sessionStore.js';
import { checkFlowTargets } from '../services/flowSchedule.service.js';
import { socketScope } from './scope.js';
import { isDbReady } from '../config/database.js';
import { isFetchableTarget } from '../lib/ssrf.js';
import { AppError } from '../lib/errors.js';

type TypedServer = Server<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>;
type TypedSocket = Socket<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>;

/**
 * Running a flow, over the socket.
 *
 * Its own file rather than another branch in `analysis.handler`: that one is about audits
 * and already carries three entry paths, and a flow shares none of its pipeline — no
 * previous-run comparison, no AI enrichment, no budgets, no History write. What the two do
 * share is the socket, the token, and the queue.
 *
 * The run id is minted **here**, exactly as the analysis handler mints its own and for the
 * same reason: several flows may run on one connection, and every event has to say which
 * one it belongs to or a second run repaints the first one's progress.
 */
export function registerFlowSocket(io: TypedServer): void {
  io.on('connection', (socket: TypedSocket) => {
    // The team's owner when this connection named one — a flow a member runs belongs to
    // the account they are working in, exactly as its sites and audits do.
    const scopeId = socketScope(socket.handshake.auth);

    socket.on('flow:start', async (payload) => {
      const flowRunId = uuidv4();

      try {
        const userId = await scopeId();
        if (!userId) throw new AppError(401, 'Sign in to run a flow');

        // Either a saved flow or the editor's unsaved draft. A saved one wins: it is the
        // record, and honouring a draft alongside its id would let the two disagree about
        // what just ran.
        let definition: Pick<FlowDefinition, 'name' | 'url' | 'steps' | 'snapshotAtEnd' | 'formFactor'>;
        let flowId = '';

        if (payload.flowId) {
          if (!isDbReady()) throw new AppError(503, 'Saved flows need the database');
          const stored = await Flow.findOne({ _id: payload.flowId, userId });
          if (!stored) throw new AppError(404, 'Flow not found');
          flowId = String(stored._id);
          definition = {
            name: stored.name, url: stored.url, steps: stored.steps,
            snapshotAtEnd: stored.snapshotAtEnd, formFactor: stored.formFactor,
          };
        } else if (payload.flow) {
          // Validated with the same parser the REST route uses — a draft is executed by the
          // same browser as a saved flow, so it is held to the same bar.
          definition = parseFlowInput(payload.flow as Record<string, unknown>);
        } else {
          throw new AppError(400, 'Provide flowId or flow');
        }

        // The same guard the audit path applies: every URL here becomes a fetch this server
        // makes. No-op in development (lib/ssrf.ts).
        if (!(await isFetchableTarget(definition.url))) {
          throw new AppError(400, 'That address is private or local, and this server will not open it');
        }

        // A flow's interactions usually live behind a login, so a session saved for this
        // exact origin is injected the way an audit's is — `findSessionFor` decides by
        // origin equality, never by prefix.
        const session = isDbReady() ? await findSessionFor(userId, definition.url) : null;

        // Logged like an analysis is: a flow is a minutes-long server-side job, and a run
        // that failed on a selector left no trace anywhere but the client's error panel.
        console.log(`[Flow] Started "${definition.name}" (${definition.url})`);

        const result = await runFlow(definition, {
          session,
          onProgress: (progress) => socket.emit('flow:progress', { ...progress, flowRunId }),
        });

        // Stored before the client is told, so "open it later" is true the moment the
        // result appears rather than a second afterwards.
        let storedId = result.id;
        if (flowId && isDbReady()) {
          const saved = await FlowRun.create({
            userId, flowId, name: result.name, url: result.url,
            formFactor: result.formFactor, steps: result.steps, durationMs: result.durationMs,
          });
          storedId = String(saved._id);

          // Checked on a manual run as well as a scheduled one: a target that only fires
          // overnight is a target somebody discovers a day late.
          const stored = await Flow.findById(flowId);
          if (stored) {
            await checkFlowTargets(stored, { ...result, id: storedId })
              .catch((err: unknown) => {
                // A failed alert must not fail the run the reader is watching.
                console.warn('[Flow] target check failed:', (err as Error).message);
                return [];
              });
          }
        }

        console.log(`[Flow] Finished "${result.name}" in ${result.durationMs}ms (${result.steps.length} steps)`);
        socket.emit('flow:complete', { ...result, id: storedId, flowId });
      } catch (err) {
        const step = (err as { step?: number }).step;
        console.warn(`[Flow] Failed: ${err instanceof Error ? err.message : String(err)}`);
        socket.emit('flow:error', {
          flowRunId,
          message: err instanceof Error ? err.message : 'The flow could not run',
          ...(typeof step === 'number' ? { step } : {}),
        });
      }
    });
  });
}

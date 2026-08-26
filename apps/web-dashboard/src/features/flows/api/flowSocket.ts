import type { FlowProgress, FlowRunResult, FlowStartPayload } from '@perfscope/shared';
import { getSocket } from '@/shared/api/socket';

export interface FlowCallbacks {
  onProgress: (progress: FlowProgress) => void;
  onComplete: (result: FlowRunResult) => void;
  /** `step` is the 0-based index of the step that failed, when one did — the editor
   *  highlights that row rather than making the reader guess which selector was wrong. */
  onError:    (message: string, step?: number) => void;
}

/**
 * Start a flow and listen until it finishes.
 *
 * On the shared socket, like an analysis: a flow is the same kind of long server-side job
 * and there is no reason for a second connection. Returns the detach, which the caller runs
 * on unmount — unlike an audit, a flow that outlives its page has nothing to re-attach to,
 * so nothing tracks it in the shell.
 */
export function startFlowRun(payload: FlowStartPayload, callbacks: FlowCallbacks): () => void {
  const socket = getSocket();

  // The shared socket is created with `autoConnect: false`, so it has to be told. Without
  // this the emit is buffered against a socket that never dials and the run simply never
  // starts — the page sits at "Starting…" with no error, because nothing failed.
  if (!socket.connected) socket.connect();

  const onProgress = (progress: FlowProgress) => callbacks.onProgress(progress);
  const onComplete = (result: FlowRunResult) => callbacks.onComplete(result);
  const onError = (data: { message: string; step?: number }) => callbacks.onError(data.message, data.step);

  socket.on('flow:progress', onProgress);
  socket.on('flow:complete', onComplete);
  socket.on('flow:error', onError);

  socket.emit('flow:start', payload);

  return () => {
    socket.off('flow:progress', onProgress);
    socket.off('flow:complete', onComplete);
    socket.off('flow:error', onError);
  };
}

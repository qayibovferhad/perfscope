import { useCallback, useEffect, useRef, useState } from 'react';
import type { FlowProgress, FlowRunResult, FlowStartPayload } from '@perfscope/shared';
import { useQueryClient } from '@tanstack/react-query';
import { startFlowRun } from '../api/flowSocket';

interface FlowRunState {
  status:   'idle' | 'running' | 'done' | 'error';
  progress: FlowProgress | null;
  result:   FlowRunResult | null;
  error:    string | null;
  /** Which step failed, so the editor can point at the row instead of at the flow. */
  failedStep: number | null;
}

const IDLE: FlowRunState = { status: 'idle', progress: null, result: null, error: null, failedStep: null };

/**
 * One flow run, from the button to the report.
 *
 * The detach is kept in a ref rather than in an effect's cleanup because the run is started
 * by a *click*, not by mounting: an effect keyed on some "running" flag would attach its
 * listeners a render after the emit, which is exactly long enough to miss the first
 * progress event on a fast flow.
 */
export function useFlowRun() {
  const [state, setState] = useState<FlowRunState>(IDLE);
  const detach = useRef<(() => void) | null>(null);
  const qc = useQueryClient();

  const stop = useCallback(() => {
    detach.current?.();
    detach.current = null;
  }, []);

  const run = useCallback((payload: FlowStartPayload) => {
    stop();
    setState({ ...IDLE, status: 'running' });

    detach.current = startFlowRun(payload, {
      onProgress: (progress) => setState(s => (s.status === 'running' ? { ...s, progress } : s)),
      onComplete: (result) => {
        setState({ status: 'done', progress: null, result, error: null, failedStep: null });
        stop();
        // The list shows each flow's last run; a finished run makes that stale immediately.
        qc.invalidateQueries({ queryKey: ['flows'] });
        qc.invalidateQueries({ queryKey: ['flow-runs'] });
      },
      onError: (message, step) => {
        setState({ status: 'error', progress: null, result: null, error: message, failedStep: step ?? null });
        stop();
      },
    });
  }, [qc, stop]);

  /** Show a stored report in the same panel a live run fills. */
  const show = useCallback((result: FlowRunResult) => {
    stop();
    setState({ status: 'done', progress: null, result, error: null, failedStep: null });
  }, [stop]);

  const reset = useCallback(() => { stop(); setState(IDLE); }, [stop]);

  // Leaving the page ends the listening, not the run: the server finishes it and stores it,
  // so it is waiting in the flow's history when the reader comes back.
  useEffect(() => stop, [stop]);

  return { ...state, run, show, reset };
}

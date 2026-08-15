import { io, type Socket } from 'socket.io-client'
import type {
  ServerToClientEvents,
  ClientToServerEvents,
  AnalysisResult,
  AnalysisProgress,
} from '@perfscope/shared'

/**
 * Run an audit over the socket, the way the dashboard does.
 *
 * The popup used `POST /api/analyze` and inherited that path's ceiling: the server hangs
 * up at 70s (`HTTP_TIMEOUT_MS`) while an audit is allowed 4 minutes
 * (`RUN_TIMEOUT_MS`). On a slow site the popup showed a failure while the audit carried
 * on server-side, and pressing the button again started a *second* one competing for the
 * same CPU — which does not merely take longer, it reports worse numbers.
 *
 * A socket has no such ceiling, and the progress the server was already emitting can
 * finally be shown instead of a spinner.
 *
 * The event names and payloads come from @perfscope/shared, so this cannot drift from the
 * server the way a hand-typed copy would.
 */
export function runAnalysis(
  baseUrl: string,
  token: string | null,
  url: string,
  { onProgress }: { onProgress?: (p: AnalysisProgress) => void } = {},
): { promise: Promise<AnalysisResult>; cancel: () => void } {
  const socket: Socket<ServerToClientEvents, ClientToServerEvents> = io(baseUrl, {
    auth: token ? { token } : {},
  })

  let settled = false
  const close = () => { socket.removeAllListeners(); socket.disconnect() }

  const promise = new Promise<AnalysisResult>((resolve, reject) => {
    const fail = (err: Error) => { if (settled) return; settled = true; close(); reject(err) }

    socket.on('connect', () => socket.emit('analysis:start', { url }))
    socket.on('connect_error', (err) =>
      fail(new Error(`Cannot reach ${baseUrl} — is PerfScope running? (${err.message})`)))

    socket.on('analysis:progress', (p) => { if (!settled) onProgress?.(p) })
    socket.on('analysis:complete', (result) => {
      if (settled) return
      settled = true
      // Deliberately not waiting for analysis:insights. The popup has no panel for AI
      // commentary, and it closes the moment it loses focus — holding the socket open for
      // a couple of extra seconds would buy nothing and often be cut off anyway.
      close()
      resolve(result)
    })
    socket.on('analysis:error', (e) => fail(new Error(e?.message ?? 'Analysis failed')))
  })

  return {
    promise,
    cancel: () => { if (!settled) { settled = true; close() } },
  }
}

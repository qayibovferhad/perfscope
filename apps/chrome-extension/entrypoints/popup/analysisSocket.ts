import { io, type Socket } from 'socket.io-client'
import type {
  ServerToClientEvents,
  ClientToServerEvents,
  AnalysisResult,
  AnalysisProgress,
  AnalysisInsightsPayload,
} from '@perfscope/shared'

/** `analysis:insights` arrives after `analysis:complete`, on its own schedule — bounded
 *  so a dead model or a slow reply doesn't hold the socket open indefinitely. */
const INSIGHTS_TIMEOUT_MS = 15_000

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
  { onProgress, onInsights }: {
    onProgress?: (p: AnalysisProgress) => void
    /**
     * Fired once, after the returned promise has already resolved — the same split the
     * dashboard uses: scores never wait for Gemini. Omit it (as `CompareTab` does — two
     * results side by side have no room for per-audit commentary) and the socket closes
     * the moment scores land, same as before this option existed. Pass it and the socket
     * stays open up to `INSIGHTS_TIMEOUT_MS` waiting for `analysis:insights`; if the popup
     * has since closed there is simply no one listening, which costs nothing.
     */
    onInsights?: (insights: AnalysisInsightsPayload) => void
  } = {},
): { promise: Promise<AnalysisResult>; cancel: () => void } {
  const socket: Socket<ServerToClientEvents, ClientToServerEvents> = io(baseUrl, {
    auth: token ? { token } : {},
  })

  let settled = false
  let insightsDone = !onInsights
  const close = () => { socket.removeAllListeners(); socket.disconnect() }
  const closeIfDone = () => { if (settled && insightsDone) close() }

  const promise = new Promise<AnalysisResult>((resolve, reject) => {
    const fail = (err: Error) => {
      if (settled) return
      settled = true; insightsDone = true
      close()
      reject(err)
    }

    socket.on('connect', () => socket.emit('analysis:start', { url }))
    socket.on('connect_error', (err) =>
      fail(new Error(`Cannot reach ${baseUrl} — is PerfScope running? (${err.message})`)))

    socket.on('analysis:progress', (p) => { if (!settled) onProgress?.(p) })
    socket.on('analysis:complete', (result) => {
      if (settled) return
      settled = true
      resolve(result)

      if (onInsights) {
        const timeout = setTimeout(() => { insightsDone = true; closeIfDone() }, INSIGHTS_TIMEOUT_MS)
        socket.once('analysis:insights', (insights) => {
          clearTimeout(timeout)
          insightsDone = true
          onInsights(insights)
          closeIfDone()
        })
      }
      closeIfDone()
    })
    socket.on('analysis:error', (e) => fail(new Error(e?.message ?? 'Analysis failed')))
  })

  return {
    promise,
    cancel: () => { if (!settled || !insightsDone) { settled = true; insightsDone = true; close() } },
  }
}

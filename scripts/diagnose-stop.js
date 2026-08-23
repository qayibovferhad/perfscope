/**
 * Paste this into the browser console on the analyzer page, then press Stop.
 *
 * It prints what the app believes is happening — the runs the shell is tracking, the
 * analysis id the page holds, and every analysis event that arrives afterwards. Between
 * them those three answer the only question left: is the run still going, is a *new* one
 * starting, or is the page simply not showing one that has already stopped.
 *
 *   1. open http://localhost:5173/app
 *   2. paste this, press Enter
 *   3. start an audit, wait a few seconds, press Stop
 *   4. copy everything the console printed
 */
(async () => {
  const { useRunningAuditsStore } = await import('/src/entities/analysis/model/runningAuditsStore.ts');
  const { getSocket } = await import('/src/shared/api/socket.ts');
  const socket = getSocket();
  const t0 = Date.now();
  const at = () => `+${((Date.now() - t0) / 1000).toFixed(1)}s`;

  console.log('%cPerfScope stop diagnostics armed', 'color:#14c08a;font-weight:bold');
  console.log('address bar:', location.pathname + location.search);
  console.log('socket id:', socket.id, '| connected:', socket.connected);

  for (const event of ['analysis:progress', 'analysis:complete', 'analysis:error']) {
    socket.on(event, (d) => {
      const id = (d?.analysisId ?? d?.id ?? '?').slice(0, 8);
      const extra = event === 'analysis:progress' ? `${d.progress}% ${d.message}` : (d?.message ?? '');
      console.log(`${at()} ← ${event} [${id}] ${extra}`);
    });
  }

  const emit = socket.emit.bind(socket);
  socket.emit = (event, ...args) => {
    if (String(event).startsWith('analysis:') || String(event).startsWith('auth-audit:')) {
      console.log(`${at()} → ${event}`, JSON.stringify(args[0]));
    }
    return emit(event, ...args);
  };

  useRunningAuditsStore.subscribe((s) => {
    console.log(`${at()} store runs = ${JSON.stringify(s.runs.map(r => ({ id: r.analysisId?.slice(0, 8) ?? null, pct: r.progress })))}`);
  });
})();

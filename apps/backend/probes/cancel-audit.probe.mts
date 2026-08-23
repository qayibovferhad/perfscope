/**
 * Stopping an audit is not the audit failing.
 *
 * Cancelling kills the worker threads and the Chrome instances they own, and Lighthouse
 * reports that the only way it can — the run in flight throws. Depending on which died
 * first that is "Worker exited with code 1" or "Failed to fetch browser webSocket URL from
 * http://127.0.0.1:PORT/json/version: fetch failed". Both are the sound of the cancellation
 * working, and both used to be emitted to the client as `analysis:error`.
 *
 * Nothing showed them for a while, because the dashboard detaches its listeners before it
 * sends the cancel and the error arrived at an empty room. That is a timing accident: the
 * CLI, the extension and the shell's own long-lived listeners all saw it, and a person who
 * pressed Stop being told their audit failed with a socket URL is the worst possible
 * reading of "it stopped".
 *
 * It also covers the case that made "Stop doesn't work" a real complaint rather than a
 * cosmetic one: an audit **still in the queue** was not in `activeAnalyses` — that map is
 * filled by the task once the queue admits it — so cancelling one did nothing at all, and
 * the run started the moment a slot opened. With the cap at two concurrent audits that is
 * the common case on a busy box, not a rare one.
 *
 * Driven over a real socket rather than through the browser, because the thing under test
 * is what the *server* sends — a client that happens not to be listening proves nothing.
 *
 * From apps/backend (the backend must be running on 3101):
 *
 *     npx tsx probes/cancel-audit.probe.mts
 */
import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { io, type Socket } from 'socket.io-client';
import jwt from 'jsonwebtoken';
import { config } from '../src/config/index.js';

const BACKEND = process.env['BACKEND_URL'] ?? 'http://localhost:3101';
const HERE = dirname(fileURLToPath(import.meta.url));
const PORT = 3391;

let failures = 0;
const check = (ok: boolean, what: string) => {
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${what}`);
  if (!ok) failures++;
};
const sleep = (ms: number) => new Promise<void>(r => setTimeout(r, ms));

// A local page, so the run is real but nothing leaves the machine.
const html = readFileSync(join(HERE, '..', '..', '..', 'e2e', 'fixtures', 'inaccessible.html'));
const fixture = createServer((_q, r) => r.writeHead(200, { 'Content-Type': 'text/html' }).end(html));
await new Promise<void>(r => fixture.listen(PORT, r));
const TARGET = `http://localhost:${PORT}/`;

// No account needed: the socket tags history with whatever the token says, and an audit
// that is cancelled never gets that far.
const token = jwt.sign({ sub: '000000000000000000000000' }, config.jwtSecret);

interface Seen { errors: string[]; completed: boolean }

function listen(socket: Socket): Seen {
  const seen: Seen = { errors: [], completed: false };
  socket.on('analysis:error', (d: { message: string }) => seen.errors.push(d.message));
  socket.on('analysis:complete', () => { seen.completed = true; });
  return seen;
}

async function connect(): Promise<Socket> {
  const socket = io(BACKEND, { auth: { token }, transports: ['websocket'] });
  await new Promise<void>((resolve, reject) => {
    socket.on('connect', () => resolve());
    socket.on('connect_error', (e: Error) => reject(e));
  });
  return socket;
}

try {
  // ─── Cancelled at three different moments ──────────────────────────────────
  // The failure the cancellation produces depends on what the run was doing: launching a
  // browser, measuring, or processing. All three have to be silent.
  for (const waitMs of [1500, 5000, 11000]) {
    const socket = await connect();
    const seen = listen(socket);
    let analysisId: string | null = null;
    socket.on('analysis:progress', (d: { analysisId: string }) => { analysisId ||= d.analysisId; });

    socket.emit('analysis:start', { url: TARGET });
    await sleep(waitMs);
    const idAtCancel = analysisId;
    socket.emit('analysis:cancel', { analysisId: idAtCancel });
    await sleep(12_000);

    console.log(`\ncancelled ${waitMs}ms in (id ${idAtCancel ? 'known' : 'not yet assigned'})`);
    check(seen.errors.length === 0, `no failure is reported (${seen.errors.join(' | ') || 'silent'})`);
    check(!seen.completed, 'and the run really did stop rather than finishing anyway');
    socket.disconnect();
  }

  // ─── A real failure still speaks ───────────────────────────────────────────
  // The fix must not be "swallow errors on this socket": a run nobody cancelled has to
  // report, or the page waits forever on an audit that already died.
  {
    const socket = await connect();
    const seen = listen(socket);
    socket.emit('analysis:start', { url: 'https://this-domain-does-not-exist-12345.invalid' });
    for (let i = 0; i < 60 && seen.errors.length === 0 && !seen.completed; i++) await sleep(1000);

    console.log('\na page that genuinely cannot be audited');
    check(seen.errors.length === 1, `still reports its failure (${seen.errors[0] ?? 'nothing in 60s'})`);
    socket.disconnect();
  }

  // ─── One socket's cancel is not another's ──────────────────────────────────
  // Cancelled ids are held per connection. Two people stopping their own audits must not
  // silence each other's genuine failures.
  {
    const [a, b] = await Promise.all([connect(), connect()]);
    const seenA = listen(a);
    const seenB = listen(b);
    let idA: string | null = null;
    a.on('analysis:progress', (d: { analysisId: string }) => { idA ||= d.analysisId; });

    a.emit('analysis:start', { url: TARGET });
    b.emit('analysis:start', { url: 'https://this-domain-does-not-exist-12345.invalid' });
    await sleep(5000);
    a.emit('analysis:cancel', { analysisId: idA });
    for (let i = 0; i < 60 && seenB.errors.length === 0; i++) await sleep(1000);

    console.log('\ntwo connections, one of them cancelling');
    check(seenA.errors.length === 0, 'the one that cancelled hears nothing');
    check(seenB.errors.length === 1, `the other still hears its own failure (${seenB.errors[0] ?? 'nothing'})`);
    a.disconnect();
    b.disconnect();
  }
  // ─── Cancelled while still in the queue ────────────────────────────────────
  // Two audits saturate the default cap; the third waits. Cancelling *that* one used to be
  // a no-op, and it ran to completion minutes later.
  {
    const sockets = await Promise.all([connect(), connect(), connect()]);
    const seen = sockets.map(listen);
    const ids: (string | null)[] = [null, null, null];
    const queued = [false, false, false];
    sockets.forEach((socket, i) => {
      socket.on('analysis:progress', (d: { analysisId: string; message: string }) => {
        ids[i] ||= d.analysisId;
        if (/queued/i.test(d.message)) queued[i] = true;
      });
    });

    for (const socket of sockets) socket.emit('analysis:start', { url: TARGET });
    await sleep(4000);

    console.log(`\nthree audits against a cap of two`);
    check(queued[2] === true, `the third one waits in the queue (${queued.join(', ')})`);

    sockets[2]!.emit('analysis:cancel', { analysisId: ids[2] });

    // Long enough for the two ahead of it to finish and free the slot it was waiting for.
    for (let i = 0; i < 150 && !(seen[0]!.completed && seen[1]!.completed); i++) await sleep(1000);
    await sleep(8000);

    check(seen[0]!.completed && seen[1]!.completed, 'the two ahead of it finish normally');
    check(!seen[2]!.completed, 'the cancelled one never runs, even once its slot opens');
    check(seen[2]!.errors.length === 0, `and reports nothing (${seen[2]!.errors.join(' | ') || 'silent'})`);

    for (const socket of sockets) socket.disconnect();
  }
} finally {
  fixture.close();
}

console.log(`\n${failures === 0 ? 'ALL PASS' : `${failures} FAILED`}`);
process.exit(failures === 0 ? 0 : 1);

#!/usr/bin/env node
/**
 * The action's entry point: read what the CLI produced, tell the pull request about it.
 *
 * Deliberately *after* the audit rather than around it — `action.yml` runs
 * `perfscope ci --json` as its own step, so the CLI's own output, annotations and exit code
 * are in the log exactly as somebody running it locally would see them. This step turns
 * that JSON into a comment and a check run, and then re-raises the CLI's verdict.
 *
 * Every GitHub call is best-effort. A build that met its budget must not go red because a
 * comment could not be posted: the audit is the check, the comment is the courtesy. What
 * does decide the exit code is the CLI's own result.
 */
import { readFileSync } from 'node:fs';
import { appendFileSync } from 'node:fs';
import { buildComment, buildCheckRun, buildErrorComment, stickyMarker } from './src/report.js';
import { upsertComment, createCheckRun, pullRequestNumber, headSha } from './src/post.js';

const env = process.env;
const bool = (value) => String(value ?? '').toLowerCase() === 'true';

const resultPath = env.PERFSCOPE_RESULT_FILE ?? 'perfscope-result.json';
const auditExit  = Number(env.PERFSCOPE_EXIT_CODE ?? '0');
const warnOnly   = bool(env.PERFSCOPE_WARN_ONLY);
const wantComment = bool(env.PERFSCOPE_COMMENT);
const wantCheck   = bool(env.PERFSCOPE_CHECK);
const token = env.PERFSCOPE_GITHUB_TOKEN ?? '';
const repo  = env.GITHUB_REPOSITORY ?? '';

const note = (line) => console.log(line);

/** Whatever the CLI wrote. A missing or unparseable file means the audit never got far
 *  enough to write one — which is itself worth reporting rather than crashing on. */
function readResult() {
  try {
    const raw = readFileSync(resultPath, 'utf8').trim();
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function readEvent() {
  try {
    return env.GITHUB_EVENT_PATH ? JSON.parse(readFileSync(env.GITHUB_EVENT_PATH, 'utf8')) : null;
  } catch {
    return null;
  }
}

const result = readResult();
const event  = readEvent();
const eventName = env.GITHUB_EVENT_NAME ?? '';
const url = result?.url ?? env.PERFSCOPE_URL ?? '';

const context = {
  sha: headSha(event, eventName, env.GITHUB_SHA),
  name: env.PERFSCOPE_CHECK_NAME || 'PerfScope budget',
  warnOnly,
};

const body = result
  ? buildComment(result, context)
  : buildErrorComment(url, `The audit did not produce a result (exit code ${auditExit}). See the job log.`);

// The step summary is free and always worth writing: it is the one place the numbers survive
// after the log scrolls, and it works on a push where there is no PR to comment on.
if (env.GITHUB_STEP_SUMMARY) {
  try {
    appendFileSync(env.GITHUB_STEP_SUMMARY, body.replace(stickyMarker(url) + '\n', '') + '\n');
  } catch { /* a summary is a nicety */ }
}

const prNumber = pullRequestNumber(event, eventName);

if (wantComment && token && repo && prNumber) {
  try {
    const { action } = await upsertComment({ token, repo, issueNumber: prNumber, marker: stickyMarker(url), body });
    note(`PerfScope: ${action} the comment on #${prNumber}`);
  } catch (err) {
    // The usual cause is a PR from a fork, whose token is read-only by design.
    note(`PerfScope: could not comment — ${err.message}`);
  }
} else if (wantComment && !prNumber) {
  note('PerfScope: not a pull request event — the summary was written instead of a comment.');
}

if (wantCheck && token && repo && result) {
  try {
    const { url: checkUrl } = await createCheckRun({ token, repo, payload: buildCheckRun(result, context) });
    note(`PerfScope: check run created${checkUrl ? ` — ${checkUrl}` : ''}`);
  } catch (err) {
    note(`PerfScope: could not create the check run — ${err.message}`);
  }
}

// Outputs, so a workflow can branch on the numbers without re-parsing the file.
if (env.GITHUB_OUTPUT && result) {
  try {
    appendFileSync(env.GITHUB_OUTPUT, [
      `passed=${result.passed}`,
      `performance=${result.scores?.performance ?? ''}`,
      `report-url=${result.reportUrl ?? ''}`,
      `result-file=${resultPath}`,
      '',
    ].join('\n'));
  } catch { /* outputs are a convenience */ }
}

// The CLI already decided: 0 passed, 1 breached, 2 could not run. `--warn-only` is handled
// inside the CLI (it exits 0), so nothing is re-interpreted here — re-deriving the verdict
// in a second place is how the badge and the build come to disagree.
process.exit(auditExit);

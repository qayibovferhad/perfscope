/**
 * The half that talks to GitHub.
 *
 * Plain `fetch` against the REST API rather than `@actions/github`: this action ships as a
 * composite (no bundler, no committed `dist/`), and what it needs from that library is three
 * endpoints. Node 20 on every runner has `fetch`.
 *
 * Nothing here throws upward. A comment that could not be posted must not fail a build that
 * passed its budget — the *audit* is the check, the comment is the courtesy — so each call
 * reports what happened and lets the caller carry on.
 */

/**
 * The API root.
 *
 * GitHub sets `GITHUB_API_URL` on every runner — it is `https://api.github.com` on
 * github.com and something else entirely on GitHub Enterprise Server, where hardcoding the
 * public host means the action silently does nothing on the only host that matters. Reading
 * it is also what lets the end-to-end check point this at a local stub.
 */
const API = () => (process.env.GITHUB_API_URL || 'https://api.github.com').replace(/\/$/, '');

async function gh(token, method, path, body) {
  const res = await fetch(`${API()}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'Content-Type': 'application/json',
      'User-Agent': 'perfscope-action',
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`GitHub ${method} ${path} → ${res.status} ${text.slice(0, 200)}`);
  }
  return res.status === 204 ? null : res.json();
}

/**
 * Post the comment, or edit the one already there.
 *
 * The marker is searched for across the whole thread rather than remembered between runs:
 * an action has no state, and the previous run's comment id is exactly the sort of thing
 * that would be stored in one more place and go stale.
 */
export async function upsertComment({ token, repo, issueNumber, marker, body }) {
  const [owner, name] = repo.split('/');
  const base = `/repos/${owner}/${name}/issues/${issueNumber}/comments`;

  // A hundred is more comments than any PR this is used on, and paging further to find a
  // marker that is not there costs more than posting a second comment would.
  const existing = await gh(token, 'GET', `${base}?per_page=100`);
  const mine = existing.find((c) => typeof c.body === 'string' && c.body.includes(marker));

  if (mine) {
    await gh(token, 'PATCH', `/repos/${owner}/${name}/issues/comments/${mine.id}`, { body });
    return { action: 'updated', id: mine.id };
  }

  const created = await gh(token, 'POST', base, { body });
  return { action: 'created', id: created.id };
}

/** Create the check run. Separate from the comment on purpose: a fork PR's token can write
 *  neither, a same-repo token can write both, and a repo may want only one of them. */
export async function createCheckRun({ token, repo, payload }) {
  const [owner, name] = repo.split('/');
  const created = await gh(token, 'POST', `/repos/${owner}/${name}/check-runs`, payload);
  return { id: created.id, url: created.html_url };
}

/**
 * Which pull request this run belongs to, if any.
 *
 * `pull_request` events carry it in the payload. A `push` to a branch does not, and this
 * deliberately does not go looking: commenting on a PR from a push event is how a comment
 * lands on a PR nobody was looking at.
 */
export function pullRequestNumber(event, eventName) {
  if (eventName === 'pull_request' || eventName === 'pull_request_target') {
    return event?.pull_request?.number ?? null;
  }
  if (eventName === 'issue_comment' && event?.issue?.pull_request) return event.issue.number;
  return null;
}

/**
 * The commit the check belongs to.
 *
 * For a `pull_request` event `GITHUB_SHA` is the *merge* commit GitHub invented, which no
 * branch points at — a check run against it is not shown on the PR. The head sha of the PR
 * is the one that is.
 */
export function headSha(event, eventName, fallback) {
  if (eventName === 'pull_request' || eventName === 'pull_request_target') {
    return event?.pull_request?.head?.sha ?? fallback;
  }
  return fallback;
}

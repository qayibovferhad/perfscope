import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * `docs/api/openapi.json` is generated (`pnpm openapi` in apps/backend) from the README's
 * tables and the shared types. This is the cheap half of keeping it current: the operation
 * list must be the README's, so documenting a route and forgetting to regenerate fails here
 * — and since `routes.contract.test.ts` holds the README to the routers, the spec follows
 * the code. The expensive half, the schemas, is `pnpm openapi --check` in CI, because it
 * compiles the shared package and takes seconds rather than milliseconds.
 */

const DOCS = join(import.meta.dirname, '..', '..', '..', '..', 'docs', 'api');

interface Spec {
  openapi: string;
  paths: Record<string, Record<string, { security?: unknown[] }>>;
}

const spec = JSON.parse(readFileSync(join(DOCS, 'openapi.json'), 'utf8')) as Spec;
const readme = readFileSync(join(DOCS, 'README.md'), 'utf8');

function fromReadme(): Map<string, boolean> {
  const rows = new Map<string, boolean>();
  for (const m of readme.matchAll(/^\| (🔑|🔓) \| `(GET|POST|PUT|PATCH|DELETE) ([^`\s]+)`/gmu)) {
    rows.set(`${m[2]} ${m[3]!.replace(/:(\w+)/g, '{$1}')}`, m[1] === '🔑');
  }
  return rows;
}

function fromSpec(): Map<string, boolean> {
  const ops = new Map<string, boolean>();
  for (const [path, methods] of Object.entries(spec.paths)) {
    for (const [method, op] of Object.entries(methods)) {
      // An operation opts out of the global bearer requirement with `security: []`.
      ops.set(`${method.toUpperCase()} ${path}`, !(Array.isArray(op.security) && op.security.length === 0));
    }
  }
  return ops;
}

describe('the OpenAPI spec is the README, regenerated', () => {
  const documented = fromReadme();
  const specified = fromSpec();

  it('is OpenAPI 3.1', () => {
    expect(spec.openapi).toBe('3.1.0');
  });

  it('lists exactly the README routes — run `pnpm openapi` in apps/backend if not', () => {
    expect([...specified.keys()].sort()).toEqual([...documented.keys()].sort());
  });

  it('asks for a token exactly where the README does', () => {
    const mismatched = [...documented].filter(([route, auth]) => specified.get(route) !== auth);
    expect(mismatched).toEqual([]);
  });
});

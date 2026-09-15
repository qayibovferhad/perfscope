/**
 * Writes `docs/api/openapi.json` — the machine-readable half of the API reference.
 *
 * Nothing here is written twice. The *operations* (method, path, token or not, what it is
 * for, which section) come from `docs/api/README.md`, whose tables
 * `src/routes/routes.contract.test.ts` already holds to the routers. The *shapes* come
 * from `@perfscope/shared`, the same types the dashboard, the extension and the CLI compile
 * against. The one hand-written file is `operations.ts`, which says which of those types
 * each route answers with — and this script refuses to run when it names a type that does
 * not exist or a route the README does not have.
 *
 * From apps/backend:
 *
 *     pnpm openapi            # regenerate
 *     pnpm openapi --check    # exit 1 when the committed file is stale (CI)
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { createGenerator, type Definition } from 'ts-json-schema-generator';
import { OPERATIONS, type OperationTypes, type Schema } from './operations.js';

const ROOT       = join(import.meta.dirname, '..', '..', '..');
const DOC_FILE   = join(ROOT, 'docs', 'api', 'README.md');
const OUT_FILE   = join(ROOT, 'docs', 'api', 'openapi.json');
const SHARED     = join(ROOT, 'packages', 'shared');

interface DocOperation {
  method:  string;
  path:    string;
  auth:    boolean;
  tag:     string;
  text:    string;
}

// ── The README's tables ──────────────────────────────────────────────────────

/**
 * Every table row, with the section it sits under as its tag. `###` sub-sections keep
 * their parent's tag — "CLI sign-in" is part of auth, not a peer of it.
 */
function readDoc(): { intro: string; operations: DocOperation[]; tagText: Map<string, string> } {
  const lines = readFileSync(DOC_FILE, 'utf8').split('\n');
  const operations: DocOperation[] = [];
  /** The prose between a section's heading and its first table or sub-heading. */
  const tagText = new Map<string, string>();
  let tag = '';
  let prose: string[] | null = null;
  for (const line of lines) {
    const section = /^## (.+)$/.exec(line);
    if (section) {
      tag = section[1]!.trim();
      prose = [];
      continue;
    }
    if (prose && (line.startsWith('|') || line.startsWith('#'))) {
      const text = prose.join('\n').trim();
      if (text) tagText.set(tag, text);
      prose = null;
    } else if (prose) {
      prose.push(line);
    }
    const row = /^\| (🔑|🔓) \| `(GET|POST|PUT|PATCH|DELETE) ([^`\s]+)` \| (.+) \|$/u.exec(line);
    if (!row) continue;
    operations.push({
      auth:   row[1] === '🔑',
      method: row[2]!,
      path:   row[3]!,
      text:   row[4]!.replace(/\\\|/g, '|').trim(),
      tag,
    });
  }
  const intro = lines.slice(1, lines.findIndex(l => l.startsWith('## '))).join('\n').trim();
  return { intro, operations, tagText };
}

/** The first sentence, without Markdown — OpenAPI's `summary` is plain text. */
function summaryOf(text: string): string {
  const plain = text.replace(/\*\*|`/g, '').replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');
  const end = plain.search(/[.;](\s|$)/);
  return (end === -1 ? plain : plain.slice(0, end)).trim();
}

/** `/api/websites/:id` → `/api/websites/{id}`, and the names it declares. */
function openapiPath(path: string): { path: string; params: string[] } {
  const params: string[] = [];
  const converted = path.replace(/:(\w+)/g, (_, name: string) => { params.push(name); return `{${name}}`; });
  return { path: converted, params };
}

/**
 * `GET /api/websites/:id/rum/trend` → `getWebsitesByIdRumTrend`. Derived, not chosen, so
 * a generated client's method names change exactly when a route does.
 */
function operationId(doc: DocOperation): string {
  const words = doc.path
    .replace(/^\/api(?=\/|$)/, '')
    .split(/[/.-]/)
    .filter(Boolean)
    .map(seg => (seg.startsWith(':') ? `by-${seg.slice(1)}` : seg))
    .flatMap(seg => seg.split('-'));
  return [doc.method.toLowerCase(), ...words.map(w => w[0]!.toUpperCase() + w.slice(1))].join('');
}

// ── Shared types → components.schemas ────────────────────────────────────────

/** Type names an operation refers to: `HistoryEntry[]` refers to `HistoryEntry`. */
function typeNames(op: OperationTypes): string[] {
  const named = [op.response, op.body]
    .filter((t): t is string => typeof t === 'string')
    .map(t => t.replace(/\[\]$/, ''));
  // Inline schemas reach shared types through `ref()`, and those have to exist too.
  const referenced = [...JSON.stringify(op).matchAll(/#\/components\/schemas\/(\w+)/g)].map(m => m[1]!);
  return [...named, ...referenced];
}

/**
 * One generator, one type at a time, definitions merged. Asking for `*` instead silently
 * drops what it cannot place; asking by name fails loudly on a name that does not exist,
 * which is the check this file exists to make.
 */
function buildSchemas(names: string[]): Record<string, Definition> {
  const generator = createGenerator({
    path:           join(SHARED, 'src', 'index.ts'),
    tsconfig:       join(SHARED, 'tsconfig.json'),
    // `tsc` already checks shared; the generator's own checker is a second, slower copy.
    skipTypeCheck:  true,
    expose:         'export',
    topRef:         false,
    jsDoc:          'extended',
    // A response description must let the server add a field without every client that
    // validates against it calling the server broken. Strict objects also reject what
    // Mongoose adds to a returned document (`__v`, `updatedAt`), which no client reads.
    additionalProperties: true,
  });
  const schemas: Record<string, Definition> = {};
  for (const name of [...new Set(names)].sort()) {
    let schema: Definition;
    try {
      schema = generator.createSchema(name);
    } catch (err) {
      throw new Error(`operations.ts names "${name}", which @perfscope/shared does not export as a type: ${(err as Error).message}`, { cause: err });
    }
    const { definitions, $schema: _drop, ...root } = schema as Definition & { $schema?: string };
    Object.assign(schemas, definitions ?? {});
    schemas[name] = root;
  }
  return rewriteRefs(schemas) as Record<string, Definition>;
}

/**
 * JSON Schema's `#/definitions/X` is OpenAPI's `#/components/schemas/X`. Generic
 * instantiations come out named `Paginated<WebsiteDoc>`, which a component key may not
 * contain, so they are renamed consistently on both sides.
 */
function componentName(name: string): string {
  return decodeURIComponent(name).replace(/[<>]/g, (c) => (c === '<' ? '_' : '')).replace(/[^\w.-]/g, '_');
}

function rewriteRefs(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(rewriteRefs);
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [key, inner] of Object.entries(value)) {
      if (key === '$ref' && typeof inner === 'string') {
        out[key] = `#/components/schemas/${componentName(inner.replace('#/definitions/', ''))}`;
      } else if (key === 'definitions') {
        continue;
      } else {
        // Component keys of the top-level map are renamed by the caller's Object.entries.
        out[key] = rewriteRefs(inner);
      }
    }
    return out;
  }
  return value;
}

function refTo(type: string): Schema {
  if (type.endsWith('[]')) return { type: 'array', items: refTo(type.slice(0, -2)) };
  return { $ref: `#/components/schemas/${componentName(type)}` };
}

// ── Assembly ─────────────────────────────────────────────────────────────────

function envelope(data: Schema): Schema {
  return {
    type: 'object',
    required: ['success', 'data'],
    properties: { success: { type: 'boolean', const: true }, data },
  };
}

function operationObject(doc: DocOperation, types: OperationTypes, params: string[]) {
  const status = String(types.status ?? 200);
  const parameters: unknown[] = [
    ...params.map(name => ({ name, in: 'path', required: true, schema: { type: 'string' } })),
    ...Object.entries(types.query ?? {}).map(([name, q]) => ({
      name, in: 'query', required: q.required ?? false,
      ...(q.description ? { description: q.description } : {}),
      schema: q.schema,
    })),
    ...(doc.auth ? [{ $ref: '#/components/parameters/TeamId' }] : []),
  ];

  let success: Record<string, unknown>;
  if (status === '204') {
    success = { description: 'No content.' };
  } else if (types.contentType) {
    success = { description: 'OK', content: { [types.contentType]: { schema: { type: 'string' } } } };
  } else {
    const data: Schema =
      types.response === null ? { type: 'null' }
      : typeof types.response === 'string' ? refTo(types.response)
      : types.response;
    success = {
      description: 'OK',
      content: { 'application/json': { schema: types.raw ? data : envelope(data) } },
    };
  }

  const body = types.body === undefined ? undefined : {
    required: true,
    content: { [types.bodyContentType ?? 'application/json']: {
      schema: typeof types.body === 'string' ? refTo(types.body) : types.body,
    } },
  };

  return {
    tags:        [doc.tag],
    summary:     summaryOf(doc.text),
    description: doc.text,
    operationId: operationId(doc),
    ...(parameters.length ? { parameters } : {}),
    ...(body ? { requestBody: body } : {}),
    responses: {
      [status]: success,
      ...(doc.auth ? { '401': { $ref: '#/components/responses/Unauthorized' } } : {}),
      '4XX': { $ref: '#/components/responses/Error' },
      '5XX': { $ref: '#/components/responses/Error' },
    },
    ...(doc.auth ? {} : { security: [] }),
  };
}

function build(): string {
  const { intro, operations, tagText } = readDoc();

  const keys = new Set(operations.map(o => `${o.method} ${o.path}`));
  const missing = operations.filter(o => !(`${o.method} ${o.path}` in OPERATIONS));
  const extra = Object.keys(OPERATIONS).filter(k => !keys.has(k));
  if (missing.length || extra.length) {
    throw new Error(
      'operations.ts and docs/api/README.md disagree.\n' +
      (missing.length ? `  In the README, not in operations.ts: ${missing.map(o => `${o.method} ${o.path}`).join(', ')}\n` : '') +
      (extra.length ? `  In operations.ts, not in the README: ${extra.join(', ')}\n` : ''),
    );
  }

  const paths: Record<string, Record<string, unknown>> = {};
  const tags: string[] = [];
  for (const doc of operations) {
    const types = OPERATIONS[`${doc.method} ${doc.path}`]!;
    const { path, params } = openapiPath(doc.path);
    if (!tags.includes(doc.tag)) tags.push(doc.tag);
    (paths[path] ??= {})[doc.method.toLowerCase()] = operationObject(doc, types, params);
  }

  const raw = buildSchemas(Object.values(OPERATIONS).flatMap(typeNames));
  const schemas = Object.fromEntries(
    Object.entries(raw).map(([name, s]) => [componentName(name), s]).sort(([a], [b]) => String(a).localeCompare(String(b))),
  );

  const spec = {
    openapi: '3.1.0',
    info: {
      title:   'PerfScope API',
      license: { name: 'MIT', identifier: 'MIT' },
      version: (JSON.parse(readFileSync(join(import.meta.dirname, '..', 'package.json'), 'utf8')) as { version: string }).version,
      description:
        `${intro}\n\n` +
        'Generated from `docs/api/README.md` and the `@perfscope/shared` types by ' +
        '`apps/backend/openapi/build.mts` — edit those, never this file.',
    },
    // Relative: the deployment serves the API on the dashboard's own origin (nginx proxies
    // /api), so the right server is whichever one the spec was fetched from.
    servers: [{ url: '/', description: 'The origin serving this PerfScope install' }],
    tags: tags.map(name => ({ name, description: tagText.get(name) ?? `${name} routes.` })),
    security: [{ bearerAuth: [] }],
    paths,
    components: {
      securitySchemes: {
        bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT',
          description: 'Access token from /api/auth/login, /register or /refresh. Lasts 30 minutes.' },
      },
      parameters: {
        TeamId: { name: 'X-Team-Id', in: 'header', required: false, schema: { type: 'string' },
          description: 'Act inside a team: the request is resolved to the team owner\'s account.' },
      },
      responses: {
        Unauthorized: { description: 'Missing, invalid or expired access token.',
          content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiError' } } } },
        Error: { description: 'Any failure: `{ success: false, error }`.',
          content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiError' } } } },
      },
      schemas: {
        ApiError: { type: 'object', required: ['success', 'error'],
          properties: { success: { type: 'boolean', const: false }, error: { type: 'string' } } },
        ...schemas,
      },
    },
  };
  return `${JSON.stringify(spec, null, 2)}\n`;
}

const next = build();
if (process.argv.includes('--check')) {
  let current = '';
  try { current = readFileSync(OUT_FILE, 'utf8'); } catch { /* missing counts as stale */ }
  if (current !== next) {
    console.error('docs/api/openapi.json is stale — run `pnpm openapi` in apps/backend and commit the result.');
    process.exit(1);
  }
  console.log('docs/api/openapi.json is current.');
} else {
  writeFileSync(OUT_FILE, next);
  console.log(`Wrote ${OUT_FILE}`);
}

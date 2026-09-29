import { Router } from 'express';
import { readFile } from 'node:fs/promises';
import { AppError, asyncHandler } from '../lib/errors.js';
import { config } from '../config/index.js';
import { log } from '../lib/logger.js';

/**
 * The machine-readable API reference, served by the API it describes.
 *
 * `docs/api/openapi.json` is generated (`pnpm openapi` in apps/backend) and checked in;
 * this reads that file — the same one the contract tests hold to the README — rather than
 * building a second copy at runtime, so the served spec cannot drift from the documented
 * one. The Dockerfile copies it in beside the source; an install without it answers 404
 * with the reason instead of an empty document.
 *
 * Neither route uses the `{ success, data }` envelope: the spec is the document itself,
 * and a client pointing a generator at `/api/openapi.json` expects OpenAPI, not a wrapper.
 */
export const openapiRouter: Router = Router();

/** src/routes/ and dist/routes/ are the same depth, so one relative path serves both. */
const SPEC_URL = new URL('../../../../docs/api/openapi.json', import.meta.url);

let cached: Promise<string> | null = null;

function loadSpec(): Promise<string> {
  // Read once per process, then serve from memory; a miss is not cached so an operator can
  // drop the file in without a restart.
  if (!cached) {
    cached = readFile(SPEC_URL, 'utf8').catch((err: unknown) => {
      cached = null;
      log.warn('OpenAPI', 'spec file is not readable', { path: SPEC_URL.pathname, err: String(err) });
      throw new AppError(404, 'OpenAPI spec is not available on this install', 'OPENAPI_MISSING');
    });
  }
  return cached;
}

openapiRouter.get('/openapi.json', asyncHandler(async (_req, res) => {
  const spec = await loadSpec();
  res.type('application/json').send(spec);
}));

/**
 * Swagger UI over the spec above, loaded from a CDN.
 *
 * The page is the one place this server allows a third-party script, so it carries its
 * own Content-Security-Policy rather than loosening helmet's for every route. Pinned to a
 * major version: `latest` is a page that changes under a link somebody bookmarked.
 */
const SWAGGER_CDN = 'https://cdn.jsdelivr.net/npm/swagger-ui-dist@5';

openapiRouter.get('/docs', asyncHandler(async (_req, res) => {
  await loadSpec();
  // A CSP source with a path matches that path *exactly* unless it ends in a slash — the
  // first version of this header named the package directory and blocked every file in it.
  res.setHeader('Content-Security-Policy', [
    "default-src 'none'",
    `script-src ${SWAGGER_CDN}/ 'unsafe-inline'`,
    `style-src ${SWAGGER_CDN}/ 'unsafe-inline'`,
    `img-src data: ${SWAGGER_CDN}/`,
    "font-src data:",
    "connect-src 'self'",
  ].join('; '));
  res.type('html').send(`<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>PerfScope API ${config.appVersion}</title>
  <link rel="stylesheet" href="${SWAGGER_CDN}/swagger-ui.css">
</head>
<body>
  <div id="swagger-ui"></div>
  <script src="${SWAGGER_CDN}/swagger-ui-bundle.js" crossorigin></script>
  <script>
    window.ui = SwaggerUIBundle({ url: 'openapi.json', dom_id: '#swagger-ui', deepLinking: true, tryItOutEnabled: true });
  </script>
</body>
</html>`);
}));

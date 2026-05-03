// Catalog import route handler
import type { IncomingMessage, ServerResponse } from 'node:http';
import { parseBody, sendJson } from './_utils.js';
import { createErrorEnvelope } from '@profileaxis/ai-contracts';
import { importCatalog } from '../services/catalog/index.js';
import type { CatalogImportInput } from '../services/catalog/index.js';
import { CATALOG_FIXTURE } from '@profileaxis/stdlib';

// ── POST /v1/catalog/import ──────────────────────────────────────────────────────

export async function handleCatalogImport(req: IncomingMessage, res: ServerResponse): Promise<void> {
  let body: unknown;
  try {
    body = await parseBody(req);
  } catch {
    sendJson(res, 400, createErrorEnvelope('bad_request', 'Invalid JSON body', 'catalog-import'));
    return;
  }

  const b = body as Record<string, unknown>;

  // Validate required fields
  const format = b.format;
  if (format !== 'xlsx' && format !== 'csv') {
    sendJson(res, 400, createErrorEnvelope('bad_request', 'Field "format" must be "xlsx" or "csv"', 'catalog-import'));
    return;
  }

  const data = b.data;
  if (typeof data !== 'string' || data.length === 0) {
    sendJson(res, 400, createErrorEnvelope('bad_request', 'Field "data" must be a non-empty base64-encoded string', 'catalog-import'));
    return;
  }

  const version = typeof b.version === 'string' && b.version.trim() ? b.version.trim() : 'imported';

  const input: CatalogImportInput = { format: format as 'xlsx' | 'csv', data };

  const result = importCatalog(input);

  if (result.success) {
    result.catalog.version = version;
    sendJson(res, 200, {
      status: 'ok',
      catalog: result.catalog,
      validation: result.validation,
      warnings: result.warnings,
    });
  } else {
    sendJson(res, 422, {
      status: 'error',
      errors: result.errors,
      warnings: result.warnings,
    });
  }
}

// ── GET /v1/catalog/:version ─────────────────────────────────────────────────────

export async function handleCatalogGet(
  req: IncomingMessage,
  res: ServerResponse,
  _port: number,
): Promise<void> {
  // Extract version from URL path: /v1/catalog/{version}
  const url = req.url ?? '/';
  const match = url.match(/^\/v1\/catalog\/([^/]+)$/);
  const version = match ? decodeURIComponent(match[1]) : 'latest';

  if (version === 'latest' || version === CATALOG_FIXTURE.version) {
    sendJson(res, 200, {
      status: 'ok',
      catalog: CATALOG_FIXTURE,
    });
  } else {
    sendJson(res, 404, createErrorEnvelope('not_found', `Catalog version "${version}" not found`, 'catalog-get'));
  }
}

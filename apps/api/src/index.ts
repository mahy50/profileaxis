// @profileaxis/api — AI Orchestrator, catalog service, PDF export, version service
// Must NOT be imported by any package

import { createServer } from 'node:http';
import type { IncomingMessage, ServerResponse, Server } from 'node:http';
import { STDLIB_VERSION } from '@profileaxis/stdlib';
import { RULE_VERSION } from '@profileaxis/rules';
import { PROMPT_VERSION, createErrorEnvelope } from '@profileaxis/ai-contracts';

import { handleIntent } from './routes/ai-intent.js';
import { handleDraft } from './routes/ai-draft.js';
import { handleEditIntent } from './routes/ai-edit-intent.js';
import { handleCheckExplain } from './routes/check-explain.js';
import { sendJson } from './routes/_utils.js';
import type { OrchestratorConfig } from './services/ai-orchestrator/index.js';
import {
  runIntent,
  runDraft,
  runEditIntent,
  runCheckExplain,
} from './services/ai-orchestrator/index.js';

// ── Version endpoint ───────────────────────────────────────────────────────────────

export function getVersions() {
  return {
    stdlibVersion: STDLIB_VERSION,
    ruleVersion: RULE_VERSION,
    promptVersion: PROMPT_VERSION,
    currentCatalogVersion: STDLIB_VERSION,
  };
}

// ── Placeholder endpoints (to be implemented in future tasks) ──────────────────────

export async function getCatalog(version: string) {
  return { version, message: 'Catalog endpoint not yet implemented' };
}

export async function exportPdf(projectDocument: unknown) {
  return { message: 'PDF export not yet implemented', payload: null };
}

// ── Re-export orchestrator ─────────────────────────────────────────────────────────

export { runIntent, runDraft, runEditIntent, runCheckExplain };
export type { OrchestratorConfig };

// ── API Server ─────────────────────────────────────────────────────────────────────

export interface ApiServerConfig {
  port?: number;
  orchestrator?: OrchestratorConfig;
}

export function createApiServer(config: ApiServerConfig = {}): Server {
  const port = config.port ?? 3000;
  const orchConfig = config.orchestrator;

  const server = createServer(async (req: IncomingMessage, res: ServerResponse) => {
    try {
      const url = req.url ?? '/';
      const method = req.method ?? 'GET';

      // CORS headers
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

      if (method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
      }

      // Route matching
      if (method === 'GET' && url === '/v1/runtime/versions') {
        sendJson(res, 200, getVersions());
        return;
      }

      if (method === 'POST' && url === '/v1/ai/intent') {
        await handleIntent(req, res, orchConfig);
        return;
      }

      if (method === 'POST' && url === '/v1/ai/draft') {
        await handleDraft(req, res, orchConfig);
        return;
      }

      if (method === 'POST' && url === '/v1/ai/edit-intent') {
        await handleEditIntent(req, res, orchConfig);
        return;
      }

      if (method === 'POST' && url === '/v1/ai/check-explain') {
        await handleCheckExplain(req, res, orchConfig);
        return;
      }

      if (method === 'GET' && url.startsWith('/v1/export/pdf')) {
        const version = new URL(url, `http://localhost:${port}`).searchParams.get('version') ?? 'latest';
        sendJson(res, 200, await getCatalog(version));
        return;
      }

      // 404
      sendJson(res, 404, createErrorEnvelope('not_found', `Route ${method} ${url} not found`, 'router'));
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      sendJson(res, 500, createErrorEnvelope('internal_error', message, 'router'));
    }
  });

  server.listen(port, () => {
    console.log(`ProfileAxis API server listening on port ${port}`);
  });

  return server;
}

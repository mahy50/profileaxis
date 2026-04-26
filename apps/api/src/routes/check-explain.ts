// Route handler for POST /v1/ai/check-explain
// Check issues → human-readable explanations

import type { IncomingMessage, ServerResponse } from 'node:http';
import { runCheckExplain } from '../services/ai-orchestrator/index.js';
import type { OrchestratorConfig } from '../services/ai-orchestrator/index.js';
import { createErrorEnvelope } from '@profileaxis/ai-contracts';
import type { CheckIssue } from '@profileaxis/schemas';
import { parseBody, sendJson } from './_utils.js';

interface CheckExplainRequestBody {
  issues: CheckIssue[];
  locale?: 'zh-CN' | 'en-US';
}

export async function handleCheckExplain(
  req: IncomingMessage,
  res: ServerResponse,
  config?: OrchestratorConfig
): Promise<void> {
  try {
    const body = (await parseBody(req)) as CheckExplainRequestBody;

    if (!body.issues || !Array.isArray(body.issues) || body.issues.length === 0) {
      sendJson(res, 400, createErrorEnvelope('invalid_request', 'issues field is required and must be a non-empty array', 'req-check-explain'));
      return;
    }

    const locale = body.locale ?? 'zh-CN';
    if (locale !== 'zh-CN' && locale !== 'en-US') {
      sendJson(res, 400, createErrorEnvelope('invalid_request', 'locale must be zh-CN or en-US', 'req-check-explain'));
      return;
    }

    const result = await runCheckExplain(body.issues, locale, config);
    sendJson(res, 200, result);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    sendJson(res, 500, createErrorEnvelope('internal_error', message, 'req-check-explain'));
  }
}

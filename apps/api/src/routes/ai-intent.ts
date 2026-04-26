// Route handler for POST /v1/ai/intent
// User text → structured IntentDsl

import type { IncomingMessage, ServerResponse } from 'node:http';
import { runIntent } from '../services/ai-orchestrator/index.js';
import type { OrchestratorConfig } from '../services/ai-orchestrator/index.js';
import { createErrorEnvelope } from '@profileaxis/ai-contracts';
import { parseBody, sendJson } from './_utils.js';

interface IntentRequestBody {
  text: string;
  locale?: 'zh-CN' | 'en-US';
}

export async function handleIntent(
  req: IncomingMessage,
  res: ServerResponse,
  config?: OrchestratorConfig
): Promise<void> {
  try {
    const body = (await parseBody(req)) as IntentRequestBody;

    if (!body.text || typeof body.text !== 'string' || body.text.trim().length === 0) {
      sendJson(res, 400, createErrorEnvelope('invalid_request', 'text field is required and must be non-empty', 'req-intent'));
      return;
    }

    const locale = body.locale ?? 'zh-CN';
    if (locale !== 'zh-CN' && locale !== 'en-US') {
      sendJson(res, 400, createErrorEnvelope('invalid_request', 'locale must be zh-CN or en-US', 'req-intent'));
      return;
    }

    const result = await runIntent(body.text.trim(), locale, config);
    sendJson(res, 200, result);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    sendJson(res, 500, createErrorEnvelope('internal_error', message, 'req-intent'));
  }
}

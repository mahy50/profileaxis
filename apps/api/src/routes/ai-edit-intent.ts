// Route handler for POST /v1/ai/edit-intent
// Reference context + edit text → EditIntent

import type { IncomingMessage, ServerResponse } from 'node:http';
import { runEditIntent } from '../services/ai-orchestrator/index.js';
import type { OrchestratorConfig } from '../services/ai-orchestrator/index.js';
import { createErrorEnvelope } from '@profileaxis/ai-contracts';
import type { ReferenceContext } from '@profileaxis/schemas';
import { parseBody, sendJson } from './_utils.js';

interface EditIntentRequestBody {
  referenceContext: ReferenceContext;
  editText: string;
}

export async function handleEditIntent(
  req: IncomingMessage,
  res: ServerResponse,
  config?: OrchestratorConfig
): Promise<void> {
  try {
    const body = (await parseBody(req)) as EditIntentRequestBody;

    if (!body.referenceContext) {
      sendJson(res, 400, createErrorEnvelope('invalid_request', 'referenceContext field is required', 'req-edit-intent'));
      return;
    }

    if (!body.editText || typeof body.editText !== 'string' || body.editText.trim().length === 0) {
      sendJson(res, 400, createErrorEnvelope('invalid_request', 'editText field is required and must be non-empty', 'req-edit-intent'));
      return;
    }

    const result = await runEditIntent(body.referenceContext, body.editText.trim(), config);
    sendJson(res, 200, result);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    sendJson(res, 500, createErrorEnvelope('internal_error', message, 'req-edit-intent'));
  }
}

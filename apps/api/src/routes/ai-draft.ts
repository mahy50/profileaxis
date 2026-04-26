// Route handler for POST /v1/ai/draft
// Confirmed intent → DraftDsl + ResolvedDsl + CheckIssues

import type { IncomingMessage, ServerResponse } from 'node:http';
import { runDraft } from '../services/ai-orchestrator/index.js';
import type { OrchestratorConfig } from '../services/ai-orchestrator/index.js';
import { createErrorEnvelope } from '@profileaxis/ai-contracts';
import type { IntentDsl, ConfirmationDsl } from '@profileaxis/schemas';
import { validateIntent, validateConfirmation } from '@profileaxis/schemas';
import { parseBody, sendJson } from './_utils.js';

interface DraftRequestBody {
  intentDsl: IntentDsl;
  confirmationDsl?: ConfirmationDsl | null;
}

export async function handleDraft(
  req: IncomingMessage,
  res: ServerResponse,
  config?: OrchestratorConfig
): Promise<void> {
  try {
    const body = (await parseBody(req)) as DraftRequestBody;

    if (!body.intentDsl) {
      sendJson(res, 400, createErrorEnvelope('invalid_request', 'intentDsl field is required', 'req-draft'));
      return;
    }

    const dslResult = validateIntent(body.intentDsl);
    if (!dslResult.valid) {
      sendJson(res, 400,
        createErrorEnvelope('invalid_request', `Invalid intentDsl: ${JSON.stringify(dslResult.errors)}`, 'req-draft')
      );
      return;
    }

    if (body.confirmationDsl) {
      const confResult = validateConfirmation(body.confirmationDsl);
      if (!confResult.valid) {
        sendJson(res, 400,
          createErrorEnvelope('invalid_request', `Invalid confirmationDsl: ${JSON.stringify(confResult.errors)}`, 'req-draft')
        );
        return;
      }
    }

    const result = await runDraft(body.intentDsl, body.confirmationDsl ?? null, config);
    sendJson(res, 200, result);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    sendJson(res, 500, createErrorEnvelope('internal_error', message, 'req-draft'));
  }
}

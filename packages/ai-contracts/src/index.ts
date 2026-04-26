// @profileaxis/ai-contracts — Main entry point
// Re-exports all AI contract types, prompts, tool schemas, and DTOs.

export const PROMPT_VERSION = '1.0.0-m1';

// ── Prompts ───────────────────────────────────────────────────────────────────
export {
  buildIntentSystemPrompt,
  buildIntentUserPrompt,
} from './prompts/intent.js';

export {
  buildDraftSystemPrompt,
  buildDraftUserPrompt,
} from './prompts/draft.js';

export {
  buildEditIntentSystemPrompt,
  buildEditIntentUserPrompt,
} from './prompts/edit-intent.js';

export {
  buildCheckExplainSystemPrompt,
  buildCheckExplainUserPrompt,
} from './prompts/check-explain.js';

// ── Tool Schemas ──────────────────────────────────────────────────────────────
export {
  TOOL_INTENT_SCHEMA,
  TOOL_DRAFT_SCHEMA,
  TOOL_EDIT_INTENT_SCHEMA,
  TOOL_CHECK_EXPLAIN_SCHEMA,
} from './tools/index.js';
export type { ToolSchema } from './tools/index.js';

// ── DTOs ──────────────────────────────────────────────────────────────────────
export {
  createErrorEnvelope,
  isOK,
  isRefusal,
  isSchemaError,
} from './dto/index.js';
export type {
  AIErrorEnvelope,
  AIResponseStatus,
  AIResponse,
  IntentResponse,
  DraftResponse,
  EditIntentResponse,
  CheckExplainResponse,
  RefusalResponse,
  SchemaErrorResponse,
} from './dto/index.js';

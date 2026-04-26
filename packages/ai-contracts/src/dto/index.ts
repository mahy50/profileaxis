// @profileaxis/ai-contracts/dto — AI I/O DTOs and error handling (M1 frozen)

export { createErrorEnvelope } from './error-envelope.js';
export type { AIErrorEnvelope } from './error-envelope.js';

export { isOK, isRefusal, isSchemaError } from './ai-response.js';
export type { AIResponseStatus } from './ai-response.js';
export type {
  AIResponse,
  IntentResponse,
  IntentData,
  DraftResponse,
  DraftResponseData,
  EditIntentResponse,
  EditIntentData,
  CheckExplainResponse,
  CheckExplainData,
  RefusalResponse,
  SchemaErrorResponse,
} from './ai-response.js';

// @profileaxis/ai-contracts/dto/ai-response — AI response DTO types (M1 frozen)

import type { IntentDsl, DraftDsl } from '@profileaxis/schemas';

export type AIResponseStatus = 'ok' | 'refusal' | 'schema_error';

/**
 * Base AI response. All AI endpoints return one of these three states.
 */
export type AIResponse<T> =
  | { status: 'ok'; data: T }
  | { status: 'refusal'; reason: string }
  | { status: 'schema_error'; message: string; rawOutput?: string };

/**
 * Intent extraction response.
 */
export interface IntentData {
  intentDsl: IntentDsl;
  ambiguities: Array<{ key: string; question: string; status: 'open' | 'resolved' }>;
}
export type IntentResponse = AIResponse<IntentData>;

/**
 * Draft proposal response.
 */
export interface DraftResponseData {
  draftDsl: DraftDsl;
  notes: string[];
}
export type DraftResponse = AIResponse<DraftResponseData>;

/**
 * Edit intent resolution response.
 */
export interface EditIntentData {
  action: string;
  targetMode: 'selected' | 'semantic' | 'relative' | 'global';
  targetRef: Record<string, unknown>;
  params: Record<string, unknown>;
  confidence: number;
  needsFollowUp: boolean;
  followUpQuestion?: string;
}
export type EditIntentResponse = AIResponse<EditIntentData>;

/**
 * Check issue explanation response.
 */
export interface CheckExplainData {
  explanations: Array<{
    issueId?: string;
    nodeId?: string;
    jointId?: string;
    severity: string;
    what: string;
    why: string;
    howToResolve?: string;
  }>;
}
export type CheckExplainResponse = AIResponse<CheckExplainData>;

/**
 * Refusal response with reason.
 */
export interface RefusalResponse {
  status: 'refusal';
  reason: string;
}

/**
 * Schema error response.
 */
export interface SchemaErrorResponse {
  status: 'schema_error';
  message: string;
  rawOutput?: string;
}

// ── Type guards ────────────────────────────────────────────────────────────────

export function isOK<T>(
  resp: { status: string; data?: T }
): resp is { status: 'ok'; data: T } {
  return resp.status === 'ok';
}

export function isRefusal<T>(
  resp: { status: string }
): resp is { status: 'refusal'; reason: string } {
  return resp.status === 'refusal';
}

export function isSchemaError<T>(
  resp: { status: string }
): resp is { status: 'schema_error'; message: string } {
  return resp.status === 'schema_error';
}

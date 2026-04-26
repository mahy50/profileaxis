// @profileaxis/api — AI Orchestrator service
// Wraps Anthropic API calls with prompt injection from ai-contracts,
// response validation with schema validators, and AIResponse envelope.

import Anthropic from '@anthropic-ai/sdk';
import type { Message } from '@anthropic-ai/sdk/resources/messages.mjs';
import {
  buildIntentSystemPrompt,
  buildIntentUserPrompt,
  buildDraftSystemPrompt,
  buildDraftUserPrompt,
  buildEditIntentSystemPrompt,
  buildEditIntentUserPrompt,
  buildCheckExplainSystemPrompt,
  buildCheckExplainUserPrompt,
  TOOL_INTENT_SCHEMA,
  TOOL_DRAFT_SCHEMA,
  TOOL_EDIT_INTENT_SCHEMA,
  TOOL_CHECK_EXPLAIN_SCHEMA,
  createErrorEnvelope,
} from '@profileaxis/ai-contracts';
import type {
  IntentResponse,
  DraftResponse,
  EditIntentResponse,
  CheckExplainResponse,
  AIResponse,
} from '@profileaxis/ai-contracts';
import type { IntentDsl, ConfirmationDsl, DraftDsl, ResolvedDsl, CheckIssue } from '@profileaxis/schemas';
import type { ReferenceContext } from '@profileaxis/schemas';
import { validateDraft, validateIntent } from '@profileaxis/schemas';
import { runPipeline } from '@profileaxis/rules';

// ── Types ──────────────────────────────────────────────────────────────────────────

export interface OrchestratorConfig {
  model?: string;
  maxTokens?: number;
  client?: Anthropic;
}

export interface DraftResult {
  draftDsl: DraftDsl;
  resolvedDsl: ResolvedDsl;
  issues: CheckIssue[];
  notes: string[];
}

export type DraftEndpointResponse = AIResponse<DraftResult>;

// ── Orchestrator ───────────────────────────────────────────────────────────────────

const DEFAULT_MODEL = 'claude-sonnet-4-6';
const DEFAULT_MAX_TOKENS = 4096;

function getClient(client?: Anthropic): Anthropic {
  if (client) return client;
  const apiKey = process.env.ANTHROPIC_API_KEY;
  return new Anthropic({ apiKey: apiKey ?? 'mock-key' });
}

async function callModel(
  anthropic: Anthropic,
  model: string,
  maxTokens: number,
  systemPrompt: string,
  userMessage: string,
  toolSchema: { name: string; description: string; inputSchema: Record<string, unknown> }
): Promise<Message> {
  return anthropic.messages.create({
    model,
    max_tokens: maxTokens,
    system: systemPrompt,
    messages: [{ role: 'user', content: userMessage }],
    tools: [
      {
        name: toolSchema.name,
        description: toolSchema.description,
        input_schema: toolSchema.inputSchema as Anthropic.Tool.InputSchema,
      },
    ],
    tool_choice: { type: 'tool', name: toolSchema.name },
  });
}

function extractToolInput(msg: Message): unknown {
  for (const block of msg.content) {
    if (block.type === 'tool_use') {
      return (block as { input: unknown }).input;
    }
  }
  return null;
}

function refusalResponse(reason: string): { status: 'refusal'; reason: string } {
  return { status: 'refusal', reason };
}

function schemaErrorResponse(message: string, raw?: string): { status: 'schema_error'; message: string; rawOutput?: string } {
  return { status: 'schema_error', message, rawOutput: raw };
}

function okResponse<T>(data: T): { status: 'ok'; data: T } {
  return { status: 'ok', data };
}

// ── Public API ─────────────────────────────────────────────────────────────────────

/**
 * Intent extraction: user text → structured IntentDsl
 */
export async function runIntent(
  text: string,
  locale: 'zh-CN' | 'en-US' = 'zh-CN',
  config?: OrchestratorConfig
): Promise<IntentResponse> {
  const anthropic = getClient(config?.client);
  const model = config?.model ?? DEFAULT_MODEL;
  const maxTokens = config?.maxTokens ?? DEFAULT_MAX_TOKENS;

  try {
    const sysPrompt = buildIntentSystemPrompt(locale);
    const userPrompt = buildIntentUserPrompt(text, locale);

    const msg = await callModel(anthropic, model, maxTokens, sysPrompt, userPrompt, TOOL_INTENT_SCHEMA);

    const input = extractToolInput(msg);
    if (!input || typeof input !== 'object') {
      return schemaErrorResponse('AI returned no tool input', JSON.stringify(msg.content));
    }

    const data = input as Record<string, unknown>;

    // Validate intentDsl against schema
    if (!data.intentDsl) {
      return schemaErrorResponse('Missing intentDsl in AI response', JSON.stringify(data));
    }

    const dslResult = validateIntent(data.intentDsl);
    if (!dslResult.valid) {
      return schemaErrorResponse(
        `IntentDsl validation failed: ${JSON.stringify(dslResult.errors)}`,
        JSON.stringify(data.intentDsl)
      );
    }

    const ambiguities = Array.isArray(data.ambiguities) ? data.ambiguities : [];
    return okResponse({
      intentDsl: data.intentDsl as IntentDsl,
      ambiguities: ambiguities as Array<{ key: string; question: string; status: 'open' | 'resolved' }>,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes('refusal') || message.includes('safe')) {
      return refusalResponse(message);
    }
    return schemaErrorResponse(`AI call failed: ${message}`);
  }
}

/**
 * Draft proposal: confirmed intent → DraftDsl + resolved pipeline
 */
export async function runDraft(
  intentDsl: IntentDsl,
  confirmationDsl: ConfirmationDsl | null = null,
  config?: OrchestratorConfig
): Promise<DraftEndpointResponse> {
  const anthropic = getClient(config?.client);
  const model = config?.model ?? DEFAULT_MODEL;
  const maxTokens = config?.maxTokens ?? DEFAULT_MAX_TOKENS;

  try {
    const sysPrompt = buildDraftSystemPrompt();
    const intentJson = JSON.stringify({ intentDsl, confirmationDsl });
    const userPrompt = buildDraftUserPrompt(intentJson);

    const msg = await callModel(anthropic, model, maxTokens, sysPrompt, userPrompt, TOOL_DRAFT_SCHEMA);

    const input = extractToolInput(msg);
    if (!input || typeof input !== 'object') {
      return schemaErrorResponse('AI returned no tool input', JSON.stringify(msg.content));
    }

    const data = input as Record<string, unknown>;

    if (!data.draftDsl) {
      return schemaErrorResponse('Missing draftDsl in AI response', JSON.stringify(data));
    }

    const dslResult = validateDraft(data.draftDsl);
    if (!dslResult.valid) {
      return schemaErrorResponse(
        `DraftDsl validation failed: ${JSON.stringify(dslResult.errors)}`,
        JSON.stringify(data.draftDsl)
      );
    }

    const draftDsl = data.draftDsl as DraftDsl;
    const notes = Array.isArray(data.notes) ? (data.notes as string[]) : [];

    // Run rules pipeline to produce resolvedDsl + issues (NOT from AI)
    const { resolved, issues } = runPipeline(draftDsl, intentDsl);

    return okResponse({ draftDsl, resolvedDsl: resolved, issues, notes });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes('refusal') || message.includes('safe')) {
      return refusalResponse(message);
    }
    return schemaErrorResponse(`AI call failed: ${message}`);
  }
}

/**
 * Edit intent resolution: reference context + edit text → EditIntent
 */
export async function runEditIntent(
  referenceContext: ReferenceContext,
  editText: string,
  config?: OrchestratorConfig
): Promise<EditIntentResponse> {
  const anthropic = getClient(config?.client);
  const model = config?.model ?? DEFAULT_MODEL;
  const maxTokens = config?.maxTokens ?? DEFAULT_MAX_TOKENS;

  try {
    const sysPrompt = buildEditIntentSystemPrompt();
    const contextJson = JSON.stringify(referenceContext);
    const userPrompt = buildEditIntentUserPrompt(editText, contextJson);

    const msg = await callModel(anthropic, model, maxTokens, sysPrompt, userPrompt, TOOL_EDIT_INTENT_SCHEMA);

    const input = extractToolInput(msg);
    if (!input || typeof input !== 'object') {
      return schemaErrorResponse('AI returned no tool input', JSON.stringify(msg.content));
    }

    const data = input as Record<string, unknown>;

    if (!data.action || !data.targetMode) {
      return schemaErrorResponse('Missing required fields in edit intent', JSON.stringify(data));
    }

    return okResponse({
      action: String(data.action),
      targetMode: data.targetMode as 'selected' | 'semantic' | 'relative' | 'global',
      targetRef: (data.targetRef as Record<string, unknown>) ?? {},
      params: (data.params as Record<string, unknown>) ?? {},
      confidence: Number(data.confidence ?? 0),
      needsFollowUp: Boolean(data.needsFollowUp),
      followUpQuestion: data.followUpQuestion as string | undefined,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes('refusal') || message.includes('safe')) {
      return refusalResponse(message);
    }
    return schemaErrorResponse(`AI call failed: ${message}`);
  }
}

/**
 * Check issue explanation: issues → human-readable explanations
 */
export async function runCheckExplain(
  issues: CheckIssue[],
  locale: 'zh-CN' | 'en-US' = 'zh-CN',
  config?: OrchestratorConfig
): Promise<CheckExplainResponse> {
  const anthropic = getClient(config?.client);
  const model = config?.model ?? DEFAULT_MODEL;
  const maxTokens = config?.maxTokens ?? DEFAULT_MAX_TOKENS;

  try {
    const sysPrompt = buildCheckExplainSystemPrompt(locale);
    const userPrompt = buildCheckExplainUserPrompt(issues, locale);

    const msg = await callModel(anthropic, model, maxTokens, sysPrompt, userPrompt, TOOL_CHECK_EXPLAIN_SCHEMA);

    const input = extractToolInput(msg);
    if (!input || typeof input !== 'object') {
      return schemaErrorResponse('AI returned no tool input', JSON.stringify(msg.content));
    }

    const data = input as Record<string, unknown>;

    const explanations = Array.isArray(data.explanations) ? (data.explanations as Array<Record<string, unknown>>) : [];
    return okResponse({
      explanations: explanations.map((e) => ({
        issueId: e.issueId as string | undefined,
        nodeId: e.nodeId as string | undefined,
        jointId: e.jointId as string | undefined,
        severity: String(e.severity ?? 'warning'),
        what: String(e.what ?? ''),
        why: String(e.why ?? ''),
        howToResolve: e.howToResolve as string | undefined,
      })),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes('refusal') || message.includes('safe')) {
      return refusalResponse(message);
    }
    return schemaErrorResponse(`AI call failed: ${message}`);
  }
}

export { createErrorEnvelope };

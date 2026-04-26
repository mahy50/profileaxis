// @profileaxis/ai-contracts - prompts, tool schema, AI DTO, error envelope
// No app implementation dependencies

import type { IntentDsl, ConfirmationDsl, DraftDsl, EditIntent } from '@profileaxis/schemas';

export const PROMPT_VERSION = '1.0.0-m1';

// Error envelope for AI responses
export interface AIErrorEnvelope {
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
  requestId: string;
  timestamp: string;
}

export function createErrorEnvelope(code: string, message: string, requestId: string): AIErrorEnvelope {
  return {
    error: { code, message },
    requestId,
    timestamp: new Date().toISOString(),
  };
}

// AI I/O schemas (tool definitions for AI)
export const TOOL_INTENT_SCHEMA = {
  name: 'intent',
  description: 'Parse user requirements into structured IntentDsl',
  inputSchema: {
    type: 'object',
    properties: {
      text: { type: 'string', description: 'User requirement text' },
      locale: { type: 'string', enum: ['zh-CN', 'en-US'], default: 'zh-CN' },
    },
    required: ['text'],
  },
};

export const TOOL_DRAFT_SCHEMA = {
  name: 'draft',
  description: 'Propose structural draft from confirmed intent',
  inputSchema: {
    type: 'object',
    properties: {
      intentDsl: { type: 'object' },
      confirmationDsl: { type: 'object', nullable: true },
    },
    required: ['intentDsl'],
  },
};

export const TOOL_EDIT_INTENT_SCHEMA = {
  name: 'edit-intent',
  description: 'Resolve edit intent from user reference context',
  inputSchema: {
    type: 'object',
    properties: {
      referenceContext: { type: 'object' },
      editText: { type: 'string' },
    },
    required: ['referenceContext', 'editText'],
  },
};

export const TOOL_CHECK_EXPLAIN_SCHEMA = {
  name: 'check-explain',
  description: 'Explain check issues to user',
  inputSchema: {
    type: 'object',
    properties: {
      issueIds: { type: 'array', items: { type: 'string' } },
      locale: { type: 'string', enum: ['zh-CN', 'en-US'], default: 'zh-CN' },
    },
    required: ['issueIds'],
  },
};

// Prompt templates
export function buildIntentSystemPrompt(locale: 'zh-CN' | 'en-US' = 'zh-CN'): string {
  if (locale === 'zh-CN') {
    return `你是一个仓储货架配置助手。用户会描述他们的需求，你需要从中提取结构化信息。

输出要求：
- 只输出符合 IntentDsl schema 的 JSON
- 不要输出 resolvedDsl、BOM、检测结论
- 如有歧义，在 ambiguities 字段标注

禁止：
- 直接计算长度、数量
- 输出连接件兼容性判断
- 输出装配约束求解结果`;
  }
  return `You are a storage rack configuration assistant. Extract structured intent from user requirements.

Output requirements:
- Only output JSON matching IntentDsl schema
- Do not output resolvedDsl, BOM, or check conclusions
- Flag ambiguities in the ambiguities field`;
}

export function buildDraftSystemPrompt(): string {
  return `Given a confirmed IntentDsl, propose a DraftDsl with structural topology.

This draft is NOT the final resolved design - it is a structural proposal that will be validated by rules.`;
}

export function buildEditIntentSystemPrompt(): string {
  return `Given a user's edit request and the current reference context (selection, camera, structure tree),
resolve what semantic edit action they want to perform.

Output an EditIntent with:
- action: one of the M1 frozen actions
- targetMode: selected|semantic|relative|global
- targetRef: the entity being edited
- params: action parameters
- confidence: 0-1
- needsFollowUp: whether clarification is needed`;
}

export function buildCheckExplainSystemPrompt(): string {
  return `Given check issue IDs, provide user-friendly explanations in their locale.

Explain:
- What the issue is
- Why it matters
- How to resolve it (if applicable)

Keep explanations concise and actionable.`;
}

// AI response status helpers
export type AIResponseStatus = 'ok' | 'refusal' | 'schema_error';

export function isOK<T>(resp: { status: string; data?: T }): resp is { status: 'ok'; data: T } {
  return resp.status === 'ok';
}

export function isRefusal<T>(resp: { status: string }): resp is { status: 'refusal'; reason: string } {
  return resp.status === 'refusal';
}

export function isSchemaError<T>(resp: { status: string }): resp is { status: 'schema_error'; message: string } {
  return resp.status === 'schema_error';
}

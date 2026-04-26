// @profileaxis/ai-contracts/tools — AI tool function schemas (M1 frozen)
// JSON Schema definitions for AI tool calling.
// Uses readFileSync for Node.js ESM compatibility.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function loadJson(path: string): Record<string, unknown> {
  return JSON.parse(readFileSync(resolve(__dirname, path), 'utf-8')) as Record<string, unknown>;
}

const intentSchema = loadJson('./intent.schema.json');
const draftSchema = loadJson('./draft.schema.json');
const editIntentSchema = loadJson('./edit-intent.schema.json');
const checkExplainSchema = loadJson('./check-explain.schema.json');

export interface ToolSchema {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

export const TOOL_INTENT_SCHEMA: ToolSchema = {
  name: 'intent',
  description: 'Parse user requirements into structured IntentDsl',
  inputSchema: intentSchema,
};

export const TOOL_DRAFT_SCHEMA: ToolSchema = {
  name: 'draft',
  description: 'Propose structural draft from confirmed intent',
  inputSchema: draftSchema,
};

export const TOOL_EDIT_INTENT_SCHEMA: ToolSchema = {
  name: 'edit-intent',
  description: 'Resolve edit intent from user reference context',
  inputSchema: editIntentSchema,
};

export const TOOL_CHECK_EXPLAIN_SCHEMA: ToolSchema = {
  name: 'check-explain',
  description: 'Explain check issues to user',
  inputSchema: checkExplainSchema,
};

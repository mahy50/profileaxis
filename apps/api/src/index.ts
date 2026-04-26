// @profileaxis/api - AI Orchestrator, catalog service, PDF export, version service
// Must NOT be imported by any package

import type { IntentDsl, ConfirmationDsl, DraftDsl, EditIntent } from '@profileaxis/schemas';
import { STDLIB_VERSION } from '@profileaxis/stdlib';
import { RULE_VERSION } from '@profileaxis/rules';
import { PROMPT_VERSION } from '@profileaxis/ai-contracts';

// Version endpoint
export function getVersions() {
  return {
    stdlibVersion: STDLIB_VERSION,
    ruleVersion: RULE_VERSION,
    promptVersion: PROMPT_VERSION,
    currentCatalogVersion: STDLIB_VERSION,
  };
}

// Placeholder AI endpoints (full implementation in P0-011)
export async function intent(text: string, locale: 'zh-CN' | 'en-US' = 'zh-CN'): Promise<{ intentDsl: IntentDsl; needsConfirmationKeys: string[] }> {
  throw new Error('Not yet implemented - P0-011');
}

export async function draft(intentDsl: IntentDsl, confirmationDsl: ConfirmationDsl | null): Promise<{ draftDsl: DraftDsl }> {
  throw new Error('Not yet implemented - P0-011');
}

export async function editIntent(referenceContext: unknown, editText: string): Promise<{ editIntent: EditIntent }> {
  throw new Error('Not yet implemented - P0-011');
}

export async function checkExplain(issueIds: string[], locale: 'zh-CN' | 'en-US' = 'zh-CN'): Promise<{ explanations: Array<{ issueId: string; explanation: string }> }> {
  throw new Error('Not yet implemented - P0-011');
}

// Catalog endpoint (placeholder)
export async function getCatalog(version: string) {
  return {
    version,
    message: 'Catalog endpoint not yet implemented - P0-011',
  };
}

// PDF export endpoint (placeholder - actual PDF rendering here)
export async function exportPdf(projectDocument: unknown) {
  return {
    message: 'PDF export not yet implemented - P0-011',
    payload: null,
  };
}

// API server bootstrap (placeholder - actual server in P0-011)
export function createApiServer() {
  return {
    port: 3000,
    endpoints: ['/v1/runtime/versions', '/v1/ai/intent', '/v1/ai/draft', '/v1/ai/edit-intent', '/v1/export/pdf'],
  };
}

console.log('ProfileAxis API server bootstrap - full implementation in P0-011');
console.log('Available endpoints:', createApiServer().endpoints.join(', '));

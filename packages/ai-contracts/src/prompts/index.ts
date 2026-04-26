// @profileaxis/ai-contracts/prompts — System & user prompts for AI endpoints
// M1 frozen prompt templates.
// Architecture: pure text generation, no API calls, no app-layer dependencies.

export { buildIntentSystemPrompt, buildIntentUserPrompt } from './intent.js';
export { buildDraftSystemPrompt, buildDraftUserPrompt } from './draft.js';
export { buildEditIntentSystemPrompt, buildEditIntentUserPrompt } from './edit-intent.js';
export { buildCheckExplainSystemPrompt, buildCheckExplainUserPrompt } from './check-explain.js';

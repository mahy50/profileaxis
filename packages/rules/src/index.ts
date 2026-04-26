// @profileaxis/rules — main entry point
// Normalize draftDsl → resolve resolvedDsl → run checks

import type { DraftDsl, IntentDsl, ResolvedDsl, CheckIssue } from '@profileaxis/domain';
import { normalizeDraftDsl } from './normalize/index.js';
import { resolve } from './resolve/index.js';
import { check } from './checks/index.js';
import type { NormalizedIntent, NormalizeResult } from './types.js';

export const RULE_VERSION = '1.0.0-m1';

export { normalizeDraftDsl, resolve, check };
export type { NormalizedIntent, NormalizeResult };

/**
 * Full pipeline: draftDsl → normalized → resolvedDsl → checkIssues
 */
export function runPipeline(
  draft: DraftDsl,
  intent: IntentDsl
): {
  normalized: NormalizedIntent;
  resolved: ResolvedDsl;
  issues: CheckIssue[];
} {
  const normalizeResult = normalizeDraftDsl(draft, intent);

  if (normalizeResult.issues.some(i => i.severity === 'blocker')) {
    return {
      normalized: normalizeResult.intent,
      resolved: {
        dslVersion: '1.0.0',
        projectType: 'storage_rack',
        sourceRevisionId: 'blocked',
        overallSizeMm: { width: 0, depth: 0, height: 0 },
        modules: [],
        nodes: [],
        joints: [],
      },
      issues: normalizeResult.issues,
    };
  }

  const resolved = resolve(normalizeResult.intent);
  const checkIssues = check(resolved);

  return {
    normalized: normalizeResult.intent,
    resolved,
    issues: [...normalizeResult.issues, ...checkIssues],
  };
}
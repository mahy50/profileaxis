// CheckIssue — a rule-validation finding in the project (M1 frozen)

import type { NodeId } from '../structural/index.js';

export type IssueSeverity = 'blocker' | 'warning' | 'info';

export interface CheckIssue {
  issueId: string;
  severity: IssueSeverity;
  ruleId: string;
  message: string;
  nodeIds: NodeId[];
  semanticPaths: string[];
  fixSuggestion: string | null;
}

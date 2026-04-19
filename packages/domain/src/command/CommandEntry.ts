// CommandEntry — a single reversible command in the project history (M1 frozen)

import type { EntityRef } from './EntityRef.js';

export type RevisionId = string;

export type CommandSource = 'user-ui' | 'user-chat' | 'ai' | 'rule-autofix' | 'system';

export interface CommandEntry {
  commandId: string;
  type: string;                          // semantic command type, e.g. resizeBay, insertLevel
  source: CommandSource;
  targetRefs: EntityRef[];
  payload: Record<string, unknown>;       // forward parameters
  inversePayload: Record<string, unknown>; // reverse parameters for undo
  beforeRevisionId: RevisionId;
  afterRevisionId: RevisionId;
}

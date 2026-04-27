// CommandEntry — a single reversible command in the project history (M1 frozen)

import type { EntityRef } from './EntityRef.js';

export type RevisionId = string;

export type CommandSource = 'user-ui' | 'user-chat' | 'ai' | 'rule-autofix' | 'system';

/**
 * Known semantic command types.
 * The domain only defines the shape; concrete commands are registered
 * by the command bus.  This union is documentation, not a closed set —
 * cast through `string` when registering custom handlers.
 */
export type CommandType =
  | 'resizeOverall'
  | 'resizeBay'
  | 'insertBay'
  | 'removeBay'
  | 'insertLevel'
  | 'removeLevel'
  | 'moveLevel'
  | 'toggleBrace'
  | 'replaceProfileSeries'
  | 'addBeam'
  | 'removeBeam'
  | 'restoreSnapshot';

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

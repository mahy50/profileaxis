// ProjectDocument — the single source of truth for a profileaxis project (M1 frozen)
// All scenes, BOMs, checks, and exports are derived from this document.

import type { StructuralNode } from '../structural/index.js';
import type { JointNode } from '../joint/index.js';
import type { CommandEntry } from '../command/index.js';
import type { DesignBomItem, TradeBomItem } from '../bom/index.js';
import type { CheckIssue } from '../checks/index.js';

// RevisionId is a string alias used across the domain
/** Stable revision identifier */
export type RevisionId = string;

export type SnapshotId = string;
export type Locale = 'zh-CN' | 'en-US';
export type UnitSystem = 'mm';

/**
 * IntentDsl — extracted user intent (archived, not source of truth)
 */
export interface IntentDsl {
  dslVersion: '1.0.0';
  projectType: 'storage_rack';
  space: {
    widthMm: number;
    depthMm: number;
    heightMm: number;
    placement: 'floor';
  };
  capacity: {
    shelfCount: number;
    loadTier: 'light' | 'medium' | 'heavy';
  };
  preferences: {
    profileSeries: string | null;
    rearBrace: boolean | null;
    caster: boolean;
  };
  constraints: {
    againstWall: boolean;
    maxWidthMm: number | null;
  };
  ambiguities: Array<{ key: string; question: string; status: 'open' | 'resolved' }>;
}

/**
 * ConfirmationDsl — pending and confirmed decisions (archived)
 */
export interface ConfirmationDsl {
  decisions: Array<{
    key: string;
    question: string;
    resolution: string;
    confirmedAt: string;
  }>;
}

/**
 * DraftDsl — AI-proposed structural draft (archived, not source of truth)
 */
export interface DraftDsl {
  dslVersion: '1.0.0';
  modules: Array<{
    moduleId: string;
    kind: 'rect-bay';
    intent: Record<string, unknown>;
  }>;
}

/**
 * ResolvedDsl — the authoritative structural definition (THE source of truth)
 */
export interface ResolvedDsl {
  dslVersion: '1.0.0';
  projectType: 'storage_rack';
  sourceRevisionId: string;
  overallSizeMm: { width: number; depth: number; height: number };
  modules: Array<{ moduleId: string; kind: 'rect-bay'; spanMm: number }>;
  nodes: StructuralNode[];
  joints: JointNode[];
}

export interface SnapshotMeta {
  snapshotId: SnapshotId;
  revisionId: string;
  createdAt: string;
  label: string;
}

/**
 * ProjectDocument — the root entity for all profileaxis projects.
 * schemaVersion and version fields (stdlibVersion, ruleVersion, catalogVersion)
 * MUST be set so historical projects can be faithfully reproduced.
 */
export interface ProjectDocument {
  schemaVersion: '1.0.0';
  projectId: string;
  name: string;
  locale: Locale;
  unitSystem: UnitSystem;
  stdlibVersion: string;
  ruleVersion: string;
  catalogVersion: string;

  // The ONE source of truth
  resolvedDsl: ResolvedDsl;

  // Derived caches (may be recomputed from resolvedDsl)
  structuralNodes: StructuralNode[];
  jointNodes: JointNode[];
  designBom: DesignBomItem[];
  tradeBom: TradeBomItem[];
  checkIssues: CheckIssue[];

  currentRevisionId: string;
  commandCursor: number;
  snapshotIds: SnapshotId[];

  // Archived DSLs (never modified after creation)
  intentDsl: IntentDsl | null;
  confirmationDsl: ConfirmationDsl | null;
  draftDsl: DraftDsl | null;

  uiState: Record<string, unknown>; // P1 field
}

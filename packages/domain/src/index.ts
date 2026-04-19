// @profileaxis/domain — Core domain types (M1 frozen)
// NO app-layer dependencies allowed.

export const SCHEMA_VERSION = '1.0.0' as const;

// ── Shared scalar aliases ──────────────────────────────────────────────────
export type NodeId = string;
export type JointId = string;
export type RevisionId = string;
export type SnapshotId = string;
export type Locale = 'zh-CN' | 'en-US';
export type UnitSystem = 'mm';

// ── Structural ─────────────────────────────────────────────────────────────
export type { Axis, NodeRole, NodeKind, ProvenanceSource } from './structural/index.js';
export type { Vec3 } from './structural/Vec3.js';
export type { StructuralNode } from './structural/StructuralNode.js';

// ── Joint ──────────────────────────────────────────────────────────────────
export type { JointTopology } from './joint/index.js';
export type { JointNode } from './joint/JointNode.js';

// ── Command ─────────────────────────────────────────────────────────────────
export type { CommandSource } from './command/index.js';
export type { EntityRef } from './command/EntityRef.js';
export type { CommandEntry } from './command/CommandEntry.js';

// ── BOM ─────────────────────────────────────────────────────────────────────
export type { MappingStatus } from './bom/index.js';
export type { DesignBomItem } from './bom/DesignBomItem.js';
export type { TradeBomItem } from './bom/TradeBomItem.js';

// ── Checks ──────────────────────────────────────────────────────────────────
export type { IssueSeverity } from './checks/index.js';
export type { CheckIssue } from './checks/CheckIssue.js';

// ── Project ─────────────────────────────────────────────────────────────────
export type {
  ProjectDocument,
  IntentDsl,
  ConfirmationDsl,
  DraftDsl,
  ResolvedDsl,
  SnapshotMeta,
} from './project/index.js';

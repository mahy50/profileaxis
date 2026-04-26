// @profileaxis/rules - Internal types for the rules engine

import type { IntentDsl, DraftDsl, ResolvedDsl, CheckIssue } from '@profileaxis/domain';

// ── Normalization types ─────────────────────────────────────────────────────

export interface NormalizedIntent {
  widthMm: number;
  depthMm: number;
  heightMm: number;
  shelfCount: number;
  loadTier: 'light' | 'medium' | 'heavy';
  profileSeries: string | null;
  rearBrace: boolean;
  caster: boolean;
  againstWall: boolean;
  maxWidthMm: number | null;
}

export interface NormalizeResult {
  intent: NormalizedIntent;
  issues: CheckIssue[];
  warnings: string[];
}

// ── Resolution types ────────────────────────────────────────────────────────

export interface ResolvedModule {
  moduleId: string;
  kind: 'rect-bay';
  spanMm: number;
  levelCount: number;
  levels: ResolvedLevel[];
}

export interface ResolvedLevel {
  levelIndex: number;
  heightMm: number;
  beamSpanMm: number;
}

export interface ResolveResult {
  modules: ResolvedModule[];
  nodes: import('@profileaxis/domain').StructuralNode[];
  joints: import('@profileaxis/domain').JointNode[];
}
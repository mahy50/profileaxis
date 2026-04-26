// normalize/index.ts — Normalize draftDsl to structured intent
// No AI, no LLM — pure deterministic transformation

import type { DraftDsl, IntentDsl, CheckIssue } from '@profileaxis/domain';
import { PROFILES, CONNECTORS } from '@profileaxis/stdlib';
import type { NormalizedIntent, NormalizeResult } from '../types.js';

// Known profile series mapping from stdlib
const PROFILE_SERIES: Record<string, string> = {
  'U50': 'PC-AI50-50-3',  // angle iron 50x50
  'U60': 'PB-SB60-40-2.0', // beam 60x40
  'U90': 'PA-UC90-70-2.5', // upright 90x70
};

const DEFAULT_LOAD_TIER: 'light' | 'medium' | 'heavy' = 'medium';
const MIN_WIDTH_MM = 500;
const MAX_WIDTH_MM = 12000;
const MIN_HEIGHT_MM = 500;
const MAX_HEIGHT_MM = 10000;
const MIN_SHELF_COUNT = 1;
const MAX_SHELF_COUNT = 20;

/**
 * Resolve profile spec key from series name or fallback to default
 */
function resolveProfileSpecKey(profileSeries: string | null): string {
  if (profileSeries && PROFILE_SERIES[profileSeries]) {
    return PROFILE_SERIES[profileSeries];
  }
  // Default to first available profile
  return PROFILES[0]?.profileKey ?? 'PA-UC90-70-2.5';
}

/**
 * Resolve connector spec key from topology
 */
function resolveConnectorSpecKey(topology: string): string {
  const found = CONNECTORS.find(c => c.topology === topology);
  return found?.connectorKey ?? 'JC3-CORNER';
}

/**
 * Normalize a DraftDsl + IntentDsl into a deterministic NormalizedIntent
 */
export function normalizeDraftDsl(draft: DraftDsl, intent: IntentDsl): NormalizeResult {
  const issues: CheckIssue[] = [];
  const warnings: string[] = [];

  // Extract space dimensions
  const widthMm = intent.space?.widthMm ?? 0;
  const depthMm = intent.space?.depthMm ?? 0;
  const heightMm = intent.space?.heightMm ?? 0;

  // Validate required dimensions
  if (widthMm <= 0) {
    issues.push({
      issueId: 'NORM_ERR_NO_WIDTH',
      severity: 'blocker',
      ruleId: 'normalize',
      message: 'space.widthMm must be positive',
      nodeIds: [],
      semanticPaths: [],
      fixSuggestion: 'Provide a positive widthMm value',
    });
  }
  if (heightMm <= 0) {
    issues.push({
      issueId: 'NORM_ERR_NO_HEIGHT',
      severity: 'blocker',
      ruleId: 'normalize',
      message: 'space.heightMm must be positive',
      nodeIds: [],
      semanticPaths: [],
      fixSuggestion: 'Provide a positive heightMm value',
    });
  }

  // Clamp width within structural limits
  const clampedWidth = Math.max(MIN_WIDTH_MM, Math.min(MAX_WIDTH_MM, widthMm));
  if (widthMm !== clampedWidth) {
    warnings.push(`Width clamped from ${widthMm}mm to ${clampedWidth}mm`);
  }

  // Extract capacity
  const shelfCount = intent.capacity?.shelfCount ?? 3;
  const loadTier = intent.capacity?.loadTier ?? DEFAULT_LOAD_TIER;

  // Validate shelf count
  if (shelfCount < MIN_SHELF_COUNT) {
    issues.push({
      issueId: 'NORM_ERR_SHELF_COUNT_LOW',
      severity: 'blocker',
      ruleId: 'normalize',
      message: `shelfCount must be at least ${MIN_SHELF_COUNT}`,
      nodeIds: [],
      semanticPaths: [],
      fixSuggestion: `Set shelfCount >= ${MIN_SHELF_COUNT}`,
    });
  }
  if (shelfCount > MAX_SHELF_COUNT) {
    issues.push({
      issueId: 'NORM_ERR_SHELF_COUNT_HIGH',
      severity: 'warning',
      ruleId: 'normalize',
      message: `shelfCount capped at ${MAX_SHELF_COUNT}`,
      nodeIds: [],
      semanticPaths: [],
      fixSuggestion: `Reduce shelfCount to <= ${MAX_SHELF_COUNT}`,
    });
  }

  // Extract preferences
  const profileSeries = intent.preferences?.profileSeries ?? null;
  const rearBrace = intent.preferences?.rearBrace ?? false;
  const caster = intent.preferences?.caster ?? false;

  // Extract constraints
  const againstWall = intent.constraints?.againstWall ?? false;
  const maxWidthMm = intent.constraints?.maxWidthMm ?? null;

  // Resolve profile spec
  const profileSpecKey = resolveProfileSpecKey(profileSeries);

  const normalized: NormalizedIntent = {
    widthMm: clampedWidth,
    depthMm: depthMm > 0 ? depthMm : 900, // default 900mm depth
    heightMm: Math.max(MIN_HEIGHT_MM, Math.min(MAX_HEIGHT_MM, heightMm)),
    shelfCount: Math.min(shelfCount, MAX_SHELF_COUNT),
    loadTier,
    profileSeries,
    rearBrace,
    caster,
    againstWall,
    maxWidthMm,
  };

  return { intent: normalized, issues, warnings };
}

/**
 * Compute level height distribution given total height and shelf count
 */
export function computeLevelHeights(totalHeightMm: number, shelfCount: number): number[] {
  if (shelfCount <= 0) return [];
  // Evenly distribute levels, last level is typically base + storage
  const baseHeightMm = 100; // base foot clearance
  const availableHeight = totalHeightMm - baseHeightMm;
  const levelHeights: number[] = [];
  for (let i = 0; i < shelfCount; i++) {
    const portion = i === shelfCount - 1 ? 0.6 : 1.0 / shelfCount;
    levelHeights.push(Math.round(availableHeight * portion));
  }
  return levelHeights;
}
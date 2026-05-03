import type {
  ResolvedDsl,
  StructuralNode,
  JointNode,
  EntityRef,
} from '@profileaxis/domain';
import type {
  ReferenceContext,
  EditIntent,
  EditAction,
  Vec3,
} from '@profileaxis/schemas';
import type { EditIntentResponse } from '@profileaxis/ai-contracts';
import { useProjectStore } from '@/stores/projectStore';
import { useSelectionStore } from '@/stores/selectionStore';
import { api } from '@/services/api';

// ── Types ──────────────────────────────────────────────────────────────────────

export interface InterpretResult {
  /** The resolved edit intent */
  intent: EditIntent;
  /** Mapped command type (matches handler name in commandBus) */
  commandType: string;
  /** Payload for commandBus.execute() */
  commandPayload: Record<string, unknown>;
  /** Source of the interpretation */
  source: 'local' | 'api';
  /** Whether the intent needs user follow-up before execution */
  needsFollowUp: boolean;
  /** Follow-up question if needsFollowUp is true */
  followUpQuestion?: string;
  /** Entity refs targeted by this command */
  targetRefs: EntityRef[];
}

interface CommandMapping {
  type: string;
  payload: Record<string, unknown>;
  targetRefs: EntityRef[];
}

// ── ReferenceContext builder ────────────────────────────────────────────────────

/**
 * Build a ReferenceContext from current store state.
 * Captures the full editor context for AI or local interpretation.
 */
export function buildReferenceContext(): ReferenceContext {
  const projectStore = useProjectStore();
  const selectionStore = useSelectionStore();
  const dsl = projectStore.resolvedDsl;

  const activeSelection: ReferenceContext['activeSelection'] =
    selectionStore.selectedIds.map((id) => {
      const node = dsl.nodes.find((n) => n.nodeId === id);
      const joint = dsl.joints.find((j) => j.jointId === id);

      if (node) {
        const nodeCenter: Vec3 = {
          x: (node.start.x + node.end.x) / 2,
          y: (node.start.y + node.end.y) / 2,
          z: (node.start.z + node.end.z) / 2,
        };
        const bayMatch = node.semanticPath.match(/bay[-_](\d+)/);
        const levelMatch = node.semanticPath.match(/\/(\d+)$/);
        return {
          entityType: 'structural' as const,
          id: node.nodeId,
          semanticPath: node.semanticPath,
          role: node.role,
          axis: node.axis,
          center: nodeCenter,
          bbox: {
            min: { x: Math.min(node.start.x, node.end.x), y: Math.min(node.start.y, node.end.y), z: Math.min(node.start.z, node.end.z) },
            max: { x: Math.max(node.start.x, node.end.x), y: Math.max(node.start.y, node.end.y), z: Math.max(node.start.z, node.end.z) },
          },
          bayIndex: bayMatch ? parseInt(bayMatch[1], 10) : null,
          levelIndex: levelMatch ? parseInt(levelMatch[1], 10) : null,
        };
      }
      if (joint) {
        const jointCenter: Vec3 = { ...joint.position };
        return {
          entityType: 'joint' as const,
          id: joint.jointId,
          semanticPath: joint.semanticPath,
          center: jointCenter,
          bbox: {
            min: { x: joint.position.x - 10, y: joint.position.y - 10, z: joint.position.z - 10 },
            max: { x: joint.position.x + 10, y: joint.position.y + 10, z: joint.position.z + 10 },
          },
        };
      }
      // Fallback for module IDs
      return {
        entityType: 'module' as const,
        id,
        semanticPath: id,
        center: { x: 0, y: 0, z: 0 },
        bbox: { min: { x: 0, y: 0, z: 0 }, max: { x: 0, y: 0, z: 0 } },
      };
    });

  const hoveredId = selectionStore.hoveredId;
  let hoverTarget: ReferenceContext['hoverTarget'] = null;
  if (hoveredId) {
    const hNode = dsl.nodes.find((n) => n.nodeId === hoveredId);
    const hJoint = dsl.joints.find((j) => j.jointId === hoveredId);
    if (hNode) {
      hoverTarget = { entityType: 'structural', id: hNode.nodeId, semanticPath: hNode.semanticPath };
    } else if (hJoint) {
      hoverTarget = { entityType: 'joint', id: hJoint.jointId, semanticPath: hJoint.semanticPath };
    }
  }

  const allowedActions: EditAction[] = [
    'resizeOverall',
    'resizeBay',
    'insertLevel',
    'removeLevel',
    'moveLevel',
    'toggleBrace',
    'replaceProfileSeries',
    'addBeam',
    'removeBeam',
    'insertBay',
    'removeBay',
    'restoreSnapshot',
  ];

  return {
    activeSelection,
    hoverTarget,
    cameraContext: {
      viewPreset: 'iso',
      forward: { x: 0, y: 0, z: -1 },
      up: { x: 0, y: 1, z: 0 },
      right: { x: 1, y: 0, z: 0 },
    },
    structureContext: {
      focusedModuleId: null,
      expandedSemanticPaths: [],
    },
    recentReferences: [],
    allowedActions,
  };
}

// ── Local pattern parser ───────────────────────────────────────────────────────

/**
 * A local edit pattern matches user text and produces an EditIntent.
 * Returns null if the pattern doesn't match.
 */
type LocalPattern = (
  text: string,
  context: ReferenceContext,
  dsl: ResolvedDsl,
) => EditIntent | null;

/**
 * Extract a number from text. Supports both Arabic and Chinese numerals.
 */
function extractNumber(text: string, pattern: RegExp): number | null {
  const m = text.match(pattern);
  if (!m) return null;
  const n = parseInt(m[1], 10);
  return isNaN(n) ? null : n;
}

/**
 * Map 1-based bay index to moduleId.
 */
function bayIndexToModuleId(dsl: ResolvedDsl, bayIndex: number): string | null {
  if (bayIndex < 1 || bayIndex > dsl.modules.length) return null;
  return dsl.modules[bayIndex - 1]?.moduleId ?? null;
}

/**
 * Count levels from front beams in the DSL.
 */
function countLevels(dsl: ResolvedDsl): number {
  const frontBeams = dsl.nodes.filter((n) => n.semanticPath.startsWith('beam/front/'));
  return Math.max(1, frontBeams.length);
}

// ── Pattern: resizeOverall ─────────────────────────────────────────────────────
// "宽度改为2000" | "width=2000" | "高度设为2500" | "depth 800"
const resizeOverallPattern: LocalPattern = (text, _ctx, _dsl) => {
  const w1 = extractNumber(text, /宽(?:度)?[改设为]*\s*(\d+)/);
  const w2 = extractNumber(text, /width\s*[=:]\s*(\d+)/i);
  const width = w1 ?? w2;

  const h1 = extractNumber(text, /高(?:度)?[改设为]*\s*(\d+)/);
  const h2 = extractNumber(text, /height\s*[=:]\s*(\d+)/i);
  const height = h1 ?? h2;

  const d1 = extractNumber(text, /深(?:度)?[改设为]*\s*(\d+)/);
  const d2 = extractNumber(text, /depth\s*[=:]\s*(\d+)/i);
  const depth = d1 ?? d2;

  if (width != null || height != null || depth != null) {
    const params: Record<string, unknown> = {};
    if (width != null) params.width = width;
    if (height != null) params.height = height;
    if (depth != null) params.depth = depth;
    return {
      action: 'resizeOverall',
      targetMode: 'global',
      targetRef: null,
      params,
      confidence: 0.95,
      needsFollowUp: false,
    };
  }

  // "整体尺寸 宽1200 深600 高2000"
  const overall = text.match(/整体尺寸?.*?宽\s*(\d+).*?深\s*(\d+).*?高\s*(\d+)/);
  if (overall) {
    return {
      action: 'resizeOverall',
      targetMode: 'global',
      targetRef: null,
      params: { width: parseInt(overall[1]), depth: parseInt(overall[2]), height: parseInt(overall[3]) },
      confidence: 0.95,
      needsFollowUp: false,
    };
  }

  return null;
};

// ── Pattern: resizeBay ─────────────────────────────────────────────────────────
// "隔间1宽度改为1000" | "第2个隔间宽度1200" | "bay 1 width 1000"
const resizeBayPattern: LocalPattern = (text, context, dsl) => {
  // Extract bay index (1-based)
  let bayIdx: number | null = null;
  let spanMm: number | null = null;

  const chBayIdx = text.match(/第?\s*(\d+)\s*(?:个)?\s*隔间/);
  const enBayIdx = text.match(/bay[-_\s]*(\d+)/i);
  if (chBayIdx) bayIdx = parseInt(chBayIdx[1], 10);
  else if (enBayIdx) bayIdx = parseInt(enBayIdx[1], 10);

  spanMm = extractNumber(text, /(?:宽度?|span)[改设为]*\s*(\d+)/) ??
    extractNumber(text, /width\s*[=:]\s*(\d+)/i) ??
    extractNumber(text, /(\d+)\s*mm/);

  // If no bay index specified, use the first selected bay
  if (bayIdx == null && spanMm != null) {
    const selBay = context.activeSelection.find(
      (s) => s.entityType === 'structural' && s.bayIndex != null,
    );
    if (selBay?.bayIndex != null) bayIdx = selBay.bayIndex;
  }

  if (bayIdx != null && spanMm != null) {
    const moduleId = bayIndexToModuleId(dsl, bayIdx);
    if (moduleId) {
      return {
        action: 'resizeBay',
        targetMode: 'semantic',
        targetRef: moduleId,
        params: { moduleId, spanMm },
        confidence: 0.9,
        needsFollowUp: false,
      };
    }
  }

  return null;
};

// ── Pattern: insertLevel ────────────────────────────────────────────────────────
// "增加一层" | "添加一层" | "加一层" | "add level" | "增加2层"
const insertLevelPattern: LocalPattern = (text, _ctx, dsl) => {
  if (/增加\s*(\d+)\s*层/.test(text)) {
    const extra = extractNumber(text, /增加\s*(\d+)\s*层/)!;
    const current = countLevels(dsl);
    return {
      action: 'insertLevel',
      targetMode: 'global',
      targetRef: null,
      params: { shelfCount: Math.min(current + extra, 20) },
      confidence: 0.92,
      needsFollowUp: false,
    };
  }

  if (/增加.*层|添加.*层|加.*层|新增.*层/.test(text) ||
    /add\s+(a\s+)?(level|shelf)/i.test(text)) {
    return {
      action: 'insertLevel',
      targetMode: 'global',
      targetRef: null,
      params: {},
      confidence: 0.92,
      needsFollowUp: false,
    };
  }

  return null;
};

// ── Pattern: removeLevel ────────────────────────────────────────────────────────
// "删除一层" | "减少一层" | "去掉一层" | "remove level" | "删除第2层"
const removeLevelPattern: LocalPattern = (text, _ctx, dsl) => {
  if (/删除.*层|减少.*层|去掉.*层|移除.*层/.test(text) ||
    /remove\s+(a\s+)?(level|shelf)/i.test(text) ||
    /delete\s+(a\s+)?(level|shelf)/i.test(text)) {
    const current = countLevels(dsl);
    const specificLevel = extractNumber(text, /第?\s*(\d+)\s*层/);
    if (specificLevel != null && specificLevel <= current) {
      return {
        action: 'removeLevel',
        targetMode: 'global',
        targetRef: null,
        params: { shelfCount: current - 1 },
        confidence: 0.85,
        needsFollowUp: false,
      };
    }
    return {
      action: 'removeLevel',
      targetMode: 'global',
      targetRef: null,
      params: {},
      confidence: 0.92,
      needsFollowUp: false,
    };
  }

  return null;
};

// ── Pattern: moveLevel ──────────────────────────────────────────────────────────
// "第1层上移50" | "level 1 up 50" | "移动第2层+100"
const moveLevelPattern: LocalPattern = (text, _ctx, _dsl) => {
  let levelIndex: number | null = null;
  let deltaZ: number | null = null;

  // "第1层上移50"
  const chUp = text.match(/第?\s*(\d+)\s*层\s*上移\s*(\d+)/);
  if (chUp) {
    levelIndex = parseInt(chUp[1], 10);
    deltaZ = parseInt(chUp[2], 10);
  }

  // "第2层下移30"
  const chDown = text.match(/第?\s*(\d+)\s*层\s*下移\s*(\d+)/);
  if (chDown && levelIndex == null) {
    levelIndex = parseInt(chDown[1], 10);
    deltaZ = -parseInt(chDown[2], 10);
  }

  // "移动第1层 +100"
  const chMove = text.match(/移动\s*第?\s*(\d+)\s*层?\s*\+\s*(\d+)/);
  if (chMove && levelIndex == null) {
    levelIndex = parseInt(chMove[1], 10);
    deltaZ = parseInt(chMove[2], 10);
  }

  // "移动第2层 -50"
  const chMoveNeg = text.match(/移动\s*第?\s*(\d+)\s*层?\s*-\s*(\d+)/);
  if (chMoveNeg && levelIndex == null) {
    levelIndex = parseInt(chMoveNeg[1], 10);
    deltaZ = -parseInt(chMoveNeg[2], 10);
  }

  // "level 1 up 50"
  const enUp = text.match(/level\s*(\d+)\s*up\s*(\d+)/i);
  if (enUp && levelIndex == null) {
    levelIndex = parseInt(enUp[1], 10);
    deltaZ = parseInt(enUp[2], 10);
  }

  // "level 1 down 50"
  const enDown = text.match(/level\s*(\d+)\s*down\s*(\d+)/i);
  if (enDown && levelIndex == null) {
    levelIndex = parseInt(enDown[1], 10);
    deltaZ = -parseInt(enDown[2], 10);
  }

  if (levelIndex != null && deltaZ != null) {
    return {
      action: 'moveLevel',
      targetMode: 'semantic',
      targetRef: String(levelIndex),
      params: { levelIndex, deltaZ },
      confidence: 0.9,
      needsFollowUp: false,
    };
  }

  return null;
};

// ── Pattern: toggleBrace ────────────────────────────────────────────────────────
// "打开后撑" | "关闭后撑" | "开启后撑" | "toggle brace" | "后撑"
const toggleBracePattern: LocalPattern = (text, _ctx, _dsl) => {
  if (/打开后撑|开启后撑|加上后撑|开后撑/.test(text) ||
    /enable\s+brace|add\s+brace/i.test(text)) {
    return {
      action: 'toggleBrace',
      targetMode: 'global',
      targetRef: null,
      params: { rearBrace: true },
      confidence: 0.95,
      needsFollowUp: false,
    };
  }

  if (/关闭后撑|去掉后撑|删除后撑|关后撑|移除后撑/.test(text) ||
    /disable\s+brace|remove\s+brace/i.test(text)) {
    return {
      action: 'toggleBrace',
      targetMode: 'global',
      targetRef: null,
      params: { rearBrace: false },
      confidence: 0.95,
      needsFollowUp: false,
    };
  }

  if (/后撑|brace/.test(text)) {
    return {
      action: 'toggleBrace',
      targetMode: 'global',
      targetRef: null,
      params: {},
      confidence: 0.9,
      needsFollowUp: false,
    };
  }

  return null;
};

// ── Pattern: replaceProfileSeries ───────────────────────────────────────────────
// "型材改为U60" | "型材系列U90" | "切换型材" | "profile U50" | "U50"
const replaceProfilePattern: LocalPattern = (text, _ctx, _dsl) => {
  const seriesMatch = text.match(/型材(?:系列)?[改设为换]*\s*(U50|U60|U90)/);
  if (seriesMatch) {
    return {
      action: 'replaceProfileSeries',
      targetMode: 'global',
      targetRef: null,
      params: { profileSeries: seriesMatch[1] },
      confidence: 0.95,
      needsFollowUp: false,
    };
  }

  const enMatch = text.match(/profile\s*(?:series\s*)?(U50|U60|U90)/i);
  if (enMatch) {
    return {
      action: 'replaceProfileSeries',
      targetMode: 'global',
      targetRef: null,
      params: { profileSeries: enMatch[1] },
      confidence: 0.95,
      needsFollowUp: false,
    };
  }

  if (/切换型材|换型材|下一型材|cycle\s*profile/i.test(text)) {
    return {
      action: 'replaceProfileSeries',
      targetMode: 'global',
      targetRef: null,
      params: {},
      confidence: 0.9,
      needsFollowUp: false,
    };
  }

  return null;
};

// ── Pattern: insertBay ──────────────────────────────────────────────────────────
// "增加隔间800" | "添加隔间 宽800" | "insert bay 800"
const insertBayPattern: LocalPattern = (text, _ctx, dsl) => {
  const spanMatch = extractNumber(text, /(?:增加|添加|插入)\s*隔间.*?(\d+)/);
  if (spanMatch) {
    const nextIdx = dsl.modules.length + 1;
    return {
      action: 'insertBay',
      targetMode: 'global',
      targetRef: `bay-${nextIdx}`,
      params: {
        moduleId: `bay-${nextIdx}`,
        kind: 'rect-bay',
        spanMm: spanMatch,
      },
      confidence: 0.9,
      needsFollowUp: false,
    };
  }

  const enSpan = text.match(/insert\s+bay.*?(\d+)/i);
  if (enSpan) {
    const nextIdx = dsl.modules.length + 1;
    return {
      action: 'insertBay',
      targetMode: 'global',
      targetRef: `bay-${nextIdx}`,
      params: { moduleId: `bay-${nextIdx}`, kind: 'rect-bay', spanMm: parseInt(enSpan[1]) },
      confidence: 0.9,
      needsFollowUp: false,
    };
  }

  return null;
};

// ── Pattern: removeBay ──────────────────────────────────────────────────────────
// "删除第1个隔间" | "删除隔间2" | "remove bay 1" | "删除隔间"
const removeBayPattern: LocalPattern = (text, context, dsl) => {
  let bayIdx: number | null = null;

  const chBay = text.match(/删除\s*第?\s*(\d+)\s*(?:个)?\s*隔间/);
  const chBay2 = text.match(/去掉\s*第?\s*(\d+)\s*(?:个)?\s*隔间/);
  const enBay = text.match(/remove\s+bay[-_\s]*(\d+)/i);

  if (chBay) bayIdx = parseInt(chBay[1], 10);
  else if (chBay2) bayIdx = parseInt(chBay2[1], 10);
  else if (enBay) bayIdx = parseInt(enBay[1], 10);

  // If no index specified, use selection context
  if (bayIdx == null) {
    const selBay = context.activeSelection.find(
      (s) => s.entityType === 'structural' && s.bayIndex != null,
    );
    if (selBay?.bayIndex != null && (/删除.*隔间|去掉.*隔间|移除.*隔间/i.test(text) || /remove\s+bay/i.test(text))) {
      bayIdx = selBay.bayIndex;
    }
  }

  if (bayIdx != null) {
    const moduleId = bayIndexToModuleId(dsl, bayIdx);
    if (moduleId && moduleId !== dsl.modules[0]?.moduleId) {
      return {
        action: 'removeBay',
        targetMode: 'semantic',
        targetRef: moduleId,
        params: { moduleId },
        confidence: 0.9,
        needsFollowUp: false,
      };
    }
  }

  return null;
};

// ── Pattern: addBeam ────────────────────────────────────────────────────────────
// "添加横梁" | "添加beam" | not easily pattern-matched → returns null for API fallback
// We leave addBeam/removeBeam to the API fallback since they require spatial context.

// ── All local patterns in priority order ────────────────────────────────────────

const LOCAL_PATTERNS: LocalPattern[] = [
  resizeOverallPattern,
  resizeBayPattern,
  insertLevelPattern,
  removeLevelPattern,
  moveLevelPattern,
  toggleBracePattern,
  replaceProfilePattern,
  insertBayPattern,
  removeBayPattern,
];

// ── Local parser ────────────────────────────────────────────────────────────────

/**
 * Try to parse an edit command locally using pattern matching.
 * Returns null if no pattern matches (caller should fall back to API).
 */
export function parseLocalEdit(
  text: string,
  context: ReferenceContext,
  dsl: ResolvedDsl,
): EditIntent | null {
  const normalized = text.trim();
  if (!normalized) return null;

  for (const pattern of LOCAL_PATTERNS) {
    const result = pattern(normalized, context, dsl);
    if (result) return result;
  }

  return null;
}

// ── EditIntent → Command mapper ────────────────────────────────────────────────

/**
 * Map an EditIntent to the command type and payload that commandBus.execute() expects.
 * Resolves symbolic targets (bay indices, level indices) to concrete IDs.
 */
export function editIntentToCommand(
  intent: EditIntent,
  dsl: ResolvedDsl,
): CommandMapping {
  const { action, targetRef, params } = intent;

  // Ensure moduleId is present for bay-related commands
  function resolveModuleId(): string {
    if (typeof targetRef === 'string' && targetRef.startsWith('bay-')) return targetRef;
    const bayIdx = typeof params.bayIndex === 'number' ? params.bayIndex : null;
    if (bayIdx != null) {
      const modId = bayIndexToModuleId(dsl, bayIdx);
      if (modId) return modId;
    }
    return dsl.modules[0]?.moduleId ?? 'bay-1';
  }

  switch (action) {
    case 'resizeOverall': {
      const payload: Record<string, unknown> = {};
      if (params.width != null) payload.width = params.width;
      if (params.height != null) payload.height = params.height;
      if (params.depth != null) payload.depth = params.depth;
      return { type: 'resizeOverall', payload, targetRefs: [] };
    }

    case 'resizeBay': {
      const moduleId = (typeof targetRef === 'string' ? targetRef : null) ??
        (typeof params.moduleId === 'string' ? params.moduleId : resolveModuleId());
      return {
        type: 'resizeBay',
        payload: { moduleId, spanMm: params.spanMm },
        targetRefs: [{ entityType: 'module', id: moduleId, semanticPath: moduleId }],
      };
    }

    case 'insertLevel':
      return { type: 'insertLevel', payload: params as Record<string, unknown>, targetRefs: [] };

    case 'removeLevel':
      return { type: 'removeLevel', payload: params as Record<string, unknown>, targetRefs: [] };

    case 'moveLevel': {
      const li = typeof params.levelIndex === 'number' ? params.levelIndex :
        (typeof targetRef === 'string' ? parseInt(targetRef, 10) : 1);
      const dz = typeof params.deltaZ === 'number' ? params.deltaZ : 0;
      return {
        type: 'moveLevel',
        payload: { levelIndex: li, deltaZ: dz },
        targetRefs: [{ entityType: 'structural', id: `beam/front/${li}`, semanticPath: `beam/front/${li}` }],
      };
    }

    case 'toggleBrace':
      return { type: 'toggleBrace', payload: params as Record<string, unknown>, targetRefs: [] };

    case 'replaceProfileSeries':
      return { type: 'replaceProfileSeries', payload: params as Record<string, unknown>, targetRefs: [] };

    case 'insertBay': {
      const modId = typeof params.moduleId === 'string' ? params.moduleId : `bay-${dsl.modules.length + 1}`;
      return {
        type: 'insertBay',
        payload: { moduleId: modId, kind: params.kind ?? 'rect-bay', spanMm: params.spanMm ?? 800 },
        targetRefs: [{ entityType: 'module', id: modId, semanticPath: modId }],
      };
    }

    case 'removeBay': {
      const modId = (typeof targetRef === 'string' ? targetRef : null) ??
        (typeof params.moduleId === 'string' ? params.moduleId : resolveModuleId());
      return {
        type: 'removeBay',
        payload: { moduleId: modId },
        targetRefs: [{ entityType: 'module', id: modId, semanticPath: modId }],
      };
    }

    case 'addBeam': {
      const sp = typeof params.semanticPath === 'string' ? params.semanticPath : 'beam/custom/0';
      return {
        type: 'addBeam',
        payload: params as Record<string, unknown>,
        targetRefs: [{ entityType: 'structural', id: '', semanticPath: sp }],
      };
    }

    case 'removeBeam': {
      const sp = typeof params.semanticPath === 'string' ? params.semanticPath :
        (typeof targetRef === 'string' ? targetRef : '');
      return {
        type: 'removeBeam',
        payload: { semanticPath: sp },
        targetRefs: [{ entityType: 'structural', id: '', semanticPath: sp }],
      };
    }

    case 'restoreSnapshot':
      return { type: 'restoreSnapshot', payload: params as Record<string, unknown>, targetRefs: [] };

    default:
      throw new Error(`Unknown edit action: ${action}`);
  }
}

// ── Main interpreter API ────────────────────────────────────────────────────────

/**
 * Interpret a user edit text and return a result that can be executed.
 *
 * Strategy:
 * 1. Try local pattern matching first (fast, offline)
 * 2. Fall back to API call for complex natural language
 * 3. Map the resulting EditIntent to a command type + payload
 */
export async function interpretEdit(
  text: string,
  dsl: ResolvedDsl,
  context?: ReferenceContext,
): Promise<InterpretResult | null> {
  const ctx = context ?? buildReferenceContext();

  // Step 1: Try local parsing
  const localIntent = parseLocalEdit(text, ctx, dsl);
  if (localIntent) {
    const cmd = editIntentToCommand(localIntent, dsl);
    return {
      intent: localIntent,
      commandType: cmd.type,
      commandPayload: cmd.payload,
      source: 'local',
      needsFollowUp: localIntent.needsFollowUp,
      followUpQuestion: undefined,
      targetRefs: cmd.targetRefs,
    };
  }

  // Step 2: Fall back to AI API
  try {
    const aiResp = await api.editIntent(ctx, text);
    if (aiResp.status === 'ok' && aiResp.data) {
      const data = aiResp.data;
      const intent: EditIntent = {
        action: data.action as EditAction,
        targetMode: data.targetMode,
        targetRef: data.targetRef != null ? JSON.stringify(data.targetRef) : null,
        params: data.params,
        confidence: data.confidence,
        needsFollowUp: data.needsFollowUp,
      };
      const cmd = editIntentToCommand(intent, dsl);
      return {
        intent,
        commandType: cmd.type,
        commandPayload: cmd.payload,
        source: 'api',
        needsFollowUp: data.needsFollowUp,
        followUpQuestion: data.followUpQuestion,
        targetRefs: cmd.targetRefs,
      };
    }
    if (aiResp.status === 'refusal') {
      console.warn('[editInterpreter] AI refused:', aiResp.reason);
      return null;
    }
    console.warn('[editInterpreter] AI schema error:', (aiResp as { message?: string }).message);
    return null;
  } catch (err) {
    console.warn('[editInterpreter] API call failed, no local match either:', err);
    return null;
  }
}

import type {
  CommandEntry,
  CommandSource,
  EntityRef,
  ResolvedDsl,
  SnapshotMeta,
} from '@profileaxis/domain';
import { toRaw } from 'vue';
import { useProjectStore } from '@/stores/projectStore';
import { useCommandStore } from '@/stores/commandStore';
import { createPersistenceStore } from '@/services/persistenceStore';
import { resolve } from '@profileaxis/rules';

// ── Helpers ──────────────────────────────────────────────────────────────────

function cloneDsl(dsl: ResolvedDsl): ResolvedDsl {
  return JSON.parse(JSON.stringify(toRaw(dsl)));
}

function clonePayload(p: Record<string, unknown>): Record<string, unknown> {
  return JSON.parse(JSON.stringify(p));
}

function deepClone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v));
}

// ── Resolve params helper ────────────────────────────────────────────────────

/**
 * Extract high-level parameters from a resolved DSL for re-resolution.
 * Maps profileSpecKey back to series names used by the rules pipeline.
 */
interface ResolveParams {
  widthMm: number;
  depthMm: number;
  heightMm: number;
  shelfCount: number;
  profileSeries: string | null;
  rearBrace: boolean;
  caster: boolean;
}

function extractResolveParams(dsl: ResolvedDsl): ResolveParams {
  const frontBeams = dsl.nodes.filter(n => n.semanticPath.startsWith('beam/front/'));
  const shelfCount = Math.max(1, frontBeams.length);

  // profileSeries is intentionally NOT extracted from nodes because the
  // mapping is lossy: null series uses per-type fallbacks (upright vs beam)
  // that can't be round-tripped through a single series name.  Always use
  // null here; replaceProfileSeries overrides it explicitly.

  return {
    widthMm: dsl.overallSizeMm.width,
    depthMm: dsl.overallSizeMm.depth,
    heightMm: dsl.overallSizeMm.height,
    shelfCount,
    profileSeries: null,
    rearBrace: dsl.nodes.some(n => n.role === 'brace'),
    caster: dsl.nodes.some(n => n.role === 'foot'),
  };
}

/**
 * Re-resolve the full DSL through the rules pipeline, preserving original modules.
 * The resolve() function regenerates nodes/joints/overallSizeMm from high-level params.
 */
function reResolveDsl(dsl: ResolvedDsl): ResolvedDsl {
  const params = extractResolveParams(dsl);
  const resolved = resolve(params);
  const newDsl = deepClone(dsl);
  newDsl.nodes = deepClone(resolved.nodes);
  newDsl.joints = deepClone(resolved.joints);
  newDsl.overallSizeMm = deepClone(resolved.overallSizeMm);
  return newDsl;
}

// ── Handler registry ────────────────────────────────────────────────────────

/**
 * A CommandHandler receives the current DSL and a payload (either forward or
 * inverse). It returns the new DSL and an inverse payload that, when applied
 * through the same handler, restores the previous state.
 *
 * Handlers MUST be able to apply both their forward payload and their inverse
 * payload. The handler examines the payload shape to decide which direction
 * to apply.
 */
export type CommandHandler = (
  dsl: ResolvedDsl,
  payload: Record<string, unknown>,
) => { newDsl: ResolvedDsl; inversePayload: Record<string, unknown> };

const handlers = new Map<string, CommandHandler>();

export function registerHandler(type: string, handler: CommandHandler): void {
  handlers.set(type, handler);
}

// ── Command bus factory ─────────────────────────────────────────────────────

let seq = 0;

export function createCommandBus() {
  const projectStore = useProjectStore();
  const commandStore = useCommandStore();
  const persistence = createPersistenceStore();
  const snapshots = new Map<string, SnapshotEntry>();
  let snapSeq = 0;

  function execute(
    type: string,
    payload: Record<string, unknown>,
    opts?: { source?: CommandSource; targetRefs?: EntityRef[] },
  ): CommandEntry {
    const handler = handlers.get(type);
    if (!handler) throw new Error(`Unknown command type: ${type}`);

    const currentDsl = cloneDsl(projectStore.resolvedDsl);
    const clonedPayload = clonePayload(payload);
    const { newDsl, inversePayload } = handler(currentDsl, clonedPayload);

    const entry: CommandEntry = {
      commandId: `cmd-${++seq}-${Date.now()}`,
      type,
      source: opts?.source ?? 'user-ui',
      targetRefs: opts?.targetRefs ?? [],
      payload: clonePayload(payload),
      inversePayload: clonePayload(inversePayload),
      beforeRevisionId: projectStore.projectDoc.currentRevisionId,
      afterRevisionId: `rev-${seq}`,
    };

    commandStore.execute(entry);
    projectStore.updateResolvedDsl(newDsl);
    projectStore.projectDoc.currentRevisionId = entry.afterRevisionId;
    projectStore.projectDoc.commandCursor = commandStore.cursor;

    return entry;
  }

  function undo(): CommandEntry | null {
    const entry = commandStore.undo();
    if (!entry) return null;

    const handler = handlers.get(entry.type);
    if (handler) {
      const currentDsl = cloneDsl(projectStore.resolvedDsl);
      const invPayload = clonePayload(entry.inversePayload as Record<string, unknown>);
      const { newDsl } = handler(currentDsl, invPayload);
      projectStore.updateResolvedDsl(newDsl);
    }

    projectStore.projectDoc.currentRevisionId = entry.beforeRevisionId;
    projectStore.projectDoc.commandCursor = commandStore.cursor;
    return entry;
  }

  function redo(): CommandEntry | null {
    const entry = commandStore.redo();
    if (!entry) return null;

    const handler = handlers.get(entry.type);
    if (handler) {
      const currentDsl = cloneDsl(projectStore.resolvedDsl);
      const fwdPayload = clonePayload(entry.payload as Record<string, unknown>);
      const { newDsl } = handler(currentDsl, fwdPayload);
      projectStore.updateResolvedDsl(newDsl);
    }

    projectStore.projectDoc.currentRevisionId = entry.afterRevisionId;
    projectStore.projectDoc.commandCursor = commandStore.cursor;
    return entry;
  }

  async function saveSnapshot(label: string): Promise<SnapshotMeta> {
    const timestamp = Date.now();
    const snapshotId = `snap-${seq}-${timestamp}-${++snapSeq}`;
    const dsl = cloneDsl(projectStore.resolvedDsl);
    const revisionId = projectStore.projectDoc.currentRevisionId;
    const createdAt = new Date().toISOString();

    const meta: SnapshotEntry = { snapshotId, revisionId, createdAt, label, dsl };
    snapshots.set(snapshotId, meta);
    projectStore.projectDoc.snapshotIds = [...projectStore.projectDoc.snapshotIds, snapshotId];

    persistence.saveSnapshot(snapshotId, revisionId, label, dsl).catch(err => {
      console.warn('[commandBus] Failed to persist snapshot:', err);
    });

    return { snapshotId, revisionId, createdAt, label };
  }

  async function restoreSnapshot(snapshotId: string): Promise<boolean> {
    let snap = snapshots.get(snapshotId);

    if (!snap) {
      const persisted = await persistence.loadSnapshot(snapshotId);
      if (!persisted) return false;
      snap = persisted;
      snapshots.set(snapshotId, persisted);
    }

    projectStore.updateResolvedDsl(cloneDsl(snap.dsl));
    projectStore.projectDoc.currentRevisionId = snap.revisionId;
    projectStore.projectDoc.commandCursor = commandStore.cursor;
    return true;
  }

  function getSnapshotDsl(snapshotId: string): ResolvedDsl | null {
    return snapshots.get(snapshotId)?.dsl ?? null;
  }

  async function getSnapshotDslAsync(snapshotId: string): Promise<ResolvedDsl | null> {
    const cached = snapshots.get(snapshotId)?.dsl;
    if (cached) return cached;
    const persisted = await persistence.loadSnapshot(snapshotId);
    if (persisted) {
      snapshots.set(snapshotId, persisted);
      return persisted.dsl;
    }
    return null;
  }

  async function listSnapshots(): Promise<SnapshotMeta[]> {
    return [...snapshots.values()].map(({ snapshotId, revisionId, createdAt, label }) => ({
      snapshotId, revisionId, createdAt, label,
    }));
  }

  async function loadPersistedSnapshots(): Promise<void> {
    const persistedMetas = await persistence.listSnapshots();
    for (const pm of persistedMetas) {
      if (!snapshots.has(pm.snapshotId)) {
        const full = await persistence.loadSnapshot(pm.snapshotId);
        if (full) {
          snapshots.set(pm.snapshotId, full);
        }
      }
    }
  }

  function getHistory(): CommandEntry[] {
    return commandStore.history;
  }

  function getCursor(): number {
    return commandStore.cursor;
  }

  async function clear(): Promise<void> {
    commandStore.clear();
    snapshots.clear();
    projectStore.projectDoc.snapshotIds = [];
    projectStore.projectDoc.commandCursor = 0;
    await persistence.clearSnapshots().catch(err => {
      console.warn('[commandBus] Failed to clear persisted snapshots:', err);
    });
  }

  return {
    execute,
    undo,
    redo,
    saveSnapshot,
    restoreSnapshot,
    getSnapshotDsl,
    getSnapshotDslAsync,
    listSnapshots,
    loadPersistedSnapshots,
    getHistory,
    getCursor,
    clear,
  };
}

// ── Snapshot entry ──────────────────────────────────────────────────────────

interface SnapshotEntry {
  snapshotId: string;
  revisionId: string;
  createdAt: string;
  label: string;
  dsl: ResolvedDsl;
}

// ── Semantic command handlers ───────────────────────────────────────────────
// All handlers are bidirectional: payload shape determines direction.
// Command names align with EditAction from @profileaxis/schemas.

// ── resizeOverall — change overall dimensions ────────────────────────────────

registerHandler('resizeOverall', (dsl, payload) => {
  const oldSize = { ...dsl.overallSizeMm };
  const partial = payload as { width?: number; depth?: number; height?: number };
  const newDsl = deepClone(dsl);
  if (partial.width != null) newDsl.overallSizeMm.width = partial.width;
  if (partial.depth != null) newDsl.overallSizeMm.depth = partial.depth;
  if (partial.height != null) newDsl.overallSizeMm.height = partial.height;
  // Do NOT re-resolve: resizeOverall is a semantic intent declaration.
  // Nodes/joints adapt during the next topological command (insertLevel etc.)
  // or through the modeler's geometry projection.
  return { newDsl, inversePayload: oldSize };
});

// ── resizeBay — change a module bay span ────────────────────────────────────

registerHandler('resizeBay', (dsl, payload) => {
  const { moduleId, spanMm } = payload as { moduleId: string; spanMm: number };
  const mod = dsl.modules.find(m => m.moduleId === moduleId);
  if (!mod) throw new Error(`Module not found: ${moduleId}`);
  const oldSpan = mod.spanMm;
  const newDsl = deepClone(dsl);
  const targetMod = newDsl.modules.find(m => m.moduleId === moduleId)!;
  targetMod.spanMm = spanMm;
  // Update beam lengths for nodes whose semantic path references this module
  for (const node of newDsl.nodes) {
    if (node.role === 'beamX' || node.axis === 'x') {
      node.end.x = node.start.x + spanMm;
      node.lengthMm = spanMm;
    }
  }
  return { newDsl, inversePayload: { moduleId, spanMm: oldSpan } };
});

// ── insertBay — add a new module bay ─────────────────────────────────────────

registerHandler('insertBay', (dsl, payload) => {
  const p = payload as { moduleId: string; kind?: string; spanMm?: number };
  if (p.kind != null && p.spanMm != null) {
    if (dsl.modules.some(m => m.moduleId === p.moduleId)) {
      throw new Error(`Module already exists: ${p.moduleId}`);
    }
    const newDsl = deepClone(dsl);
    newDsl.modules = [...newDsl.modules, { moduleId: p.moduleId, kind: p.kind as 'rect-bay', spanMm: p.spanMm }];
    return { newDsl, inversePayload: { moduleId: p.moduleId } };
  } else {
    const mod = dsl.modules.find(m => m.moduleId === p.moduleId);
    if (!mod) throw new Error(`Module not found: ${p.moduleId}`);
    const newDsl = deepClone(dsl);
    newDsl.modules = newDsl.modules.filter(m => m.moduleId !== p.moduleId);
    return { newDsl, inversePayload: { moduleId: mod.moduleId, kind: mod.kind, spanMm: mod.spanMm } };
  }
});

// ── removeBay — remove a module bay ──────────────────────────────────────────

registerHandler('removeBay', (dsl, payload) => {
  const p = payload as { moduleId: string; kind?: string; spanMm?: number };
  if (p.kind != null && p.spanMm != null) {
    if (dsl.modules.some(m => m.moduleId === p.moduleId)) {
      throw new Error(`Module already exists: ${p.moduleId}`);
    }
    const newDsl = deepClone(dsl);
    newDsl.modules = [...newDsl.modules, { moduleId: p.moduleId, kind: p.kind as 'rect-bay', spanMm: p.spanMm }];
    return { newDsl, inversePayload: { moduleId: p.moduleId } };
  } else {
    const mod = dsl.modules.find(m => m.moduleId === p.moduleId);
    if (!mod) throw new Error(`Module not found: ${p.moduleId}`);
    const newDsl = deepClone(dsl);
    newDsl.modules = newDsl.modules.filter(m => m.moduleId !== p.moduleId);
    return { newDsl, inversePayload: { moduleId: mod.moduleId, kind: mod.kind, spanMm: mod.spanMm } };
  }
});

// ── insertLevel — add a shelf level (re-resolution via rules pipeline) ───────

registerHandler('insertLevel', (dsl, payload) => {
  const params = extractResolveParams(dsl);
  const oldShelfCount = params.shelfCount;

  const p = payload as { shelfCount?: number };
  if (p.shelfCount != null) {
    params.shelfCount = p.shelfCount;
  } else {
    params.shelfCount = Math.min(params.shelfCount + 1, 20);
  }

  const resolved = resolve(params);
  const newDsl = deepClone(dsl);
  newDsl.nodes = deepClone(resolved.nodes);
  newDsl.joints = deepClone(resolved.joints);
  newDsl.overallSizeMm = deepClone(resolved.overallSizeMm);

  return { newDsl, inversePayload: { shelfCount: oldShelfCount } };
});

// ── removeLevel — remove a shelf level ──────────────────────────────────────

registerHandler('removeLevel', (dsl, payload) => {
  const params = extractResolveParams(dsl);
  const oldShelfCount = params.shelfCount;

  const p = payload as { shelfCount?: number };
  if (p.shelfCount != null) {
    params.shelfCount = p.shelfCount;
  } else {
    params.shelfCount = Math.max(params.shelfCount - 1, 1);
  }

  const resolved = resolve(params);
  const newDsl = deepClone(dsl);
  newDsl.nodes = deepClone(resolved.nodes);
  newDsl.joints = deepClone(resolved.joints);
  newDsl.overallSizeMm = deepClone(resolved.overallSizeMm);

  return { newDsl, inversePayload: { shelfCount: oldShelfCount } };
});

// ── toggleBrace — toggle rear brace on/off ──────────────────────────────────

registerHandler('toggleBrace', (dsl, payload) => {
  const params = extractResolveParams(dsl);
  const oldBrace = params.rearBrace;

  const p = payload as { rearBrace?: boolean };
  if (p.rearBrace != null) {
    params.rearBrace = p.rearBrace;
  } else {
    params.rearBrace = !params.rearBrace;
  }

  const resolved = resolve(params);
  const newDsl = deepClone(dsl);
  newDsl.nodes = deepClone(resolved.nodes);
  newDsl.joints = deepClone(resolved.joints);
  newDsl.overallSizeMm = deepClone(resolved.overallSizeMm);

  return { newDsl, inversePayload: { rearBrace: oldBrace } };
});

// ── replaceProfileSeries — swap profile series ──────────────────────────────

registerHandler('replaceProfileSeries', (dsl, payload) => {
  const params = extractResolveParams(dsl);
  const oldSeries = params.profileSeries;

  const p = payload as { profileSeries?: string | null };
  if (p.profileSeries !== undefined) {
    params.profileSeries = p.profileSeries;
  } else {
    // Toggle through series: null → U50 → U60 → U90 → null
    const series = [null, 'U50', 'U60', 'U90'];
    const idx = series.indexOf(params.profileSeries);
    params.profileSeries = series[(idx + 1) % series.length];
  }

  const resolved = resolve(params);
  const newDsl = deepClone(dsl);
  newDsl.nodes = deepClone(resolved.nodes);
  newDsl.joints = deepClone(resolved.joints);
  newDsl.overallSizeMm = deepClone(resolved.overallSizeMm);

  return { newDsl, inversePayload: { profileSeries: oldSeries } };
});

// ── addBeam — add a beam at a specific position ─────────────────────────────

registerHandler('addBeam', (dsl, payload) => {
  const p = payload as {
    semanticPath?: string; role?: string; axis?: string;
    start?: { x: number; y: number; z: number };
    end?: { x: number; y: number; z: number };
    lengthMm?: number; profileSpecKey?: string;
  };
  // Forward: semanticPath is present → add beam
  if (p.semanticPath != null) {
    if (dsl.nodes.some(n => n.semanticPath === p.semanticPath)) {
      throw new Error(`Beam already exists: ${p.semanticPath}`);
    }
    const newDsl = deepClone(dsl);
    const nodeId = `N-${Math.abs(
      p.semanticPath.split('').reduce((h, c) => ((h << 5) - h + c.charCodeAt(0)) & 0xffffffff, 0)
    ).toString(36).padStart(8, '0')}`;
    newDsl.nodes = [...newDsl.nodes, {
      nodeId,
      kind: 'member',
      role: (p.role as 'beamX' | 'beamY') || 'beamX',
      semanticPath: p.semanticPath,
      axis: (p.axis as 'x' | 'y' | 'z') || 'x',
      start: p.start ?? { x: 0, y: 0, z: 0 },
      end: p.end ?? { x: p.lengthMm ?? 0, y: 0, z: 0 },
      lengthMm: p.lengthMm ?? 0,
      profileSpecKey: p.profileSpecKey ?? 'PB-SB60-40-2.0',
      provenance: { source: 'user', ruleIds: [] },
      finishKey: 'FZ-pre galvanized',
      tags: [],
    }];
    return { newDsl, inversePayload: { semanticPath: p.semanticPath } };
  }
  // Inverse: semanticPath is absent → remove beam
  const removePath = (payload as { semanticPath: string }).semanticPath;
  const existing = dsl.nodes.find(n => n.semanticPath === removePath);
  if (!existing) throw new Error(`Beam not found: ${removePath}`);
  const newDsl = deepClone(dsl);
  newDsl.nodes = newDsl.nodes.filter(n => n.semanticPath !== removePath);
  return {
    newDsl,
    inversePayload: {
      semanticPath: existing.semanticPath, role: existing.role, axis: existing.axis,
      start: existing.start, end: existing.end, lengthMm: existing.lengthMm,
      profileSpecKey: existing.profileSpecKey,
    },
  };
});

// ── removeBeam — remove a beam ──────────────────────────────────────────────

registerHandler('removeBeam', (dsl, payload) => {
  const p = payload as { semanticPath?: string; role?: string; axis?: string;
    start?: { x: number; y: number; z: number }; end?: { x: number; y: number; z: number };
    lengthMm?: number; profileSpecKey?: string; };
  if (p.semanticPath != null && p.role != null) {
    // Inverse: restore beam
    const newDsl = deepClone(dsl);
    const nodeId = `N-${Math.abs(
      p.semanticPath.split('').reduce((h, c) => ((h << 5) - h + c.charCodeAt(0)) & 0xffffffff, 0)
    ).toString(36).padStart(8, '0')}`;
    newDsl.nodes = [...newDsl.nodes, {
      nodeId, kind: 'member',
      role: p.role as 'beamX' | 'beamY',
      semanticPath: p.semanticPath,
      axis: (p.axis as 'x' | 'y' | 'z') || 'x',
      start: p.start ?? { x: 0, y: 0, z: 0 },
      end: p.end ?? { x: p.lengthMm ?? 0, y: 0, z: 0 },
      lengthMm: p.lengthMm ?? 0,
      profileSpecKey: p.profileSpecKey ?? 'PB-SB60-40-2.0',
      provenance: { source: 'user', ruleIds: [] },
      finishKey: 'FZ-pre galvanized', tags: [],
    }];
    return { newDsl, inversePayload: { semanticPath: p.semanticPath } };
  }
  // Forward: remove beam
  const removePath = (payload as { semanticPath: string }).semanticPath;
  const existing = dsl.nodes.find(n => n.semanticPath === removePath);
  if (!existing) throw new Error(`Beam not found: ${removePath}`);
  const newDsl = deepClone(dsl);
  newDsl.nodes = newDsl.nodes.filter(n => n.semanticPath !== removePath);
  return {
    newDsl,
    inversePayload: {
      semanticPath: existing.semanticPath, role: existing.role, axis: existing.axis,
      start: existing.start, end: existing.end, lengthMm: existing.lengthMm,
      profileSpecKey: existing.profileSpecKey,
    },
  };
});

// ── restoreSnapshot — restore a saved snapshot by ID ─────────────────────────

registerHandler('restoreSnapshot', (dsl, payload) => {
  const p = payload as { dsl?: ResolvedDsl; snapshotId?: string };
  // Forward: dsl contains the snapshot DSL to restore
  if (p.dsl != null) {
    const oldDsl = deepClone(dsl);
    const newDsl = deepClone(p.dsl);
    return { newDsl, inversePayload: { dsl: oldDsl } };
  }
  // Inverse: dsl contains the pre-restore DSL to go back
  // (handled identically — swap the DSLs)
  throw new Error('restoreSnapshot requires a DSL payload');
});

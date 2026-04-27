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

  function saveSnapshot(label: string): SnapshotMeta {
    const timestamp = Date.now();
    const snapshotId = `snap-${seq}-${timestamp}-${++snapSeq}`;
    const meta: SnapshotEntry = {
      snapshotId,
      revisionId: projectStore.projectDoc.currentRevisionId,
      createdAt: new Date().toISOString(),
      label,
      dsl: cloneDsl(projectStore.resolvedDsl),
    };
    snapshots.set(snapshotId, meta);
    projectStore.projectDoc.snapshotIds = [...projectStore.projectDoc.snapshotIds, snapshotId];
    return { snapshotId: meta.snapshotId, revisionId: meta.revisionId, createdAt: meta.createdAt, label: meta.label };
  }

  function restoreSnapshot(snapshotId: string): boolean {
    const snap = snapshots.get(snapshotId);
    if (!snap) return false;

    projectStore.updateResolvedDsl(cloneDsl(snap.dsl));
    projectStore.projectDoc.currentRevisionId = snap.revisionId;
    projectStore.projectDoc.commandCursor = commandStore.cursor;
    return true;
  }

  function getSnapshotDsl(snapshotId: string): ResolvedDsl | null {
    return snapshots.get(snapshotId)?.dsl ?? null;
  }

  function listSnapshots(): SnapshotMeta[] {
    return [...snapshots.values()].map(({ snapshotId, revisionId, createdAt, label }) => ({
      snapshotId,
      revisionId,
      createdAt,
      label,
    }));
  }

  function getHistory(): CommandEntry[] {
    return commandStore.history;
  }

  function getCursor(): number {
    return commandStore.cursor;
  }

  function clear(): void {
    commandStore.clear();
    snapshots.clear();
    projectStore.projectDoc.snapshotIds = [];
    projectStore.projectDoc.commandCursor = 0;
  }

  return {
    execute,
    undo,
    redo,
    saveSnapshot,
    restoreSnapshot,
    getSnapshotDsl,
    listSnapshots,
    getHistory,
    getCursor,
    clear,
  };
}

// ── Snapshot entry (used only for type) ──────────────────────────────────────

interface SnapshotEntry {
  snapshotId: string;
  revisionId: string;
  createdAt: string;
  label: string;
  dsl: ResolvedDsl;
}

// ── Built-in semantic command handlers ──────────────────────────────────────
// Each handler MUST handle both its forward payload and its inverse payload.

registerHandler('setOverallSize', (dsl, payload) => {
  const oldSize = { ...dsl.overallSizeMm };
  const partial = payload as { width?: number; depth?: number; height?: number };
  const newDsl = deepClone(dsl);
  if (partial.width != null) newDsl.overallSizeMm.width = partial.width;
  if (partial.depth != null) newDsl.overallSizeMm.depth = partial.depth;
  if (partial.height != null) newDsl.overallSizeMm.height = partial.height;
  return { newDsl, inversePayload: oldSize };
});

registerHandler('setModuleSpan', (dsl, payload) => {
  const { moduleId, spanMm } = payload as { moduleId: string; spanMm: number };
  const mod = dsl.modules.find(m => m.moduleId === moduleId);
  if (!mod) throw new Error(`Module not found: ${moduleId}`);
  const oldSpan = mod.spanMm;
  const newDsl = deepClone(dsl);
  const targetMod = newDsl.modules.find(m => m.moduleId === moduleId)!;
  targetMod.spanMm = spanMm;
  return { newDsl, inversePayload: { moduleId, spanMm: oldSpan } };
});

// addModule: forward={moduleId, kind, spanMm} adds; inverse={moduleId} removes
registerHandler('addModule', (dsl, payload) => {
  const p = payload as { moduleId: string; kind?: string; spanMm?: number };
  // If kind and spanMm are present → add; otherwise → remove (inverse)
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

// removeModule: forward={moduleId} removes; inverse={moduleId, kind, spanMm} adds
registerHandler('removeModule', (dsl, payload) => {
  const p = payload as { moduleId: string; kind?: string; spanMm?: number };
  // If kind and spanMm are present → add (inverse); otherwise → remove
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

registerHandler('setNodes', (dsl, payload) => {
  const { nodes } = payload as { nodes: ResolvedDsl['nodes'] };
  const oldNodes = deepClone(dsl.nodes);
  const newDsl = deepClone(dsl);
  newDsl.nodes = deepClone(nodes);
  return { newDsl, inversePayload: { nodes: oldNodes } };
});

registerHandler('setJoints', (dsl, payload) => {
  const { joints } = payload as { joints: ResolvedDsl['joints'] };
  const oldJoints = deepClone(dsl.joints);
  const newDsl = deepClone(dsl);
  newDsl.joints = deepClone(joints);
  return { newDsl, inversePayload: { joints: oldJoints } };
});

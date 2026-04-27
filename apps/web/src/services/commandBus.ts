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

    // Persist to IndexedDB (fire-and-forget, errors logged but not thrown)
    persistence.saveSnapshot(snapshotId, revisionId, label, dsl).catch(err => {
      console.warn('[commandBus] Failed to persist snapshot:', err);
    });

    return { snapshotId, revisionId, createdAt, label };
  }

  async function restoreSnapshot(snapshotId: string): Promise<boolean> {
    let snap = snapshots.get(snapshotId);

    // Fall back to persisted storage if not in memory
    if (!snap) {
      const persisted = await persistence.loadSnapshot(snapshotId);
      if (!persisted) return false;
      snap = persisted;
      // Hydrate in-memory cache
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
    // Return from in-memory cache (always up-to-date during a session).
    // For cross-session restored snapshots, use loadPersistedSnapshots().
    return [...snapshots.values()].map(({ snapshotId, revisionId, createdAt, label }) => ({
      snapshotId, revisionId, createdAt, label,
    }));
  }

  // Hydrate in-memory cache from persisted store (call on app startup)
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

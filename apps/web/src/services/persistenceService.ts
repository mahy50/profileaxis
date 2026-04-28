import type { ProjectDocument, CommandEntry, ResolvedDsl, SnapshotMeta } from '@profileaxis/domain';

// ── Constants ────────────────────────────────────────────────────────────────

const DB_NAME = 'profileaxis-persistence';
const DB_VERSION = 2;
const STORE_PROJECTS = 'projects';
const STORE_SNAPSHOTS = 'snapshots';
const STORE_COMMANDS = 'commands';

// ── Persisted shapes ─────────────────────────────────────────────────────────

export interface PersistedProject {
  projectId: string;
  name: string;
  updatedAt: string;
  doc: ProjectDocument;
}

export interface PersistedSnapshot {
  snapshotId: string;
  projectId: string;
  revisionId: string;
  createdAt: string;
  label: string;
  dsl: ResolvedDsl;
}

interface StoredCommandBlock {
  projectId: string;
  commands: CommandEntry[];
}

// ── Storage backend interface ────────────────────────────────────────────────

interface StorageBackend {
  saveProject(entry: PersistedProject): Promise<void>;
  loadProject(projectId: string): Promise<PersistedProject | null>;
  loadLatestProject(): Promise<PersistedProject | null>;
  listProjects(): Promise<PersistedProject[]>;
  deleteProject(projectId: string): Promise<void>;
  saveSnapshot(snap: PersistedSnapshot): Promise<void>;
  loadSnapshot(snapshotId: string): Promise<PersistedSnapshot | null>;
  listSnapshots(projectId?: string): Promise<PersistedSnapshot[]>;
  deleteSnapshot(snapshotId: string): Promise<void>;
  clearSnapshots(): Promise<void>;
  saveCommands(projectId: string, commands: CommandEntry[]): Promise<void>;
  loadCommands(projectId: string): Promise<CommandEntry[]>;
  deleteCommands(projectId: string): Promise<void>;
}

// ── IndexedDB backend ────────────────────────────────────────────────────────

function idbAvailable(): boolean {
  try {
    return typeof indexedDB !== 'undefined';
  } catch {
    return false;
  }
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (ev) => {
      const db = req.result;
      const oldVersion = ev.oldVersion;
      // V1 already existed (snapshots store from persistenceStore.ts)
      // V2 adds projects and commands stores
      if (oldVersion < 1) {
        if (!db.objectStoreNames.contains(STORE_SNAPSHOTS)) {
          db.createObjectStore(STORE_SNAPSHOTS, { keyPath: 'snapshotId' });
        }
      }
      if (oldVersion < 2) {
        if (!db.objectStoreNames.contains(STORE_PROJECTS)) {
          db.createObjectStore(STORE_PROJECTS, { keyPath: 'projectId' });
        }
        if (!db.objectStoreNames.contains(STORE_COMMANDS)) {
          db.createObjectStore(STORE_COMMANDS, { keyPath: 'projectId' });
        }
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function createIDBBackend(): StorageBackend {
  // ── Projects ─────────────────────────────────────────────────────────────
  return {
    async saveProject(entry: PersistedProject): Promise<void> {
      const db = await openDB();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_PROJECTS, 'readwrite');
        tx.objectStore(STORE_PROJECTS).put(entry);
        tx.oncomplete = () => { db.close(); resolve(); };
        tx.onerror = () => { db.close(); reject(tx.error); };
      });
    },
    async loadProject(projectId: string): Promise<PersistedProject | null> {
      const db = await openDB();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_PROJECTS, 'readonly');
        const req = tx.objectStore(STORE_PROJECTS).get(projectId);
        req.onsuccess = () => { db.close(); resolve(req.result ?? null); };
        req.onerror = () => { db.close(); reject(req.error); };
      });
    },
    async loadLatestProject(): Promise<PersistedProject | null> {
      const all = await this.listProjects();
      if (all.length === 0) return null;
      return this.loadProject(all[0].projectId);
    },
    async listProjects(): Promise<PersistedProject[]> {
      const db = await openDB();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_PROJECTS, 'readonly');
        const req = tx.objectStore(STORE_PROJECTS).getAll();
        req.onsuccess = () => {
          db.close();
          const list: PersistedProject[] = req.result ?? [];
          list.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
          resolve(list);
        };
        req.onerror = () => { db.close(); reject(req.error); };
      });
    },
    async deleteProject(projectId: string): Promise<void> {
      const db = await openDB();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_PROJECTS, 'readwrite');
        tx.objectStore(STORE_PROJECTS).delete(projectId);
        tx.oncomplete = () => { db.close(); resolve(); };
        tx.onerror = () => { db.close(); reject(tx.error); };
      });
    },

    // ── Snapshots ───────────────────────────────────────────────────────────
    async saveSnapshot(snap: PersistedSnapshot): Promise<void> {
      const db = await openDB();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_SNAPSHOTS, 'readwrite');
        tx.objectStore(STORE_SNAPSHOTS).put(snap);
        tx.oncomplete = () => { db.close(); resolve(); };
        tx.onerror = () => { db.close(); reject(tx.error); };
      });
    },
    async loadSnapshot(snapshotId: string): Promise<PersistedSnapshot | null> {
      const db = await openDB();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_SNAPSHOTS, 'readonly');
        const req = tx.objectStore(STORE_SNAPSHOTS).get(snapshotId);
        req.onsuccess = () => { db.close(); resolve(req.result ?? null); };
        req.onerror = () => { db.close(); reject(req.error); };
      });
    },
    async listSnapshots(_projectId?: string): Promise<PersistedSnapshot[]> {
      const db = await openDB();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_SNAPSHOTS, 'readonly');
        const req = tx.objectStore(STORE_SNAPSHOTS).getAll();
        req.onsuccess = () => { db.close(); resolve(req.result ?? []); };
        req.onerror = () => { db.close(); reject(req.error); };
      });
    },
    async deleteSnapshot(snapshotId: string): Promise<void> {
      const db = await openDB();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_SNAPSHOTS, 'readwrite');
        tx.objectStore(STORE_SNAPSHOTS).delete(snapshotId);
        tx.oncomplete = () => { db.close(); resolve(); };
        tx.onerror = () => { db.close(); reject(tx.error); };
      });
    },
    async clearSnapshots(): Promise<void> {
      const db = await openDB();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_SNAPSHOTS, 'readwrite');
        tx.objectStore(STORE_SNAPSHOTS).clear();
        tx.oncomplete = () => { db.close(); resolve(); };
        tx.onerror = () => { db.close(); reject(tx.error); };
      });
    },

    // ── Commands ────────────────────────────────────────────────────────────
    async saveCommands(projectId: string, commands: CommandEntry[]): Promise<void> {
      const db = await openDB();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_COMMANDS, 'readwrite');
        tx.objectStore(STORE_COMMANDS).put({ projectId, commands });
        tx.oncomplete = () => { db.close(); resolve(); };
        tx.onerror = () => { db.close(); reject(tx.error); };
      });
    },
    async loadCommands(projectId: string): Promise<CommandEntry[]> {
      const db = await openDB();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_COMMANDS, 'readonly');
        const req = tx.objectStore(STORE_COMMANDS).get(projectId);
        req.onsuccess = () => {
          db.close();
          const block: StoredCommandBlock | undefined = req.result;
          resolve(block?.commands ?? []);
        };
        req.onerror = () => { db.close(); reject(req.error); };
      });
    },
    async deleteCommands(projectId: string): Promise<void> {
      const db = await openDB();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_COMMANDS, 'readwrite');
        tx.objectStore(STORE_COMMANDS).delete(projectId);
        tx.oncomplete = () => { db.close(); resolve(); };
        tx.onerror = () => { db.close(); reject(tx.error); };
      });
    },
  };
}

// ── In-memory backend (fallback for tests / Node.js) ─────────────────────────

function clone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v));
}

function createMemoryBackend(): StorageBackend {
  const projects = new Map<string, PersistedProject>();
  const snapshots = new Map<string, PersistedSnapshot>();
  const commands = new Map<string, CommandEntry[]>();

  return {
    async saveProject(entry: PersistedProject): Promise<void> {
      projects.set(entry.projectId, clone(entry));
    },
    async loadProject(projectId: string): Promise<PersistedProject | null> {
      const p = projects.get(projectId);
      return p ? clone(p) : null;
    },
    async loadLatestProject(): Promise<PersistedProject | null> {
      const all = await this.listProjects();
      return all[0] ?? null;
    },
    async listProjects(): Promise<PersistedProject[]> {
      const list = [...projects.values()].map(p => clone(p));
      list.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
      return list;
    },
    async deleteProject(projectId: string): Promise<void> {
      projects.delete(projectId);
    },
    async saveSnapshot(snap: PersistedSnapshot): Promise<void> {
      snapshots.set(snap.snapshotId, clone(snap));
    },
    async loadSnapshot(snapshotId: string): Promise<PersistedSnapshot | null> {
      const s = snapshots.get(snapshotId);
      return s ? clone(s) : null;
    },
    async listSnapshots(_projectId?: string): Promise<PersistedSnapshot[]> {
      return [...snapshots.values()].map(s => clone(s));
    },
    async deleteSnapshot(snapshotId: string): Promise<void> {
      snapshots.delete(snapshotId);
    },
    async clearSnapshots(): Promise<void> {
      snapshots.clear();
    },
    async saveCommands(projectId: string, cmds: CommandEntry[]): Promise<void> {
      commands.set(projectId, clone(cmds));
    },
    async loadCommands(projectId: string): Promise<CommandEntry[]> {
      const c = commands.get(projectId);
      return c ? clone(c) : [];
    },
    async deleteCommands(projectId: string): Promise<void> {
      commands.delete(projectId);
    },
  };
}

// ── Persistence service factory ──────────────────────────────────────────────

let _backend: StorageBackend | null = null;

function getBackend(): StorageBackend {
  if (!_backend) {
    _backend = idbAvailable() ? createIDBBackend() : createMemoryBackend();
  }
  return _backend;
}

/** For testing: inject a custom backend */
export function injectPersistenceBackend(backend: StorageBackend): void {
  _backend = backend;
}

// ── Public API ───────────────────────────────────────────────────────────────

export async function saveProject(doc: ProjectDocument): Promise<void> {
  const b = getBackend();
  await b.saveProject({
    projectId: doc.projectId,
    name: doc.name,
    updatedAt: new Date().toISOString(),
    doc: JSON.parse(JSON.stringify(doc)),
  });
}

export async function loadLatestProject(): Promise<ProjectDocument | null> {
  const b = getBackend();
  const entry = await b.loadLatestProject();
  return entry?.doc ?? null;
}

export async function loadProject(projectId: string): Promise<ProjectDocument | null> {
  const b = getBackend();
  const entry = await b.loadProject(projectId);
  return entry?.doc ?? null;
}

export async function listProjects(): Promise<Array<{ projectId: string; name: string; updatedAt: string }>> {
  const b = getBackend();
  const all = await b.listProjects();
  return all.map(({ projectId, name, updatedAt }) => ({ projectId, name, updatedAt }));
}

export async function deleteProject(projectId: string): Promise<void> {
  const b = getBackend();
  await b.deleteProject(projectId);
  await b.deleteCommands(projectId);
}

// ── Snapshot API ─────────────────────────────────────────────────────────────

export async function saveSnapshot(
  snapshotId: string,
  projectId: string,
  revisionId: string,
  label: string,
  dsl: ResolvedDsl,
): Promise<void> {
  const b = getBackend();
  await b.saveSnapshot({
    snapshotId,
    projectId,
    revisionId,
    createdAt: new Date().toISOString(),
    label,
    dsl: JSON.parse(JSON.stringify(dsl)),
  });
}

export async function loadSnapshot(snapshotId: string): Promise<PersistedSnapshot | null> {
  const b = getBackend();
  return b.loadSnapshot(snapshotId);
}

export async function listSnapshots(projectId?: string): Promise<SnapshotMeta[]> {
  const b = getBackend();
  const all = await b.listSnapshots(projectId);
  return all.map(({ snapshotId, revisionId, createdAt, label }) => ({
    snapshotId,
    revisionId,
    createdAt,
    label,
  }));
}

export async function deleteSnapshot(snapshotId: string): Promise<void> {
  const b = getBackend();
  await b.deleteSnapshot(snapshotId);
}

export async function clearSnapshots(): Promise<void> {
  const b = getBackend();
  await b.clearSnapshots();
}

// ── Command history API ──────────────────────────────────────────────────────

export async function saveCommands(projectId: string, commands: CommandEntry[]): Promise<void> {
  const b = getBackend();
  await b.saveCommands(projectId, commands);
}

export async function loadCommands(projectId: string): Promise<CommandEntry[]> {
  const b = getBackend();
  return b.loadCommands(projectId);
}

export async function deleteCommands(projectId: string): Promise<void> {
  const b = getBackend();
  await b.deleteCommands(projectId);
}

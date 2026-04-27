import type { ResolvedDsl, SnapshotMeta } from '@profileaxis/domain';

// ── Snapshot record (persisted shape) ──────────────────────────────────────

export interface PersistedSnapshot {
  snapshotId: string;
  revisionId: string;
  createdAt: string;
  label: string;
  dsl: ResolvedDsl;
}

// ── Storage backend interface ──────────────────────────────────────────────

interface StorageBackend {
  save(snapshot: PersistedSnapshot): Promise<void>;
  load(snapshotId: string): Promise<PersistedSnapshot | null>;
  delete(snapshotId: string): Promise<void>;
  list(): Promise<PersistedSnapshot[]>;
  clear(): Promise<void>;
}

// ── IndexedDB backend ─────────────────────────────────────────────────────

const DB_NAME = 'profileaxis-persistence';
const DB_VERSION = 1;
const STORE_NAME = 'snapshots';

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(STORE_NAME, { keyPath: 'snapshotId' });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function idbAvailable(): boolean {
  try {
    return typeof indexedDB !== 'undefined';
  } catch {
    return false;
  }
}

function createIDBBackend(): StorageBackend {
  return {
    async save(snapshot: PersistedSnapshot): Promise<void> {
      const db = await openDB();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        tx.objectStore(STORE_NAME).put(snapshot);
        tx.oncomplete = () => { db.close(); resolve(); };
        tx.onerror = () => { db.close(); reject(tx.error); };
      });
    },
    async load(snapshotId: string): Promise<PersistedSnapshot | null> {
      const db = await openDB();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const req = tx.objectStore(STORE_NAME).get(snapshotId);
        req.onsuccess = () => { db.close(); resolve(req.result ?? null); };
        req.onerror = () => { db.close(); reject(req.error); };
      });
    },
    async delete(snapshotId: string): Promise<void> {
      const db = await openDB();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        tx.objectStore(STORE_NAME).delete(snapshotId);
        tx.oncomplete = () => { db.close(); resolve(); };
        tx.onerror = () => { db.close(); reject(tx.error); };
      });
    },
    async list(): Promise<PersistedSnapshot[]> {
      const db = await openDB();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const req = tx.objectStore(STORE_NAME).getAll();
        req.onsuccess = () => { db.close(); resolve(req.result ?? []); };
        req.onerror = () => { db.close(); reject(req.error); };
      });
    },
    async clear(): Promise<void> {
      const db = await openDB();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        tx.objectStore(STORE_NAME).clear();
        tx.oncomplete = () => { db.close(); resolve(); };
        tx.onerror = () => { db.close(); reject(tx.error); };
      });
    },
  };
}

// ── In-memory backend (fallback for tests / Node.js) ───────────────────────

function createMemoryBackend(): StorageBackend {
  const store = new Map<string, PersistedSnapshot>();

  return {
    async save(snapshot: PersistedSnapshot): Promise<void> {
      store.set(snapshot.snapshotId, structuredClone?.(snapshot) ?? JSON.parse(JSON.stringify(snapshot)));
    },
    async load(snapshotId: string): Promise<PersistedSnapshot | null> {
      const s = store.get(snapshotId);
      return s ? (structuredClone?.(s) ?? JSON.parse(JSON.stringify(s))) : null;
    },
    async delete(snapshotId: string): Promise<void> {
      store.delete(snapshotId);
    },
    async list(): Promise<PersistedSnapshot[]> {
      return [...store.values()].map(s =>
        structuredClone?.(s) ?? JSON.parse(JSON.stringify(s)),
      );
    },
    async clear(): Promise<void> {
      store.clear();
    },
  };
}

// ── Persistence store ─────────────────────────────────────────────────────

// Each store instance gets its own backend for isolation.
// IndexedDB is shared (by DB name), but in-memory backends are independent.

export function createPersistenceStore() {
  const b: StorageBackend = idbAvailable() ? createIDBBackend() : createMemoryBackend();

  async function saveSnapshot(
    snapshotId: string,
    revisionId: string,
    label: string,
    dsl: ResolvedDsl,
  ): Promise<void> {
    await b.save({
      snapshotId,
      revisionId,
      createdAt: new Date().toISOString(),
      label,
      dsl: JSON.parse(JSON.stringify(dsl)),
    });
  }

  async function loadSnapshot(snapshotId: string): Promise<PersistedSnapshot | null> {
    return b.load(snapshotId);
  }

  async function deleteSnapshot(snapshotId: string): Promise<void> {
    await b.delete(snapshotId);
  }

  async function listSnapshots(): Promise<SnapshotMeta[]> {
    const all = await b.list();
    return all.map(({ snapshotId, revisionId, createdAt, label }) => ({
      snapshotId,
      revisionId,
      createdAt,
      label,
    }));
  }

  async function clearSnapshots(): Promise<void> {
    await b.clear();
  }

  return {
    saveSnapshot,
    loadSnapshot,
    deleteSnapshot,
    listSnapshots,
    clearSnapshots,
  };
}

export type PersistenceStore = ReturnType<typeof createPersistenceStore>;

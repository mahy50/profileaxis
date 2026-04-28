import { describe, test, expect, beforeEach } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useProjectStore } from '@/stores/projectStore';
import { useCommandStore } from '@/stores/commandStore';
import { createCommandBus } from '@/services/commandBus';
import {
  saveProject,
  loadLatestProject,
  loadProject,
  listProjects,
  deleteProject,
  saveCommands,
  loadCommands,
  deleteCommands,
  injectPersistenceBackend,
  saveSnapshot,
  loadSnapshot,
  listSnapshots,
  clearSnapshots,
} from '@/services/persistenceService';
import type { ProjectDocument } from '@profileaxis/domain';

// ── Helpers ──────────────────────────────────────────────────────────────────

function createMemoryBackendForTest() {
  const projects = new Map<string, any>();
  const snapshots = new Map<string, any>();
  const commands = new Map<string, any[]>();

  return {
    async saveProject(entry: any) { projects.set(entry.projectId, JSON.parse(JSON.stringify(entry))); },
    async loadProject(projectId: string) { const p = projects.get(projectId); return p ? JSON.parse(JSON.stringify(p)) : null; },
    async loadLatestProject() { const all = await this.listProjects(); return all[0] ?? null; },
    async listProjects() { const list = [...projects.values()].map((p: any) => JSON.parse(JSON.stringify(p))); list.sort((a: any, b: any) => b.updatedAt.localeCompare(a.updatedAt)); return list; },
    async deleteProject(projectId: string) { projects.delete(projectId); },
    async saveSnapshot(snap: any) { snapshots.set(snap.snapshotId, JSON.parse(JSON.stringify(snap))); },
    async loadSnapshot(snapshotId: string) { const s = snapshots.get(snapshotId); return s ? JSON.parse(JSON.stringify(s)) : null; },
    async listSnapshots(_pid?: string) { return [...snapshots.values()].map((s: any) => JSON.parse(JSON.stringify(s))); },
    async deleteSnapshot(snapshotId: string) { snapshots.delete(snapshotId); },
    async clearSnapshots() { snapshots.clear(); },
    async saveCommands(projectId: string, cmds: any[]) { commands.set(projectId, JSON.parse(JSON.stringify(cmds))); },
    async loadCommands(projectId: string) { const c = commands.get(projectId); return c ? JSON.parse(JSON.stringify(c)) : []; },
    async deleteCommands(projectId: string) { commands.delete(projectId); },
  };
}

function cloneDoc(doc: ProjectDocument): ProjectDocument {
  return JSON.parse(JSON.stringify(doc));
}

describe('PersistenceService', () => {
  beforeEach(() => {
    injectPersistenceBackend(createMemoryBackendForTest() as any);
    setActivePinia(createPinia());
  });

  describe('project persistence', () => {
    test('save and load latest project', async () => {
      const store = useProjectStore();
      const doc = store.projectDoc;
      doc.name = 'Test Rack';

      await saveProject(doc);

      const loaded = await loadLatestProject();
      expect(loaded).not.toBeNull();
      expect(loaded!.projectId).toBe(doc.projectId);
      expect(loaded!.name).toBe('Test Rack');
      expect(loaded!.resolvedDsl).toBeDefined();
    });

    test('load latest returns most recently saved project', async () => {
      const store = useProjectStore();

      const doc1 = cloneDoc(store.projectDoc);
      doc1.name = 'First';
      doc1.projectId = 'proj-1';
      await saveProject(doc1);

      // Small delay so timestamps differ
      await new Promise(r => setTimeout(r, 5));

      const doc2 = cloneDoc(store.projectDoc);
      doc2.name = 'Second';
      doc2.projectId = 'proj-2';
      await saveProject(doc2);

      const latest = await loadLatestProject();
      expect(latest!.name).toBe('Second');
      expect(latest!.projectId).toBe('proj-2');
    });

    test('load specific project by id', async () => {
      const store = useProjectStore();

      const doc1 = cloneDoc(store.projectDoc);
      doc1.projectId = 'proj-a';
      doc1.name = 'Alpha';
      await saveProject(doc1);

      const doc2 = cloneDoc(store.projectDoc);
      doc2.projectId = 'proj-b';
      doc2.name = 'Beta';
      await saveProject(doc2);

      const loaded = await loadProject('proj-a');
      expect(loaded!.name).toBe('Alpha');
    });

    test('list projects returns all saved projects sorted by date', async () => {
      const store = useProjectStore();

      for (let i = 0; i < 3; i++) {
        const doc = cloneDoc(store.projectDoc);
        doc.projectId = `proj-${i}`;
        doc.name = `Project ${i}`;
        await saveProject(doc);
        await new Promise(r => setTimeout(r, 5));
      }

      const list = await listProjects();
      expect(list).toHaveLength(3);
      // Most recent first
      expect(list[0].projectId).toBe('proj-2');
    });

    test('delete project removes it from storage', async () => {
      const store = useProjectStore();
      const doc = cloneDoc(store.projectDoc);
      doc.projectId = 'proj-del';
      await saveProject(doc);

      expect(await loadProject('proj-del')).not.toBeNull();

      await deleteProject('proj-del');

      expect(await loadProject('proj-del')).toBeNull();
    });
  });

  describe('command history persistence', () => {
    test('save and load command history', async () => {
      const commands = [
        { commandId: 'cmd-1', type: 'resizeOverall', source: 'user-ui' as const, targetRefs: [], payload: { width: 1200 }, inversePayload: { width: 1000 }, beforeRevisionId: 'r1', afterRevisionId: 'r2' },
        { commandId: 'cmd-2', type: 'resizeBay', source: 'user-ui' as const, targetRefs: [], payload: { spanMm: 1000 }, inversePayload: { spanMm: 800 }, beforeRevisionId: 'r2', afterRevisionId: 'r3' },
      ];

      await saveCommands('proj-cmds', commands);

      const loaded = await loadCommands('proj-cmds');
      expect(loaded).toHaveLength(2);
      expect(loaded[0].commandId).toBe('cmd-1');
      expect(loaded[1].commandId).toBe('cmd-2');
    });

    test('load commands for unknown project returns empty array', async () => {
      const loaded = await loadCommands('nonexistent');
      expect(loaded).toEqual([]);
    });

    test('delete commands removes them', async () => {
      await saveCommands('proj-tmp', [{ commandId: 'x', type: 'test', source: 'system' as const, targetRefs: [], payload: {}, inversePayload: {}, beforeRevisionId: 'r0', afterRevisionId: 'r1' }]);
      expect(await loadCommands('proj-tmp')).toHaveLength(1);

      await deleteCommands('proj-tmp');
      expect(await loadCommands('proj-tmp')).toEqual([]);
    });
  });

  describe('snapshot persistence', () => {
    test('save and load snapshot', async () => {
      const store = useProjectStore();
      const dsl = JSON.parse(JSON.stringify(store.resolvedDsl));

      await saveSnapshot('snap-test', 'proj-x', 'rev-1', 'test snapshot', dsl);

      const loaded = await loadSnapshot('snap-test');
      expect(loaded).not.toBeNull();
      expect(loaded!.snapshotId).toBe('snap-test');
      expect(loaded!.label).toBe('test snapshot');
      expect(loaded!.dsl).toBeDefined();
      expect(loaded!.dsl.modules).toHaveLength(dsl.modules.length);
    });

    test('load non-existent snapshot returns null', async () => {
      const loaded = await loadSnapshot('no-such-snap');
      expect(loaded).toBeNull();
    });

    test('list snapshots returns all', async () => {
      const store = useProjectStore();
      const dsl = JSON.parse(JSON.stringify(store.resolvedDsl));

      await saveSnapshot('s1', 'p1', 'r1', 'first', dsl);
      await saveSnapshot('s2', 'p1', 'r2', 'second', dsl);

      const list = await listSnapshots();
      expect(list).toHaveLength(2);
      expect(list.map(s => s.label)).toContain('first');
      expect(list.map(s => s.label)).toContain('second');
    });

    test('clear snapshots removes all', async () => {
      const store = useProjectStore();
      const dsl = JSON.parse(JSON.stringify(store.resolvedDsl));

      await saveSnapshot('cs1', 'p1', 'r1', 'x', dsl);
      await clearSnapshots();

      const list = await listSnapshots();
      expect(list).toHaveLength(0);
    });
  });

  describe('round-trip: save project and restore after refresh', () => {
    test('full project state survives simulated refresh', async () => {
      const bus = createCommandBus();
      const store = useProjectStore();
      const commandStore = useCommandStore();

      // Perform some edits
      bus.execute('resizeOverall', { width: 1500, depth: 800 });
      bus.execute('insertLevel', { shelfCount: 4 });
      bus.execute('toggleBrace', { rearBrace: true });
      await bus.saveSnapshot('pre-refresh');

      // Save the full project state
      await saveProject(store.projectDoc);
      await saveCommands(store.projectDoc.projectId, commandStore.history);

      const savedDoc = cloneDoc(store.projectDoc);
      const savedHistory = [...commandStore.history];

      // Simulate refresh: load a new Pinia instance
      setActivePinia(createPinia());
      const freshStore = useProjectStore();
      const freshCommandStore = useCommandStore();

      // Verify fresh stores are empty/default
      expect(freshCommandStore.history).toHaveLength(0);

      // Restore from persistence
      const loaded = await loadLatestProject();
      expect(loaded).not.toBeNull();
      freshStore.loadProject(loaded!);

      const loadedCmds = await loadCommands(loaded!.projectId);
      for (const cmd of loadedCmds) {
        freshCommandStore.execute(cmd);
      }

      // Verify restored state matches saved state
      expect(freshStore.projectDoc.projectId).toBe(savedDoc.projectId);
      expect(freshStore.projectDoc.name).toBe(savedDoc.name);
      expect(freshStore.resolvedDsl.overallSizeMm.width).toBe(1500);
      expect(freshStore.resolvedDsl.overallSizeMm.depth).toBe(800);
      expect(freshCommandStore.history).toHaveLength(savedHistory.length);
      expect(freshCommandStore.commandCount).toBe(savedHistory.length);
    });
  });
});

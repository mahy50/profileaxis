import { describe, test, expect, beforeEach } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useProjectStore } from '@/stores/projectStore';
import { createCommandBus } from '@/services/commandBus';
import type { ResolvedDsl, CommandEntry } from '@profileaxis/domain';

const COMMAND_COUNT = parseInt(process.env.COUNT ?? '20', 10);

function clone(dsl: ResolvedDsl): ResolvedDsl {
  return JSON.parse(JSON.stringify(dsl));
}

function dslsEqual(a: ResolvedDsl, b: ResolvedDsl): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

describe('CommandBus', () => {
  let bus: ReturnType<typeof createCommandBus>;

  beforeEach(() => {
    setActivePinia(createPinia());
    bus = createCommandBus();
  });

  function getDsl(): ResolvedDsl {
    return useProjectStore().resolvedDsl;
  }

  test('initial state has empty history', () => {
    expect(bus.getHistory()).toHaveLength(0);
    expect(bus.getCursor()).toBe(0);
  });

  test(`executes ${COMMAND_COUNT} commands and maintains history consistency`, () => {
    const dslBefore = clone(getDsl());
    const entries: CommandEntry[] = [];

    // Build a varied command sequence by cycling through command types
    for (let i = 0; i < COMMAND_COUNT; i++) {
      const mod = i % 6;
      let entry: CommandEntry | undefined;
      const seq = String(i).padStart(2, '0');

      switch (mod) {
        case 0:
          entry = bus.execute('setOverallSize', { width: 1200 + i * 10 });
          break;
        case 1:
          entry = bus.execute('setModuleSpan', { moduleId: 'bay-1', spanMm: 1200 + i * 10 });
          break;
        case 2:
          entry = bus.execute('addModule', {
            moduleId: `bay-${seq}`,
            kind: 'rect-bay',
            spanMm: 800 + i * 5,
          });
          break;
        case 3:
          entry = bus.execute('setNodes', {
            nodes: [
              {
                nodeId: `node-${seq}`,
                kind: 'member' as const,
                role: 'upright' as const,
                semanticPath: '/bay-1/left-upright',
                axis: 'z' as const,
                start: { x: 0, y: 0, z: 0 },
                end: { x: 0, y: 2000, z: 0 },
                lengthMm: 2000,
                profileSpecKey: 'U50-30x30',
                provenance: { source: 'user' as const, ruleIds: [] },
                finishKey: null,
                tags: [],
              },
            ],
          });
          break;
        case 4:
          entry = bus.execute('setJoints', {
            joints: [
              {
                jointId: `joint-${seq}`,
                topology: 'corner-3way' as const,
                semanticPath: '/bay-1/corner-0',
                position: { x: 0, y: 0, z: 0 },
                memberIds: [],
                connectorSpecKey: 'conn-corner-standard',
                connectorFamilyKey: 'corner',
              },
            ],
          });
          break;
        case 5: {
          // Remove a module (skip when we only have bay-1)
          const dsl = getDsl();
          const modToRemove = dsl.modules.find(m => m.moduleId !== 'bay-1');
          if (modToRemove) {
            entry = bus.execute('removeModule', { moduleId: modToRemove.moduleId });
          } else {
            entry = bus.execute('setOverallSize', { depth: 600 + i * 10 });
          }
          break;
        }
      }

      if (entry) entries.push(entry);
    }

    // Verify history length
    const actualCount = entries.length;
    expect(bus.getHistory()).toHaveLength(actualCount);
    expect(bus.getCursor()).toBe(actualCount);

    const dslAfter = clone(getDsl());

    // Undo ALL commands
    for (let i = 0; i < actualCount; i++) {
      bus.undo();
    }

    // After undoing all, should match original state
    expect(bus.getCursor()).toBe(0);
    expect(dslsEqual(getDsl(), dslBefore)).toBe(true);

    // Redo ALL commands
    for (let i = 0; i < actualCount; i++) {
      bus.redo();
    }

    // After redoing all, should match final state
    expect(bus.getCursor()).toBe(actualCount);
    expect(dslsEqual(getDsl(), dslAfter)).toBe(true);
  });

  test('snapshot save and restore produces identical state', () => {
    // Save initial snapshot
    const snapMeta = bus.saveSnapshot('initial');
    const dslBefore = clone(getDsl());

    // Execute a few commands
    bus.execute('setOverallSize', { width: 1500 });
    bus.execute('setModuleSpan', { moduleId: 'bay-1', spanMm: 1500 });
    bus.execute('addModule', { moduleId: 'bay-2', kind: 'rect-bay', spanMm: 800 });

    // State should be different
    expect(dslsEqual(getDsl(), dslBefore)).toBe(false);

    // Restore snapshot
    const restored = bus.restoreSnapshot(snapMeta.snapshotId);
    expect(restored).toBe(true);

    // After restore, state should match original
    expect(dslsEqual(getDsl(), dslBefore)).toBe(true);

    // Snapshot DSL should also match
    const snapDsl = bus.getSnapshotDsl(snapMeta.snapshotId);
    expect(snapDsl).not.toBeNull();
    expect(dslsEqual(snapDsl!, dslBefore)).toBe(true);
  });

  test('snapshot list returns all saved snapshots', () => {
    bus.saveSnapshot('first');
    bus.saveSnapshot('second');
    bus.saveSnapshot('third');

    const list = bus.listSnapshots();
    expect(list).toHaveLength(3);
    expect(list[0].label).toBe('first');
    expect(list[1].label).toBe('second');
    expect(list[2].label).toBe('third');
  });
});

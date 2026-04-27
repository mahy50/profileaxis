import { describe, test, expect, beforeEach } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useProjectStore } from '@/stores/projectStore';
import { createCommandBus } from '@/services/commandBus';
import type { ResolvedDsl } from '@profileaxis/domain';

function clone(dsl: ResolvedDsl): ResolvedDsl {
  return JSON.parse(JSON.stringify(dsl));
}

describe('DebugDiff', () => {
  test('trace undo mismatch', () => {
    setActivePinia(createPinia());
    const bus = createCommandBus();
    const store = useProjectStore();

    const dslBefore = clone(store.resolvedDsl);
    console.log('INITIAL nodes:', dslBefore.nodes.length);
    console.log('INITIAL joints:', dslBefore.joints.length);
    console.log('INITIAL modules:', dslBefore.modules.length);
    console.log('INITIAL shelfCount (from beams):', dslBefore.nodes.filter((n: any) => n.semanticPath?.startsWith('beam/front/')).length);

    // Run a few commands
    const cmds: string[] = [];
    for (let i = 0; i < 10; i++) {
      const mod = i % 6;
      if (mod === 0) {
        bus.execute('resizeOverall', { width: 1200 + i * 10 });
        cmds.push('resizeOverall');
      } else if (mod === 1) {
        bus.execute('resizeBay', { moduleId: 'bay-1', spanMm: 1200 + i * 10 });
        cmds.push('resizeBay');
      } else if (mod === 2) {
        bus.execute('insertBay', { moduleId: `bay-test${i}`, kind: 'rect-bay', spanMm: 800 + i * 5 });
        cmds.push('insertBay');
      } else if (mod === 3) {
        bus.execute('insertLevel', {});
        cmds.push('insertLevel');
      } else if (mod === 4) {
        bus.execute('toggleBrace', {});
        cmds.push('toggleBrace');
      } else {
        const dsl = store.resolvedDsl;
        const modToRemove = dsl.modules.find((m: any) => m.moduleId !== 'bay-1');
        if (modToRemove) {
          bus.execute('removeBay', { moduleId: modToRemove.moduleId });
          cmds.push('removeBay');
        } else {
          bus.execute('resizeOverall', { depth: 600 + i * 10 });
          cmds.push('resizeOverall-fallback');
        }
      }
    }

    console.log('\nCommands executed:', cmds);
    console.log('Cursor after exec:', bus.getCursor());

    // Undo all
    for (let i = 0; i < cmds.length; i++) {
      bus.undo();
    }

    const dslAfter = clone(store.resolvedDsl);
    console.log('\nAFTER UNDO ALL:');
    console.log('nodes:', dslAfter.nodes.length);
    console.log('joints:', dslAfter.joints.length);
    console.log('modules:', dslAfter.modules.length);
    console.log('overallSizeMm:', JSON.stringify(dslAfter.overallSizeMm));
    console.log('bef nodes:', dslBefore.nodes.length);
    console.log('bef joints:', dslBefore.joints.length);
    console.log('bef overallSizeMm:', JSON.stringify(dslBefore.overallSizeMm));

    // Compare key fields
    console.log('\nDIFFS:');
    if (JSON.stringify(dslAfter.overallSizeMm) !== JSON.stringify(dslBefore.overallSizeMm)) {
      console.log('  overallSizeMm differs');
    }
    if (dslAfter.nodes.length !== dslBefore.nodes.length) {
      console.log('  node count differs:', dslBefore.nodes.length, 'vs', dslAfter.nodes.length);
    }
    if (dslAfter.joints.length !== dslBefore.joints.length) {
      console.log('  joint count differs:', dslBefore.joints.length, 'vs', dslAfter.joints.length);
    }
    if (JSON.stringify(dslAfter.modules) !== JSON.stringify(dslBefore.modules)) {
      console.log('  modules differ');
      console.log('  before:', JSON.stringify(dslBefore.modules));
      console.log('  after:', JSON.stringify(dslAfter.modules));
    }
    // Full diff
    const fullMatch = JSON.stringify(dslAfter) === JSON.stringify(dslBefore);
    console.log('  full match:', fullMatch);
    if (!fullMatch) {
      for (const key of Object.keys(dslBefore) as (keyof ResolvedDsl)[]) {
        if (JSON.stringify(dslBefore[key]) !== JSON.stringify(dslAfter[key])) {
          console.log(`  Key "${key}" differs`);
          // Detailed node diff
          if (key === 'nodes') {
            const bn = dslBefore.nodes;
            const an = dslAfter.nodes;
            for (let i = 0; i < Math.max(bn.length, an.length); i++) {
              if (i >= bn.length) { console.log(`  node[${i}] missing in before`); continue; }
              if (i >= an.length) { console.log(`  node[${i}] missing in after`); continue; }
              if (JSON.stringify(bn[i]) !== JSON.stringify(an[i])) {
                console.log(`  node[${i}] differs:`);
                for (const nk of Object.keys(bn[i]) as (keyof typeof bn[0])[]) {
                  if (JSON.stringify(bn[i][nk]) !== JSON.stringify(an[i][nk])) {
                    console.log(`    ${nk}: before=${JSON.stringify(bn[i][nk])} after=${JSON.stringify(an[i][nk])}`);
                  }
                }
              }
            }
          }
          if (key === 'joints') {
            const bj = dslBefore.joints;
            const aj = dslAfter.joints;
            for (let i = 0; i < Math.max(bj.length, aj.length); i++) {
              if (i >= bj.length) { console.log(`  joint[${i}] missing in before`); continue; }
              if (i >= aj.length) { console.log(`  joint[${i}] missing in after`); continue; }
              if (JSON.stringify(bj[i]) !== JSON.stringify(aj[i])) {
                console.log(`  joint[${i}] differs:`);
                for (const nk of Object.keys(bj[i]) as (keyof typeof bj[0])[]) {
                  if (JSON.stringify(bj[i][nk]) !== JSON.stringify(aj[i][nk])) {
                    console.log(`    ${nk}: before=${JSON.stringify(bj[i][nk])} after=${JSON.stringify(aj[i][nk])}`);
                  }
                }
              }
            }
          }
        }
      }
    }

    expect(fullMatch).toBe(true);
  });
});

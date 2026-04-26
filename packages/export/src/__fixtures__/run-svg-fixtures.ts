// @profileaxis/export/__fixtures__ - SVG fixture test runner
// Run with: node dist/__fixtures__/run-svg-fixtures.js
// Gate P0-009 automatic check

import { generateThreeViewSvg } from '../svg/index.js';
import {
  simple2BayResolvedFixture,
  singleBayResolvedFixture,
  simple2BayDimVm,
  singleBayDimVm,
  simple2BayExpectedDimensions,
} from './fixtures.js';

let passed = 0;
let failed = 0;

function assert(condition: boolean, message: string) {
  if (condition) {
    console.log(`  ✅ ${message}`);
    passed++;
  } else {
    console.log(`  ❌ ${message}`);
    failed++;
  }
}

function assertContains(str: string, substr: string, message: string) {
  assert(str.includes(substr), `${message}: expected "${substr}" in SVG`);
}

function assertNotContains(str: string, substr: string, message: string) {
  assert(!str.includes(substr), `${message}: expected NOT "${substr}" in SVG`);
}

// ── Test 1: Simple 2-bay rack ─────────────────────────────────────────────────

console.log('\n--- Test: Simple 2-bay rack ---');

const { front: f1, right: r1, top: t1 } = generateThreeViewSvg(simple2BayResolvedFixture, simple2BayDimVm);

assert(f1.length > 500, 'front SVG has content');
assert(r1.length > 500, 'right SVG has content');
assert(t1.length > 500, 'top SVG has content');

// Check overall dimensions are annotated
assertContains(f1, '3000 mm', 'front SVG annotates overall width');
assertContains(f1, '2000 mm', 'front SVG annotates overall height');
assertContains(r1, '1000 mm', 'right SVG annotates overall depth');
assertContains(t1, '3000 mm', 'top SVG annotates overall width');
assertContains(t1, '1000 mm', 'top SVG annotates overall depth');

// Check SVG has proper viewBox and dimensions
assertContains(f1, 'viewBox', 'front SVG has viewBox');
assertContains(f1, 'Front View', 'front SVG has title');
assertContains(r1, 'Right View', 'right SVG has title');
assertContains(t1, 'Top View', 'top SVG has title');

// Check bay divisions are present
assertContains(f1, 'line', 'front SVG has line elements for bay divisions');

// ── Test 2: Single-bay rack ───────────────────────────────────────────────────

console.log('\n--- Test: Single-bay rack ---');

const { front: f2, right: r2, top: t2 } = generateThreeViewSvg(singleBayResolvedFixture, singleBayDimVm);

assert(f2.length > 500, 'front SVG has content for single-bay');
assert(r2.length > 500, 'right SVG has content for single-bay');
assert(t2.length > 500, 'top SVG has content for single-bay');

assertContains(f2, '1500 mm', 'front SVG annotates width for single-bay');
assertContains(f2, '1800 mm', 'front SVG annotates height for single-bay');

// No DTD / no external entities (SVG security)
assertNotContains(f1, '<!DOCTYPE', 'SVG has no DOCTYPE');
assertNotContains(f2, '<!DOCTYPE', 'SVG has no DOCTYPE');

// SVG namespace is present
assertContains(f1, 'xmlns="http://www.w3.org/2000/svg"', 'front SVG has proper namespace');
assertContains(f2, 'xmlns="http://www.w3.org/2000/svg"', 'right SVG has proper namespace');

// ── Test 3: Dimension correctness ─────────────────────────────────────────────

console.log('\n--- Test: Dimension annotation correctness ---');

for (const expected of simple2BayExpectedDimensions) {
  const found = f1.includes(`${expected.valueMm} mm`) ||
                r1.includes(`${expected.valueMm} mm`) ||
                t1.includes(`${expected.valueMm} mm`);
  assert(found, `dimension ${expected.label} (${expected.valueMm} mm) is annotated in one of the views`);
}

// ── Summary ──────────────────────────────────────────────────────────────────

console.log(`\n${'─'.repeat(40)}`);
console.log(`Passed: ${passed}, Failed: ${failed}`);

if (failed > 0) {
  console.error('\n❌ Some tests failed!');
  process.exit(1);
} else {
  console.log('\n✅ All SVG fixture tests passed!');
  process.exit(0);
}
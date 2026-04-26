// basic.test.ts — smoke test for @profileaxis/modeler
// Run: npx tsx test/basic.test.ts

import { buildSceneViewModel } from '../src/index.js';
import type { ResolvedDsl, StructuralNode, JointNode } from '@profileaxis/domain';
import { CATALOG_FIXTURE } from '@profileaxis/stdlib';
import type { CatalogBundle, SceneViewModel, BoxGeometry, CylinderGeometry } from '../src/index.js';

// Cast stdlib fixture to CatalogBundle (compatible at runtime)
const catalog = CATALOG_FIXTURE as unknown as CatalogBundle;

const sampleResolvedDsl: ResolvedDsl = {
  dslVersion: '1.0.0',
  projectType: 'storage_rack',
  sourceRevisionId: 'test-001',
  overallSizeMm: { width: 2700, depth: 900, height: 2000 },
  modules: [{ moduleId: 'bay[0]', kind: 'rect-bay', spanMm: 2700 }],
  nodes: [
    {
      nodeId: 'upright-0',
      kind: 'member',
      role: 'upright',
      semanticPath: 'rack.bay[0].level[0].upright[0]',
      axis: 'z',
      start: { x: 0, y: 0, z: 0 },
      end: { x: 0, y: 0, z: 2000 },
      lengthMm: 2000,
      profileSpecKey: 'PA-UC90-70-2.5',
      provenance: { source: 'user', ruleIds: [] },
      finishKey: null,
      tags: [],
    },
    {
      nodeId: 'beam-0',
      kind: 'member',
      role: 'beamX',
      semanticPath: 'rack.bay[0].level[0].beamX[0]',
      axis: 'x',
      start: { x: 0, y: 0, z: 500 },
      end: { x: 2700, y: 0, z: 500 },
      lengthMm: 2700,
      profileSpecKey: 'PB-SB60-40-2.0',
      provenance: { source: 'user', ruleIds: [] },
      finishKey: null,
      tags: [],
    },
  ],
  joints: [
    {
      jointId: 'joint-0',
      topology: 'corner-3way',
      semanticPath: 'rack.bay[0].level[0].upright[0]',
      position: { x: 0, y: 0, z: 500 },
      memberIds: ['upright-0', 'beam-0'],
      connectorSpecKey: 'JC3-CORNER',
      connectorFamilyKey: 'corner-3way',
    },
  ],
};

// ── Tests ─────────────────────────────────────────────────────────────────────

let result: SceneViewModel;

try {
  result = buildSceneViewModel(sampleResolvedDsl, catalog);
  console.log('✓ buildSceneViewModel returned without error');
} catch (err) {
  console.error('✗ buildSceneViewModel threw:', err);
  process.exit(1);
}

// SceneViewModel is a plain object (no Babylon dependency)
const isPlainObject = (v: unknown): boolean =>
  v !== null && typeof v === 'object' && !Array.isArray(v) && !(v instanceof Date);

if (!isPlainObject(result)) {
  console.error('✗ SceneViewModel is not a plain object:', result);
  process.exit(1);
}
console.log('✓ SceneViewModel is a plain data object (no class instance)');

// geometryPrimitives is an array
if (!Array.isArray(result.geometryPrimitives)) {
  console.error('✗ geometryPrimitives is not an array');
  process.exit(1);
}
console.log(`✓ geometryPrimitives is an array (length: ${result.geometryPrimitives.length})`);

// First geometry is a box for the upright
const box = result.geometryPrimitives.find(p => p.kind === 'box') as BoxGeometry | undefined;
if (!box) {
  console.error('✗ No box geometry found');
  process.exit(1);
}
if (box.id !== 'upright-0') {
  console.error(`✗ Box id mismatch: expected "upright-0", got "${box.id}"`);
  process.exit(1);
}
console.log(`✓ BoxGeometry id matches nodeId: "${box.id}"`);

// First geometry is a cylinder for the joint
const cylinder = result.geometryPrimitives.find(p => p.kind === 'cylinder') as CylinderGeometry | undefined;
if (!cylinder) {
  console.error('✗ No cylinder geometry found for joint');
  process.exit(1);
}
if (cylinder.id !== 'joint-0') {
  console.error(`✗ Cylinder id mismatch: expected "joint-0", got "${cylinder.id}"`);
  process.exit(1);
}
console.log(`✓ CylinderGeometry id matches jointId: "${cylinder.id}"`);

// dimensionAnnotations are present
if (!Array.isArray(result.dimensionAnnotations)) {
  console.error('✗ dimensionAnnotations is not an array');
  process.exit(1);
}
console.log(`✓ dimensionAnnotations is an array (length: ${result.dimensionAnnotations.length})`);

// moduleViews is an array
if (!Array.isArray(result.moduleViews)) {
  console.error('✗ moduleViews is not an array');
  process.exit(1);
}
console.log(`✓ moduleViews is an array (length: ${result.moduleViews.length})`);

// includeDimensionAnnotations: false works
const noDimsResult = buildSceneViewModel(sampleResolvedDsl, catalog, { includeDimensionAnnotations: false });
if (noDimsResult.dimensionAnnotations.length !== 0) {
  console.error('✗ includeDimensionAnnotations: false did not suppress annotations');
  process.exit(1);
}
console.log('✓ includeDimensionAnnotations: false works');

console.log('\n✅ All checks passed');

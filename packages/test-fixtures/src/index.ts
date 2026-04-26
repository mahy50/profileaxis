// @profileaxis/test-fixtures - golden cases, catalog fixture, resolved fixture, bom fixture
// Must NOT be a runtime dependency of any business package

import type { IntentDsl, ResolvedDsl, DraftDsl } from '@profileaxis/schemas';
import type { ProjectDocument } from '@profileaxis/domain';
import { CATALOG_FIXTURE } from '@profileaxis/stdlib';

// Golden intent DSL fixtures
export const GOLDEN_INTENT_FIXTURES: IntentDsl[] = [
  {
    dslVersion: '1.0.0',
    projectType: 'storage_rack',
    space: {
      widthMm: 2700,
      depthMm: 900,
      heightMm: 2000,
      placement: 'floor',
    },
    capacity: {
      shelfCount: 3,
      loadTier: 'medium',
    },
    preferences: {
      profileSeries: 'U50',
      rearBrace: true,
      caster: false,
    },
    constraints: {
      againstWall: true,
      maxWidthMm: 3000,
    },
    ambiguities: [],
  },
  {
    dslVersion: '1.0.0',
    projectType: 'storage_rack',
    space: {
      widthMm: 3600,
      depthMm: 1100,
      heightMm: 2400,
      placement: 'floor',
    },
    capacity: {
      shelfCount: 4,
      loadTier: 'heavy',
    },
    preferences: {
      profileSeries: 'U60',
      rearBrace: true,
      caster: true,
    },
    constraints: {
      againstWall: false,
      maxWidthMm: null,
    },
    ambiguities: [
      {
        key: 'floor-mount',
        question: 'Should uprights be floor-mounted or using feet?',
        status: 'open',
      },
    ],
  },
];

// Golden resolved DSL fixtures (source of truth for tests)
export const GOLDEN_RESOLVED_FIXTURES: ResolvedDsl[] = [
  {
    dslVersion: '1.0.0',
    projectType: 'storage_rack',
    sourceRevisionId: 'golden-001',
    overallSizeMm: { width: 2700, depth: 900, height: 2000 },
    modules: [{ moduleId: 'module-0', kind: 'rect-bay', spanMm: 2700 }],
    nodes: [],
    joints: [],
  },
];

// Catalog fixture (re-export from stdlib for test convenience)
export { CATALOG_FIXTURE };

// Project document fixture
export function createProjectDocumentFixture(): ProjectDocument {
  return {
    schemaVersion: '1.0.0',
    projectId: 'proj-test-001',
    name: 'Test Project',
    locale: 'zh-CN',
    unitSystem: 'mm',
    stdlibVersion: '1.0.0-m1',
    ruleVersion: '1.0.0-m1',
    catalogVersion: '1.0.0-m1',
    resolvedDsl: GOLDEN_RESOLVED_FIXTURES[0],
    structuralNodes: [],
    jointNodes: [],
    currentRevisionId: 'rev-001',
    commandCursor: 0,
    snapshotIds: [],
    intentDsl: GOLDEN_INTENT_FIXTURES[0],
    confirmationDsl: null,
    draftDsl: null,
    uiState: {},
  };
}

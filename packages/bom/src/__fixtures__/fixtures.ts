// @profileaxis/bom/fixtures — Golden test cases

import type { ResolvedDsl } from '@profileaxis/domain';
import type { DesignBomItem, TradeBomItem, MappingStatus } from '../types.js';

// ── Fixture 1: Simple 2-bay rack ─────────────────────────────────────────────
// Minimal case: 4 uprights + 2 beams + 4 joints

export const fixture1ResolvedDsl: ResolvedDsl = {
  dslVersion: '1.0.0',
  projectType: 'storage_rack',
  sourceRevisionId: 'rev-001',
  overallSizeMm: { width: 2400, depth: 900, height: 2000 },
  modules: [{ moduleId: 'mod-1', kind: 'rect-bay', spanMm: 2400 }],
  nodes: [
    {
      nodeId: 'n1', kind: 'member', role: 'upright',
      semanticPath: '/bay-1/col-1/upright',
      axis: 'z', start: { x: 0, y: 0, z: 0 }, end: { x: 0, y: 0, z: 2000 },
      lengthMm: 2000, profileSpecKey: 'PA-UC90-70-2.5',
      provenance: { source: 'ai', ruleIds: [] }, finishKey: null, tags: [],
    },
    {
      nodeId: 'n2', kind: 'member', role: 'upright',
      semanticPath: '/bay-1/col-2/upright',
      axis: 'z', start: { x: 2400, y: 0, z: 0 }, end: { x: 2400, y: 0, z: 2000 },
      lengthMm: 2000, profileSpecKey: 'PA-UC90-70-2.5',
      provenance: { source: 'ai', ruleIds: [] }, finishKey: null, tags: [],
    },
    {
      nodeId: 'n3', kind: 'member', role: 'beamX',
      semanticPath: '/bay-1/row-1/beamX',
      axis: 'x', start: { x: 0, y: 0, z: 1800 }, end: { x: 2400, y: 0, z: 1800 },
      lengthMm: 2400, profileSpecKey: 'PB-SB60-40-2.0',
      provenance: { source: 'ai', ruleIds: [] }, finishKey: null, tags: [],
    },
    {
      nodeId: 'n4', kind: 'member', role: 'beamX',
      semanticPath: '/bay-1/row-2/beamX',
      axis: 'x', start: { x: 0, y: 0, z: 900 }, end: { x: 2400, y: 0, z: 900 },
      lengthMm: 2400, profileSpecKey: 'PB-SB60-40-2.0',
      provenance: { source: 'ai', ruleIds: [] }, finishKey: null, tags: [],
    },
  ],
  joints: [
    {
      jointId: 'j1', topology: 'corner-3way', semanticPath: '/bay-1/col-1/top',
      position: { x: 0, y: 0, z: 2000 },
      memberIds: ['n1'], connectorSpecKey: 'JC3-CORNER', connectorFamilyKey: 'corner',
    },
    {
      jointId: 'j2', topology: 'corner-3way', semanticPath: '/bay-1/col-2/top',
      position: { x: 2400, y: 0, z: 2000 },
      memberIds: ['n2'], connectorSpecKey: 'JC3-CORNER', connectorFamilyKey: 'corner',
    },
    {
      jointId: 'j3', topology: 'tee-3way', semanticPath: '/bay-1/col-1/mid',
      position: { x: 0, y: 0, z: 1800 },
      memberIds: ['n1', 'n3'], connectorSpecKey: 'JC3-TEE', connectorFamilyKey: 'tee',
    },
    {
      jointId: 'j4', topology: 'tee-3way', semanticPath: '/bay-1/col-2/mid',
      position: { x: 2400, y: 0, z: 1800 },
      memberIds: ['n2', 'n4'], connectorSpecKey: 'JC3-TEE', connectorFamilyKey: 'tee',
    },
  ],
};

export const fixture1DesignBom: DesignBomItem[] = [
  {
    id: 'design-struct-1',
    kind: 'structural',
    role: 'upright',
    profileSpecKey: 'PA-UC90-70-2.5',
    connectorSpecKey: undefined,
    lengthMm: 4000, // 2 × 2000mm
    quantity: 2,
    mappingStatus: 'mapped',
    nodeIds: ['n1', 'n2'],
  },
  {
    id: 'design-struct-2',
    kind: 'structural',
    role: 'beamX',
    profileSpecKey: 'PB-SB60-40-2.0',
    connectorSpecKey: undefined,
    lengthMm: 4800, // 2 × 2400mm
    quantity: 2,
    mappingStatus: 'mapped',
    nodeIds: ['n3', 'n4'],
  },
  {
    id: 'design-joint-1',
    kind: 'joint',
    role: 'corner-3way',
    profileSpecKey: undefined,
    connectorSpecKey: 'JC3-CORNER',
    lengthMm: null,
    quantity: 2,
    mappingStatus: 'mapped',
    nodeIds: ['j1', 'j2'],
  },
  {
    id: 'design-joint-2',
    kind: 'joint',
    role: 'tee-3way',
    profileSpecKey: undefined,
    connectorSpecKey: 'JC3-TEE',
    lengthMm: null,
    quantity: 2,
    mappingStatus: 'mapped',
    nodeIds: ['j3', 'j4'],
  },
];

export const fixture1TradeBom: TradeBomItem[] = [
  {
    sku: 'SSW-UC90-70-2.5-6000',
    supplierId: 'SUP-SSW-001',
    quantity: 2,
    unitPrice: 218,
    leadTimeDays: 14,
    totalCost: 436,
    mappingStatus: 'mapped',
    designBomItemIds: ['n1', 'n2'],
  },
  {
    sku: 'SSW-SB60-40-2.0-2700',
    supplierId: 'SUP-SSW-001',
    quantity: 2,
    unitPrice: 87.5,
    leadTimeDays: 14,
    totalCost: 175,
    mappingStatus: 'mapped',
    designBomItemIds: ['n3', 'n4'],
  },
  {
    sku: 'SSW-UC90-70-2.5-6000',
    supplierId: 'SUP-SSW-001',
    quantity: 2,
    unitPrice: 218,
    leadTimeDays: 14,
    totalCost: 436,
    mappingStatus: 'mapped',
    designBomItemIds: ['j1', 'j2'],
  },
  {
    sku: 'SSW-SB60-40-2.0-2700',
    supplierId: 'SUP-SSW-001',
    quantity: 2,
    unitPrice: 87.5,
    leadTimeDays: 14,
    totalCost: 175,
    mappingStatus: 'mapped',
    designBomItemIds: ['j3', 'j4'],
  },
];

// ── Fixture 2: Unmapped profile ───────────────────────────────────────────────
// A node with a profileSpecKey that has no SKU mapping → unmapped status

export const fixture2ResolvedDsl: ResolvedDsl = {
  dslVersion: '1.0.0',
  projectType: 'storage_rack',
  sourceRevisionId: 'rev-002',
  overallSizeMm: { width: 1800, depth: 600, height: 1500 },
  modules: [{ moduleId: 'mod-1', kind: 'rect-bay', spanMm: 1800 }],
  nodes: [
    {
      nodeId: 'n1', kind: 'member', role: 'upright',
      semanticPath: '/bay-1/col-1/upright',
      axis: 'z', start: { x: 0, y: 0, z: 0 }, end: { x: 0, y: 0, z: 1500 },
      lengthMm: 1500, profileSpecKey: 'PA-UC90-70-2.5',
      provenance: { source: 'ai', ruleIds: [] }, finishKey: null, tags: [],
    },
    {
      nodeId: 'n2', kind: 'member', role: 'upright',
      semanticPath: '/bay-1/col-2/upright',
      axis: 'z', start: { x: 1800, y: 0, z: 0 }, end: { x: 1800, y: 0, z: 1500 },
      lengthMm: 1500, profileSpecKey: 'PA-UC90-70-2.5',
      provenance: { source: 'ai', ruleIds: [] }, finishKey: null, tags: [],
    },
    {
      nodeId: 'n3', kind: 'member', role: 'beamX',
      semanticPath: '/bay-1/row-1/beamX',
      axis: 'x', start: { x: 0, y: 0, z: 1350 }, end: { x: 1800, y: 0, z: 1350 },
      lengthMm: 1800, profileSpecKey: 'PA-CUSTOM-UNKNOWN', // ← no SKU mapping
      provenance: { source: 'ai', ruleIds: [] }, finishKey: null, tags: [],
    },
  ],
  joints: [
    {
      jointId: 'j1', topology: 'corner-3way', semanticPath: '/bay-1/col-1/top',
      position: { x: 0, y: 0, z: 1500 },
      memberIds: ['n1'], connectorSpecKey: 'JC3-CORNER', connectorFamilyKey: 'corner',
    },
    {
      jointId: 'j2', topology: 'corner-3way', semanticPath: '/bay-1/col-2/top',
      position: { x: 1800, y: 0, z: 1500 },
      memberIds: ['n2'], connectorSpecKey: 'JC3-CORNER', connectorFamilyKey: 'corner',
    },
  ],
};

export const fixture2Expected = {
  designBomCount: 3,
  tradeBomCount: 3,
  unmappedCount: 1, // PA-CUSTOM-UNKNOWN
  designCoverage: (2 / 3) * 100, // 2 mapped / 3 total
};

// ── Fixture 3: Multi-bay with braces ─────────────────────────────────────────
// Larger project with mixed topology

export const fixture3ResolvedDsl: ResolvedDsl = {
  dslVersion: '1.0.0',
  projectType: 'storage_rack',
  sourceRevisionId: 'rev-003',
  overallSizeMm: { width: 4800, depth: 900, height: 2000 },
  modules: [
    { moduleId: 'mod-1', kind: 'rect-bay', spanMm: 2400 },
    { moduleId: 'mod-2', kind: 'rect-bay', spanMm: 2400 },
  ],
  nodes: [
    // Bay 1 uprights
    {
      nodeId: 'n1', kind: 'member', role: 'upright',
      semanticPath: '/bay-1/col-1/upright',
      axis: 'z', start: { x: 0, y: 0, z: 0 }, end: { x: 0, y: 0, z: 2000 },
      lengthMm: 2000, profileSpecKey: 'PA-UC90-70-2.5',
      provenance: { source: 'ai', ruleIds: [] }, finishKey: null, tags: [],
    },
    {
      nodeId: 'n2', kind: 'member', role: 'upright',
      semanticPath: '/bay-1/col-2/upright',
      axis: 'z', start: { x: 2400, y: 0, z: 0 }, end: { x: 2400, y: 0, z: 2000 },
      lengthMm: 2000, profileSpecKey: 'PA-UC90-70-2.5',
      provenance: { source: 'ai', ruleIds: [] }, finishKey: null, tags: [],
    },
    // Bay 1 beams
    {
      nodeId: 'n3', kind: 'member', role: 'beamX',
      semanticPath: '/bay-1/row-1/beamX',
      axis: 'x', start: { x: 0, y: 0, z: 1800 }, end: { x: 2400, y: 0, z: 1800 },
      lengthMm: 2400, profileSpecKey: 'PB-SB60-40-2.0',
      provenance: { source: 'ai', ruleIds: [] }, finishKey: null, tags: [],
    },
    {
      nodeId: 'n4', kind: 'member', role: 'beamX',
      semanticPath: '/bay-1/row-2/beamX',
      axis: 'x', start: { x: 0, y: 0, z: 900 }, end: { x: 2400, y: 0, z: 900 },
      lengthMm: 2400, profileSpecKey: 'PB-SB60-40-2.0',
      provenance: { source: 'ai', ruleIds: [] }, finishKey: null, tags: [],
    },
    // Bay 2 uprights
    {
      nodeId: 'n5', kind: 'member', role: 'upright',
      semanticPath: '/bay-2/col-1/upright',
      axis: 'z', start: { x: 2400, y: 0, z: 0 }, end: { x: 2400, y: 0, z: 2000 },
      lengthMm: 2000, profileSpecKey: 'PA-UC90-70-2.5',
      provenance: { source: 'ai', ruleIds: [] }, finishKey: null, tags: [],
    },
    {
      nodeId: 'n6', kind: 'member', role: 'upright',
      semanticPath: '/bay-2/col-2/upright',
      axis: 'z', start: { x: 4800, y: 0, z: 0 }, end: { x: 4800, y: 0, z: 2000 },
      lengthMm: 2000, profileSpecKey: 'PA-UC90-70-2.5',
      provenance: { source: 'ai', ruleIds: [] }, finishKey: null, tags: [],
    },
    // Bay 2 beams
    {
      nodeId: 'n7', kind: 'member', role: 'beamX',
      semanticPath: '/bay-2/row-1/beamX',
      axis: 'x', start: { x: 2400, y: 0, z: 1800 }, end: { x: 4800, y: 0, z: 1800 },
      lengthMm: 2400, profileSpecKey: 'PB-SB60-40-2.0',
      provenance: { source: 'ai', ruleIds: [] }, finishKey: null, tags: [],
    },
    {
      nodeId: 'n8', kind: 'member', role: 'beamX',
      semanticPath: '/bay-2/row-2/beamX',
      axis: 'x', start: { x: 2400, y: 0, z: 900 }, end: { x: 4800, y: 0, z: 900 },
      lengthMm: 2400, profileSpecKey: 'PB-SB60-40-2.0',
      provenance: { source: 'ai', ruleIds: [] }, finishKey: null, tags: [],
    },
    // Brace
    {
      nodeId: 'n9', kind: 'member', role: 'brace',
      semanticPath: '/bay-1/brace-1',
      axis: 'x', start: { x: 0, y: 0, z: 900 }, end: { x: 2400, y: 0, z: 1800 },
      lengthMm: 2694, profileSpecKey: 'PC-AI50-50-3',
      provenance: { source: 'ai', ruleIds: [] }, finishKey: null, tags: [],
    },
  ],
  joints: [
    // Bay 1
    { jointId: 'j1', topology: 'corner-3way', semanticPath: '/bay-1/col-1/top', position: { x: 0, y: 0, z: 2000 }, memberIds: ['n1'], connectorSpecKey: 'JC3-CORNER', connectorFamilyKey: 'corner' },
    { jointId: 'j2', topology: 'corner-3way', semanticPath: '/bay-1/col-2/top', position: { x: 2400, y: 0, z: 2000 }, memberIds: ['n2'], connectorSpecKey: 'JC3-CORNER', connectorFamilyKey: 'corner' },
    { jointId: 'j3', topology: 'tee-3way',    semanticPath: '/bay-1/col-1/mid', position: { x: 0, y: 0, z: 1800 }, memberIds: ['n1', 'n3'], connectorSpecKey: 'JC3-TEE', connectorFamilyKey: 'tee' },
    { jointId: 'j4', topology: 'tee-3way',    semanticPath: '/bay-1/col-2/mid', position: { x: 2400, y: 0, z: 1800 }, memberIds: ['n2', 'n4'], connectorSpecKey: 'JC3-TEE', connectorFamilyKey: 'tee' },
    { jointId: 'j5', topology: 'brace-end',    semanticPath: '/bay-1/brace-end-1', position: { x: 0, y: 0, z: 900 }, memberIds: ['n1', 'n4'], connectorSpecKey: 'JC3-BRACE-END', connectorFamilyKey: 'brace-end' },
    // Bay 2
    { jointId: 'j6', topology: 'corner-3way', semanticPath: '/bay-2/col-1/top', position: { x: 2400, y: 0, z: 2000 }, memberIds: ['n5'], connectorSpecKey: 'JC3-CORNER', connectorFamilyKey: 'corner' },
    { jointId: 'j7', topology: 'corner-3way', semanticPath: '/bay-2/col-2/top', position: { x: 4800, y: 0, z: 2000 }, memberIds: ['n6'], connectorSpecKey: 'JC3-CORNER', connectorFamilyKey: 'corner' },
    { jointId: 'j8', topology: 'tee-3way',    semanticPath: '/bay-2/col-1/mid', position: { x: 2400, y: 0, z: 1800 }, memberIds: ['n5', 'n7'], connectorSpecKey: 'JC3-TEE', connectorFamilyKey: 'tee' },
    { jointId: 'j9', topology: 'tee-3way',    semanticPath: '/bay-2/col-2/mid', position: { x: 4800, y: 0, z: 1800 }, memberIds: ['n6', 'n8'], connectorSpecKey: 'JC3-TEE', connectorFamilyKey: 'tee' },
    { jointId: 'j10', topology: 'brace-end',  semanticPath: '/bay-2/brace-end-1', position: { x: 2400, y: 0, z: 900 }, memberIds: ['n5', 'n8'], connectorSpecKey: 'JC3-BRACE-END', connectorFamilyKey: 'brace-end' },
  ],
};

export const fixture3Expected = {
  designBomCount: 6, // 4 structural groups + 2 joint groups
  designCoverage: 100, // all mapped
  tradeBomCount: 6,
  tradeCoverage: 100,
};

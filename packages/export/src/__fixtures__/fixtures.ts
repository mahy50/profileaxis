// @profileaxis/export/__fixtures__ - Golden fixtures for SVG export
// Uses the resolved-dsl fixture from @profileaxis/schemas

import type { ResolvedDsl } from '@profileaxis/domain';
import type { ThreeViewSvg } from '../svg/index.js';
import type { DimensionViewModel } from '../svg/index.js';

// Minimal resolved-dsl fixture for testing SVG generation
export const simple2BayResolvedFixture: ResolvedDsl = {
  dslVersion: '1.0.0',
  projectType: 'storage_rack',
  sourceRevisionId: 'rev_test_001',
  overallSizeMm: { width: 3000, depth: 1000, height: 2000 },
  modules: [
    { moduleId: 'bay_001', kind: 'rect-bay', spanMm: 1500 },
    { moduleId: 'bay_002', kind: 'rect-bay', spanMm: 1500 },
  ],
  nodes: [
    // Front-left upright (bay 1)
    {
      nodeId: 'node_upright_front_left_1',
      kind: 'member',
      role: 'upright',
      semanticPath: 'bay[0].level[0].upright.frontLeft',
      axis: 'z',
      start: { x: 0, y: 0, z: 0 },
      end: { x: 0, y: 0, z: 2000 },
      lengthMm: 2000,
      profileSpecKey: 'UC90_C_Channel',
      provenance: { source: 'rule', ruleIds: ['rule_geo'] },
      finishKey: null,
      tags: [],
    },
    // Front-right upright (bay 1)
    {
      nodeId: 'node_upright_front_right_1',
      kind: 'member',
      role: 'upright',
      semanticPath: 'bay[0].level[0].upright.frontRight',
      axis: 'z',
      start: { x: 1500, y: 0, z: 0 },
      end: { x: 1500, y: 0, z: 2000 },
      lengthMm: 2000,
      profileSpecKey: 'UC90_C_Channel',
      provenance: { source: 'rule', ruleIds: ['rule_geo'] },
      finishKey: null,
      tags: [],
    },
    // Front beam bottom (bay 1)
    {
      nodeId: 'node_beam_front_bottom_1',
      kind: 'member',
      role: 'beamX',
      semanticPath: 'bay[0].level[0].beam.front',
      axis: 'x',
      start: { x: 0, y: 500, z: 0 },
      end: { x: 1500, y: 500, z: 0 },
      lengthMm: 1500,
      profileSpecKey: 'UC90_C_Channel',
      provenance: { source: 'rule', ruleIds: ['rule_geo'] },
      finishKey: null,
      tags: [],
    },
    // Front-left upright (bay 2)
    {
      nodeId: 'node_upright_front_left_2',
      kind: 'member',
      role: 'upright',
      semanticPath: 'bay[1].level[0].upright.frontLeft',
      axis: 'z',
      start: { x: 1500, y: 0, z: 0 },
      end: { x: 1500, y: 0, z: 2000 },
      lengthMm: 2000,
      profileSpecKey: 'UC90_C_Channel',
      provenance: { source: 'rule', ruleIds: ['rule_geo'] },
      finishKey: null,
      tags: [],
    },
    // Front-right upright (bay 2)
    {
      nodeId: 'node_upright_front_right_2',
      kind: 'member',
      role: 'upright',
      semanticPath: 'bay[1].level[0].upright.frontRight',
      axis: 'z',
      start: { x: 3000, y: 0, z: 0 },
      end: { x: 3000, y: 0, z: 2000 },
      lengthMm: 2000,
      profileSpecKey: 'UC90_C_Channel',
      provenance: { source: 'rule', ruleIds: ['rule_geo'] },
      finishKey: null,
      tags: [],
    },
    // Front beam bottom (bay 2)
    {
      nodeId: 'node_beam_front_bottom_2',
      kind: 'member',
      role: 'beamX',
      semanticPath: 'bay[1].level[0].beam.front',
      axis: 'x',
      start: { x: 1500, y: 500, z: 0 },
      end: { x: 3000, y: 500, z: 0 },
      lengthMm: 1500,
      profileSpecKey: 'UC90_C_Channel',
      provenance: { source: 'rule', ruleIds: ['rule_geo'] },
      finishKey: null,
      tags: [],
    },
  ],
  joints: [
    {
      jointId: 'joint_front_bottom_left_1',
      topology: 'corner-3way',
      semanticPath: 'bay[0].level[0].joint.frontLeft',
      position: { x: 0, y: 500, z: 0 },
      memberIds: ['node_upright_front_left_1', 'node_beam_front_bottom_1'],
      connectorSpecKey: 'C41_Con_3Way',
      connectorFamilyKey: 'standard_corner',
    },
  ],
};

// Single-bay fixture for simpler testing
export const singleBayResolvedFixture: ResolvedDsl = {
  dslVersion: '1.0.0',
  projectType: 'storage_rack',
  sourceRevisionId: 'rev_single_bay',
  overallSizeMm: { width: 1500, depth: 800, height: 1800 },
  modules: [{ moduleId: 'bay_001', kind: 'rect-bay', spanMm: 1500 }],
  nodes: [
    {
      nodeId: 'upright_fl',
      kind: 'member',
      role: 'upright',
      semanticPath: 'bay[0].level[0].upright.frontLeft',
      axis: 'z',
      start: { x: 0, y: 0, z: 0 },
      end: { x: 0, y: 0, z: 1800 },
      lengthMm: 1800,
      profileSpecKey: 'UC90_C_Channel',
      provenance: { source: 'rule', ruleIds: [] },
      finishKey: null,
      tags: [],
    },
    {
      nodeId: 'upright_fr',
      kind: 'member',
      role: 'upright',
      semanticPath: 'bay[0].level[0].upright.frontRight',
      axis: 'z',
      start: { x: 1500, y: 0, z: 0 },
      end: { x: 1500, y: 0, z: 1800 },
      lengthMm: 1800,
      profileSpecKey: 'UC90_C_Channel',
      provenance: { source: 'rule', ruleIds: [] },
      finishKey: null,
      tags: [],
    },
    {
      nodeId: 'beam_front_bot',
      kind: 'member',
      role: 'beamX',
      semanticPath: 'bay[0].level[0].beam.front',
      axis: 'x',
      start: { x: 0, y: 400, z: 0 },
      end: { x: 1500, y: 400, z: 0 },
      lengthMm: 1500,
      profileSpecKey: 'UC90_C_Channel',
      provenance: { source: 'rule', ruleIds: [] },
      finishKey: null,
      tags: [],
    },
    {
      nodeId: 'brace_front',
      kind: 'member',
      role: 'brace',
      semanticPath: 'bay[0].level[0].brace.front',
      axis: 'x',
      start: { x: 0, y: 0, z: 0 },
      end: { x: 1500, y: 400, z: 0 },
      lengthMm: Math.sqrt(1500 * 1500 + 400 * 400),
      profileSpecKey: 'AI50_Angle_Iron',
      provenance: { source: 'rule', ruleIds: [] },
      finishKey: null,
      tags: [],
    },
  ],
  joints: [
    {
      jointId: 'joint_fl',
      topology: 'corner-3way',
      semanticPath: 'bay[0].level[0].joint.frontLeft',
      position: { x: 0, y: 400, z: 0 },
      memberIds: ['upright_fl', 'beam_front_bot'],
      connectorSpecKey: 'C41_Con_3Way',
      connectorFamilyKey: 'standard_corner',
    },
  ],
};

// Standard dimension view model for simple2BayResolvedFixture
export const simple2BayDimVm: DimensionViewModel = {
  overallWidth: 3000,
  overallDepth: 1000,
  overallHeight: 2000,
  bayWidths: [1500, 1500],
  levelHeights: [2000],
};

// Standard dimension view model for singleBayResolvedFixture
export const singleBayDimVm: DimensionViewModel = {
  overallWidth: 1500,
  overallDepth: 800,
  overallHeight: 1800,
  bayWidths: [1500],
  levelHeights: [1800],
};

// Expected key dimensions for validation
export interface ExpectedDimension {
  label: string;
  valueMm: number;
}

export const simple2BayExpectedDimensions: ExpectedDimension[] = [
  { label: 'overallWidth', valueMm: 3000 },
  { label: 'overallDepth', valueMm: 1000 },
  { label: 'overallHeight', valueMm: 2000 },
  { label: 'bayWidth', valueMm: 1500 },
  { label: 'levelHeight', valueMm: 2000 },
];

export const singleBayExpectedDimensions: ExpectedDimension[] = [
  { label: 'overallWidth', valueMm: 1500 },
  { label: 'overallDepth', valueMm: 800 },
  { label: 'overallHeight', valueMm: 1800 },
];
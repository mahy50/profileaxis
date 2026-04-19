// StructuralNode — member or module node in a project (M1 frozen)

import type { Vec3 } from './Vec3.js';

export type NodeId = string;
export type Axis = 'x' | 'y' | 'z';
export type NodeRole = 'upright' | 'beamX' | 'beamY' | 'brace' | 'foot';
export type NodeKind = 'member' | 'module';
export type ProvenanceSource = 'user' | 'ai' | 'rule' | 'system';

export interface StructuralNode {
  nodeId: NodeId;
  kind: NodeKind;
  role: NodeRole;
  semanticPath: string;
  axis: Axis;
  start: Vec3;
  end: Vec3;
  lengthMm: number;
  profileSpecKey: string;
  provenance: {
    source: ProvenanceSource;
    ruleIds: string[];
  };
  finishKey: string | null;   // P1 field
  tags: string[];             // P1 field
}

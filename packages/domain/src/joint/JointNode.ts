// JointNode — connection node between structural members (M1 frozen)

import type { Vec3, NodeId } from '../structural/index.js';

export type JointId = string;

export type JointTopology =
  | 'corner-3way'
  | 'tee-3way'
  | 'cross-4way'
  | 'brace-end'
  | 'foot';

export interface JointNode {
  jointId: JointId;
  topology: JointTopology;
  semanticPath: string;
  position: Vec3;
  memberIds: NodeId[];
  connectorSpecKey: string;    // concrete spec key from stdlib
  connectorFamilyKey: string;  // abstract family key for rule matching
}

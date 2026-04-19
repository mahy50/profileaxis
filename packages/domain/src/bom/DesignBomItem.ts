// DesignBomItem — BOM line item derived from resolvedDsl structural nodes (M1)

import type { NodeId } from '../structural/index.js';

export interface DesignBomItem {
  itemId: string;
  nodeId: NodeId;
  profileSpecKey: string;
  description: string;
  quantity: number;
  unit: 'pcs' | 'm' | 'kg';
  material: string;
  lengthMm: number;
  weightEstimateKg: number | null;
  semanticPath: string;
}

// DesignBomItem — BOM line item derived from resolvedDsl (M1)
// Aligned with packages/bom types (P0-008)

export type MappingStatus = 'mapped' | 'unmapped' | 'ambiguous';

export interface DesignBomItem {
  id: string;
  kind: 'structural' | 'joint';
  role: string;
  profileSpecKey?: string;
  connectorSpecKey?: string;
  lengthMm: number | null;
  quantity: number;
  mappingStatus: MappingStatus;
  nodeIds: string[];
}

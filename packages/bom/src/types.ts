// @profileaxis/bom — Core BOM types

// ── Mapping status ────────────────────────────────────────────────────────────

export type MappingStatus = 'mapped' | 'unmapped' | 'ambiguous';

// ── Design BOM ────────────────────────────────────────────────────────────────

/**
 * One item in the Design BOM.
 * Corresponds to one structural node or joint node in resolvedDsl.
 */
export interface DesignBomItem {
  id: string;
  kind: 'structural' | 'joint';
  role: string;
  profileSpecKey?: string;
  connectorSpecKey?: string;
  /** Length in mm. Null for joint nodes (they have no length). */
  lengthMm: number | null;
  quantity: number;
  mappingStatus: MappingStatus;
  /** The resolvedDsl node/joint IDs this item aggregates. */
  nodeIds: string[];
}

// ── Trade BOM ─────────────────────────────────────────────────────────────────

/**
 * One item in the Trade BOM — mapped to a supplier SKU with pricing.
 */
export interface TradeBomItem {
  sku: string;
  supplierId: string;
  quantity: number;
  unitPrice: number;
  leadTimeDays: number;
  totalCost: number;
  mappingStatus: MappingStatus;
  designBomItemIds: string[];
}

// ── Supplier policy ───────────────────────────────────────────────────────────

export interface SupplierPolicyPriceTier {
  minQty: number;
  unitPrice: number;
}

export interface SupplierPolicy {
  supplierId: string;
  name: string;
  moq: number;
  leadTimeDays: number;
  priceTiers: SupplierPolicyPriceTier[];
}

// ── SKU mapping ───────────────────────────────────────────────────────────────

export interface SkuMapping {
  profileSpecKey: string;
  sku: string;
  supplierId: string;
  unitPrice: number;
  unit: 'piece' | 'meter';
}

// ── BOM summary ───────────────────────────────────────────────────────────────

export interface BomSummary {
  designBom: DesignBomItem[];
  tradeBom: TradeBomItem[];
  designCoverage: number;
  tradeCoverage: number;
  totalDesignCount: number;
  totalTradeCount: number;
}

// @profileaxis/bom/mapping — SKU → supplier lookup and coverage

import type { MappingStatus } from '../types.js';
import type { DesignBomItem, TradeBomItem, SupplierPolicy, SkuMapping } from '../types.js';

// ── Stdlib data imports ────────────────────────────────────────────────────────
// These files are produced by the stdlib build step.

import skuMappingsRaw from '../../../stdlib/dist/sku_maps/sku-mappings.json' assert { type: 'json' };
import supplierPoliciesRaw from '../../../stdlib/dist/policies/supplier-policies.json' assert { type: 'json' };

// ── Typed stdlib data ─────────────────────────────────────────────────────────

interface RawSkuMapping {
  profileSpecKey: string;
  connectorSpecKey: string;
  tradeBomSku: string;
  tradeBomDesc: string;
  unitCost: number;
  currency: string;
  unit: string;
  lengthMm: number | null;
}

interface RawSupplierPolicy {
  supplierId: string;
  name: string;
  region: string;
  leadTimeDays: number;
  minOrderQty: number;
  packRounding: number;
  currency: string;
  paymentTerms: string;
  notes?: string;
}

// Internal extended mapping includes connectorSpecKey for joint lookups
interface ExtendedSkuMapping {
  profileSpecKey: string;
  connectorSpecKey: string;
  sku: string;
  supplierId: string;
  unitPrice: number;
  unit: 'piece' | 'meter';
}

const SKU_MAP: ExtendedSkuMapping[] = (skuMappingsRaw as RawSkuMapping[]).map(m => {
  const prefix = m.tradeBomSku.split('-')[0];
  const supplierId =
    prefix === 'SSW' ? 'SUP-SSW-001' :
    prefix === 'HZL' ? 'SUP-HZL-002' :
    'SUP-FAS-003';
  return {
    profileSpecKey: m.profileSpecKey,
    connectorSpecKey: m.connectorSpecKey,
    sku: m.tradeBomSku,
    supplierId,
    unitPrice: m.unitCost,
    unit: (m.unit === '根' || m.unit === '个' || m.unit === '套' ? 'piece' : 'meter') as 'piece' | 'meter',
  };
});

const SUPPLIER_POLICIES: Map<string, SupplierPolicy> = new Map(
  (supplierPoliciesRaw as RawSupplierPolicy[]).map(p => [
    p.supplierId,
    {
      supplierId: p.supplierId,
      name: p.name,
      moq: p.minOrderQty,
      leadTimeDays: p.leadTimeDays,
      priceTiers: [{ minQty: p.minOrderQty, unitPrice: 0 }], // base tier; per-SKU price from SKU map
    },
  ])
);

// ── SKU lookup ─────────────────────────────────────────────────────────────────

/**
 * Find SKU mapping for a profileSpecKey.
 * Returns the first matching entry (multiple entries may exist for different lengths).
 */
export function findSkuMapping(profileSpecKey: string): SkuMapping | null {
  const found = SKU_MAP.find(m => m.profileSpecKey === profileSpecKey);
  if (!found) return null;
  const { profileSpecKey: _pk, connectorSpecKey: _ck, ...rest } = found;
  return rest as SkuMapping;
}

/**
 * Find SKU mapping for a connectorSpecKey.
 * Connectors use connectorSpecKey as the match field.
 */
export function findConnectorSkuMapping(connectorSpecKey: string): SkuMapping | null {
  const found = SKU_MAP.find(m => m.connectorSpecKey === connectorSpecKey);
  if (!found) return null;
  const { profileSpecKey: _pk, connectorSpecKey: _ck, ...rest } = found;
  return rest as SkuMapping;
}

/**
 * Get supplier policy by supplierId.
 */
export function getSupplierPolicy(supplierId: string): SupplierPolicy | null {
  return SUPPLIER_POLICIES.get(supplierId) ?? null;
}

/**
 * Resolve mapping status for a single design BOM item.
 */
export function resolveMappingStatus(designItem: DesignBomItem): MappingStatus {
  if (designItem.kind === 'structural' && designItem.profileSpecKey) {
    const found = findSkuMapping(designItem.profileSpecKey);
    return found ? 'mapped' : 'unmapped';
  }
  if (designItem.kind === 'joint' && designItem.connectorSpecKey) {
    const found = findConnectorSkuMapping(designItem.connectorSpecKey);
    return found ? 'mapped' : 'unmapped';
  }
  return 'unmapped';
}

// ── Coverage ───────────────────────────────────────────────────────────────────

/**
 * Compute design BOM coverage: fraction of design items that are mapped.
 */
export function designCoverage(items: DesignBomItem[]): number {
  if (items.length === 0) return 100;
  const mapped = items.filter(i => resolveMappingStatus(i) === 'mapped').length;
  return (mapped / items.length) * 100;
}

/**
 * Compute trade BOM coverage: fraction of trade BOM items that have a price.
 */
export function tradeCoverage(items: TradeBomItem[]): number {
  if (items.length === 0) return 100;
  const priced = items.filter(i => i.unitPrice > 0).length;
  return (priced / items.length) * 100;
}

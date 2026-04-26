// @profileaxis/bom/mapping — SKU → supplier lookup and coverage

import type { MappingStatus, DesignBomItem, TradeBomItem, SupplierPolicy, SkuMapping } from '../types.js';
import { SKU_MAPPINGS, SUPPLIER_POLICIES } from '@profileaxis/stdlib';
import type { SkuMappingData, SupplierPolicyData } from '@profileaxis/stdlib';

// Internal extended mapping includes connectorSpecKey for joint lookups
interface ExtendedSkuMapping {
  profileSpecKey: string;
  connectorSpecKey: string;
  sku: string;
  supplierId: string;
  unitPrice: number;
  unit: 'piece' | 'meter';
}

const SKU_MAP: ExtendedSkuMapping[] = SKU_MAPPINGS.map(m => {
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

const SUPPLIER_POLICIES_MAP: Map<string, SupplierPolicy> = new Map(
  SUPPLIER_POLICIES.map(p => [
    p.supplierId,
    {
      supplierId: p.supplierId,
      name: p.name,
      moq: p.minOrderQty,
      leadTimeDays: p.leadTimeDays,
      priceTiers: [{ minQty: p.minOrderQty, unitPrice: 0 }],
    },
  ])
);

// ── SKU lookup ─────────────────────────────────────────────────────────────────

export function findSkuMapping(profileSpecKey: string): SkuMapping | null {
  const found = SKU_MAP.find(m => m.profileSpecKey === profileSpecKey);
  if (!found) return null;
  const { profileSpecKey: _pk, connectorSpecKey: _ck, ...rest } = found;
  return rest as SkuMapping;
}

export function findConnectorSkuMapping(connectorSpecKey: string): SkuMapping | null {
  const found = SKU_MAP.find(m => m.connectorSpecKey === connectorSpecKey);
  if (!found) return null;
  const { profileSpecKey: _pk, connectorSpecKey: _ck, ...rest } = found;
  return rest as SkuMapping;
}

export function getSupplierPolicy(supplierId: string): SupplierPolicy | null {
  return SUPPLIER_POLICIES_MAP.get(supplierId) ?? null;
}

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

export function designCoverage(items: DesignBomItem[]): number {
  if (items.length === 0) return 100;
  const mapped = items.filter(i => resolveMappingStatus(i) === 'mapped').length;
  return (mapped / items.length) * 100;
}

export function tradeCoverage(items: TradeBomItem[]): number {
  if (items.length === 0) return 100;
  const priced = items.filter(i => i.unitPrice > 0).length;
  return (priced / items.length) * 100;
}

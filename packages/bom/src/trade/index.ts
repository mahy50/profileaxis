// @profileaxis/bom/trade — Trade BOM from Design BOM with supplier policy

import type { DesignBomItem, TradeBomItem, MappingStatus } from '../types.js';
import {
  findSkuMapping,
  findConnectorSkuMapping,
  getSupplierPolicy,
} from '../mapping/index.js';

// ── Price tier resolution ──────────────────────────────────────────────────────

/**
 * Resolve unit price for a given quantity using supplier price tiers.
 * Falls back to the given basePrice if no tier matches.
 */
function resolveUnitPrice(
  basePrice: number,
  quantity: number,
  priceTiers: Array<{ minQty: number; unitPrice: number }>
): number {
  // Sort tiers by minQty descending and find first applicable
  const sorted = [...priceTiers].sort((a, b) => b.minQty - a.minQty);
  for (const tier of sorted) {
    if (quantity >= tier.minQty) return tier.unitPrice;
  }
  return basePrice;
}

// ── Public API ─────────────────────────────────────────────────────────────────

/**
 * Build Trade BOM items from Design BOM items, applying SKU mappings
 * and supplier policies.
 */
export function tradeBomFromDesignBom(
  designBom: DesignBomItem[]
): TradeBomItem[] {
  return designBom.map(item => {
    // Determine SKU mapping based on item kind
    const mapping =
      item.kind === 'structural' && item.profileSpecKey
        ? findSkuMapping(item.profileSpecKey)
        : item.kind === 'joint' && item.connectorSpecKey
          ? findConnectorSkuMapping(item.connectorSpecKey)
          : null;

    if (!mapping) {
      return {
        sku: 'UNMAPPED',
        supplierId: 'UNKNOWN',
        quantity: item.quantity,
        unitPrice: 0,
        leadTimeDays: 0,
        totalCost: 0,
        mappingStatus: 'unmapped' as MappingStatus,
        designBomItemIds: item.nodeIds,
      };
    }

    // Get supplier policy
    const policy = getSupplierPolicy(mapping.supplierId);
    const moq = policy?.moq ?? 1;
    const leadTimeDays = policy?.leadTimeDays ?? 14;
    const priceTiers = policy?.priceTiers ?? [];

    // Resolve unit price from tiers (fallback to SKU map price)
    const unitPrice = resolveUnitPrice(mapping.unitPrice, item.quantity, priceTiers);
    const effectiveQty = Math.max(moq, item.quantity);
    const totalCost = effectiveQty * unitPrice;

    return {
      sku: mapping.sku,
      supplierId: mapping.supplierId,
      quantity: effectiveQty,
      unitPrice,
      leadTimeDays,
      totalCost,
      mappingStatus: 'mapped' as MappingStatus,
      designBomItemIds: item.nodeIds,
    };
  });
}

/**
 * Apply an additional supplier policy override to a trade BOM item.
 * Use when you need to re-price based on updated quantity or supplier terms.
 */
export function applySupplierPolicy(
  tradeItem: TradeBomItem,
  policy: { moq?: number; leadTimeDays?: number; priceTiers?: Array<{ minQty: number; unitPrice: number }> }
): TradeBomItem {
  const effectiveQty = Math.max(tradeItem.quantity, policy.moq ?? 1);
  const unitPrice = resolveUnitPrice(
    tradeItem.unitPrice,
    effectiveQty,
    policy.priceTiers ?? []
  );
  return {
    ...tradeItem,
    quantity: effectiveQty,
    unitPrice,
    leadTimeDays: policy.leadTimeDays ?? tradeItem.leadTimeDays,
    totalCost: effectiveQty * unitPrice,
  };
}

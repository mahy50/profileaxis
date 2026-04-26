// @profileaxis/bom — Public API
// Design BOM / Trade BOM dual-chain with SKU mapping.

export type {
  DesignBomItem,
  TradeBomItem,
  SupplierPolicy,
  SkuMapping,
  MappingStatus,
  BomSummary,
} from './types.js';

export { designBomFromResolvedDsl } from './design/index.js';
export { tradeBomFromDesignBom, applySupplierPolicy } from './trade/index.js';
export {
  findSkuMapping,
  findConnectorSkuMapping,
  getSupplierPolicy,
  resolveMappingStatus,
  designCoverage,
  tradeCoverage,
} from './mapping/index.js';

import type { ResolvedDsl } from '@profileaxis/domain';
import type { BomSummary } from './types.js';
import { designBomFromResolvedDsl } from './design/index.js';
import { tradeBomFromDesignBom } from './trade/index.js';
import { designCoverage, tradeCoverage } from './mapping/index.js';

/**
 * Full BOM computation from a resolved DSL document.
 * Produces design BOM, trade BOM, and coverage metrics.
 */
export function computeBomSummary(resolvedDsl: ResolvedDsl): BomSummary {
  const designBom = designBomFromResolvedDsl(resolvedDsl);
  const tradeBom = tradeBomFromDesignBom(designBom);
  const dc = designCoverage(designBom);
  const tc = tradeCoverage(tradeBom);

  return {
    designBom,
    tradeBom,
    designCoverage: dc,
    tradeCoverage: tc,
    totalDesignCount: designBom.length,
    totalTradeCount: tradeBom.length,
  };
}

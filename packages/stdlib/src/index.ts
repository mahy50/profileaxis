// @profileaxis/stdlib — Static seed data for rack design components
// Architecture: ONLY depends on @profileaxis/domain. NO apps/* or render-babylon.
// Contains ONLY static data — NO business logic.

export const STDLIB_VERSION = '1.0.0-m1' as const;

// ── Profile Specs ────────────────────────────────────────────────────────────
import profileA from './profiles/profile-A-upright-90x70.json';
import profileB from './profiles/profile-B-beam-60x40.json';
import profileC from './profiles/profile-C-angle-50x50.json';

export const PROFILES = [profileA, profileB, profileC];

// ── Connector Specs ──────────────────────────────────────────────────────────
import jointConnectors from './connectors/joint-connectors.json';

export const CONNECTORS = jointConnectors;

// ── Supplier Policies ────────────────────────────────────────────────────────
import supplierPolicies from './policies/supplier-policies.json';

export const SUPPLIER_POLICIES = supplierPolicies;

// ── SKU Mappings ─────────────────────────────────────────────────────────────
import skuMappings from './sku_maps/sku-mappings.json';

export const SKU_MAPPINGS = skuMappings;

// ── Combined Catalog Fixture ──────────────────────────────────────────────────
export interface CatalogFixture {
  version: string;
  profiles: typeof PROFILES;
  connectors: typeof CONNECTORS;
  supplierPolicies: typeof SUPPLIER_POLICIES;
  skuMappings: typeof SKU_MAPPINGS;
}

export const CATALOG_FIXTURE: CatalogFixture = {
  version: STDLIB_VERSION,
  profiles: PROFILES,
  connectors: CONNECTORS,
  supplierPolicies: SUPPLIER_POLICIES,
  skuMappings: SKU_MAPPINGS,
};

// @profileaxis/stdlib — Static seed data for rack design components
// Architecture: ONLY depends on @profileaxis/domain. NO apps/* or render-babylon.
// Contains ONLY static data — NO business logic.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function loadJson<T>(relativePath: string): T {
  return JSON.parse(readFileSync(resolve(__dirname, relativePath), 'utf-8')) as T;
}

export const STDLIB_VERSION = '1.0.0-m1' as const;

// ── Type definitions ─────────────────────────────────────────────────────────

export interface ProfileSpec {
  profileKey: string;
  seriesName: string;
  crossSection: string;
  dimensions: { widthMm: number; heightMm: number; wallThicknessMm: number };
  material: string;
  weightKgPerM: number;
  loadRatingN: number;
  finishOptions: Array<{ finishKey: string; description: string }>;
}

export interface ConnectorSpec {
  connectorKey: string;
  connectorFamilyKey: string;
  topology: string;
  compatibleProfileKeys: string[];
  hardwareItems: Array<{ partNumber: string; description: string; quantity: number }>;
}

export interface SupplierPolicyData {
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

export interface SkuMappingData {
  profileSpecKey: string;
  connectorSpecKey: string;
  tradeBomSku: string;
  tradeBomDesc: string;
  unitCost: number;
  currency: string;
  unit: string;
  lengthMm: number | null;
}

// ── Profile Specs ────────────────────────────────────────────────────────────

const profileA = loadJson<ProfileSpec>('./profiles/profile-A-upright-90x70.json');
const profileB = loadJson<ProfileSpec>('./profiles/profile-B-beam-60x40.json');
const profileC = loadJson<ProfileSpec>('./profiles/profile-C-angle-50x50.json');

export const PROFILES: ProfileSpec[] = [profileA, profileB, profileC];

// ── Connector Specs ──────────────────────────────────────────────────────────

const jointConnectors = loadJson<ConnectorSpec[]>('./connectors/joint-connectors.json');

export const CONNECTORS: ConnectorSpec[] = jointConnectors;

// ── Supplier Policies ────────────────────────────────────────────────────────

const supplierPolicies = loadJson<SupplierPolicyData[]>('./policies/supplier-policies.json');

export const SUPPLIER_POLICIES: SupplierPolicyData[] = supplierPolicies;

// ── SKU Mappings ─────────────────────────────────────────────────────────────

const skuMappings = loadJson<SkuMappingData[]>('./sku_maps/sku-mappings.json');

export const SKU_MAPPINGS: SkuMappingData[] = skuMappings;

// ── Combined Catalog Fixture ──────────────────────────────────────────────────

export interface CatalogFixture {
  version: string;
  profiles: ProfileSpec[];
  connectors: ConnectorSpec[];
  supplierPolicies: SupplierPolicyData[];
  skuMappings: SkuMappingData[];
}

export const CATALOG_FIXTURE: CatalogFixture = {
  version: STDLIB_VERSION,
  profiles: PROFILES,
  connectors: CONNECTORS,
  supplierPolicies: SUPPLIER_POLICIES,
  skuMappings: SKU_MAPPINGS,
};

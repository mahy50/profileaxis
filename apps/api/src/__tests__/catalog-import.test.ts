// catalog-import.test.ts — Catalog CSV/XLSX import + validation tests
import { describe, test, expect, beforeAll, afterAll } from 'vitest';
import { createApiServer, getCatalog } from '../index.js';
import type { Server } from 'node:http';
import {
  importCatalog,
  validateCatalogFixture,
  __injectXlsx,
} from '../services/catalog/index.js';
import type { CatalogImportInput } from '../services/catalog/index.js';
import { CATALOG_FIXTURE } from '@profileaxis/stdlib';
import * as XLSX from 'xlsx';

// Inject xlsx so importCatalog works synchronously in tests
__injectXlsx(XLSX);

// ── Helpers ───────────────────────────────────────────────────────────────────────

function buildXlsxBase64(sheets: Record<string, Record<string, unknown>[]>): string {
  const wb = XLSX.utils.book_new();
  for (const [name, rows] of Object.entries(sheets)) {
    const ws = XLSX.utils.json_to_sheet(rows);
    XLSX.utils.book_append_sheet(wb, ws, name);
  }
  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  return buf.toString('base64');
}

function makeInput(sheets: Record<string, Record<string, unknown>[]>, format: 'xlsx' | 'csv' = 'xlsx'): CatalogImportInput {
  return { format, data: buildXlsxBase64(sheets) };
}

function httpPost(server: Server, path: string, body: unknown): Promise<{ status: number; data: unknown }> {
  const addr = server.address();
  if (!addr || typeof addr === 'string') throw new Error('Server not bound');
  const port = addr.port;
  const payload = JSON.stringify(body);

  return new Promise((resolve, reject) => {
    const http = require('node:http') as typeof import('node:http');
    const req = http.request(
      { hostname: '127.0.0.1', port, path, method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) } },
      (res: import('node:http').IncomingMessage) => {
        const chunks: Buffer[] = [];
        res.on('data', (ch: Buffer) => chunks.push(ch));
        res.on('end', () => {
          try {
            resolve({ status: res.statusCode ?? 0, data: JSON.parse(Buffer.concat(chunks).toString('utf-8')) });
          } catch {
            resolve({ status: res.statusCode ?? 0, data: null });
          }
        });
      }
    );
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

function httpGet(server: Server, path: string): Promise<{ status: number; data: unknown }> {
  const addr = server.address();
  if (!addr || typeof addr === 'string') throw new Error('Server not bound');
  const port = addr.port;

  return new Promise((resolve, reject) => {
    const http = require('node:http') as typeof import('node:http');
    http.get({ hostname: '127.0.0.1', port, path }, (res: import('node:http').IncomingMessage) => {
      const chunks: Buffer[] = [];
      res.on('data', (ch: Buffer) => chunks.push(ch));
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode ?? 0, data: JSON.parse(Buffer.concat(chunks).toString('utf-8')) });
        } catch {
          resolve({ status: res.statusCode ?? 0, data: null });
        }
      });
    }).on('error', reject);
  });
}

// ── Sample data ──────────────────────────────────────────────────────────────────

const validProfiles = [
  {
    profileKey: 'PA-UC90-70-2.5',
    seriesName: 'UC90',
    crossSection: 'C-channel',
    dimensions: JSON.stringify({ widthMm: 90, heightMm: 70, wallThicknessMm: 2.5 }),
    material: 'Q355',
    weightKgPerM: 5.24,
    loadRatingN: 85000,
    finishOptions: JSON.stringify([{ finishKey: 'PG', description: '预镀锌' }]),
  },
];

const validConnectors = [
  {
    connectorKey: 'JC3-CORNER',
    connectorFamilyKey: 'JC3',
    topology: 'corner-3way',
    compatibleProfileKeys: JSON.stringify(['PA-UC90-70-2.5', 'PB-SB60-40-2.0']),
    hardwareItems: JSON.stringify([{ partNumber: 'M8-25', description: 'M8x25螺栓', quantity: 4 }]),
  },
];

const validSuppliers = [
  {
    supplierId: 'SSW',
    name: 'Shanghai Steelworks',
    region: 'CN-EAST',
    leadTimeDays: 14,
    minOrderQty: 50,
    packRounding: 10,
    currency: 'CNY',
    paymentTerms: 'NET30',
    notes: '',
  },
];

const validSkuMappings = [
  {
    profileSpecKey: 'PA-UC90-70-2.5',
    connectorSpecKey: '',
    tradeBomSku: 'SKU-UC90-6000',
    tradeBomDesc: 'UC90 Upright 6000mm',
    unitCost: 120,
    currency: 'CNY',
    unit: 'pcs',
    lengthMm: 6000,
  },
];

// ── Unit tests: importCatalog ────────────────────────────────────────────────────

describe('Catalog Importer — importCatalog', () => {
  test('imports valid XLSX with all 4 sheets', () => {
    const input = makeInput({
      profiles: validProfiles,
      connectors: validConnectors,
      supplierPolicies: validSuppliers,
      skuMappings: validSkuMappings,
    });

    const result = importCatalog(input);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.catalog.profiles).toHaveLength(1);
      expect(result.catalog.connectors).toHaveLength(1);
      expect(result.catalog.supplierPolicies).toHaveLength(1);
      expect(result.catalog.skuMappings).toHaveLength(1);
      expect(result.catalog.profiles[0].profileKey).toBe('PA-UC90-70-2.5');
      expect(result.catalog.profiles[0].dimensions.widthMm).toBe(90);
      expect(result.catalog.profiles[0].finishOptions).toHaveLength(1);
      expect(result.validation.valid).toBe(true);
    }
  });

  test('returns failure for unparseable base64 data', () => {
    // Base64 that decodes to an empty buffer — xlsx will reject it
    const result = importCatalog({ format: 'xlsx', data: '!!!' });
    expect(result.success).toBe(false);
  });

  test('warns on missing optional sheet', () => {
    const input = makeInput({
      profiles: validProfiles,
      connectors: validConnectors,
    });

    const result = importCatalog(input);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.warnings).toEqual(
        expect.arrayContaining([
          expect.stringContaining('supplierPolicies'),
          expect.stringContaining('skuMappings'),
        ])
      );
    }
  });

  test('returns failure for invalid JSON in dimensions field', () => {
    const input = makeInput({
      profiles: [{ ...validProfiles[0], dimensions: '{bad json' }],
      connectors: validConnectors,
      supplierPolicies: validSuppliers,
      skuMappings: validSkuMappings,
    });

    const result = importCatalog(input);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors.some((e) => e.message.includes('dimensions'))).toBe(true);
    }
  });

  test('returns failure for missing required field (profileKey)', () => {
    const input = makeInput({
      profiles: [{ seriesName: 'NoKey', crossSection: 'C', dimensions: '{}', material: 'Steel', weightKgPerM: 1, loadRatingN: 100, finishOptions: '[]' }],
      connectors: validConnectors,
      supplierPolicies: validSuppliers,
      skuMappings: validSkuMappings,
    });

    const result = importCatalog(input);
    expect(result.success).toBe(false);
  });

  test('imports empty profileKey as missing', () => {
    const input = makeInput({
      profiles: [{ ...validProfiles[0], profileKey: '  ' }],
      connectors: validConnectors,
      supplierPolicies: validSuppliers,
      skuMappings: validSkuMappings,
    });

    const result = importCatalog(input);
    expect(result.success).toBe(false);
  });

  test('parses numeric fields from strings', () => {
    const input = makeInput({
      profiles: [{ ...validProfiles[0], weightKgPerM: '5.24', loadRatingN: '85000' }],
      connectors: validConnectors,
      supplierPolicies: validSuppliers,
      skuMappings: validSkuMappings,
    });

    const result = importCatalog(input);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.catalog.profiles[0].weightKgPerM).toBe(5.24);
      expect(result.catalog.profiles[0].loadRatingN).toBe(85000);
    }
  });

  test('parses lengthMm null from empty string', () => {
    const input = makeInput({
      profiles: validProfiles,
      connectors: validConnectors,
      supplierPolicies: validSuppliers,
      skuMappings: [{ ...validSkuMappings[0], lengthMm: '' }],
    });

    const result = importCatalog(input);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.catalog.skuMappings[0].lengthMm).toBeNull();
    }
  });

  test('CSV format: parses CSV string and returns empty but valid catalog', () => {
    const csvContent = 'profileKey,seriesName,crossSection\nP-1,S1,Rect\n';
    const base64 = Buffer.from(csvContent).toString('base64');

    const result = importCatalog({ format: 'csv', data: base64 });
    // CSV single-sheet workbook won't have named sheets → empty catalog → valid
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.catalog.profiles).toHaveLength(0);
      expect(result.catalog.connectors).toHaveLength(0);
      expect(result.catalog.supplierPolicies).toHaveLength(0);
      expect(result.catalog.skuMappings).toHaveLength(0);
      expect(result.validation.valid).toBe(true);
      expect(result.warnings.length).toBeGreaterThan(0);
    }
  });

  test('CSV format: empty CSV content returns failure', () => {
    const result = importCatalog({ format: 'csv', data: Buffer.from('').toString('base64') });
    expect(result.success).toBe(false);
  });
});

// ── Unit tests: validateCatalogFixture ────────────────────────────────────────────

describe('Catalog Validator — validateCatalogFixture', () => {
  test('validates the built-in CATALOG_FIXTURE', () => {
    const vr = validateCatalogFixture(CATALOG_FIXTURE);
    expect(vr.valid).toBe(true);
    expect(vr.errors).toHaveLength(0);
  });

  test('rejects null input', () => {
    const vr = validateCatalogFixture(null);
    expect(vr.valid).toBe(false);
  });

  test('rejects missing version field', () => {
    const vr = validateCatalogFixture({
      profiles: [],
      connectors: [],
      supplierPolicies: [],
      skuMappings: [],
    });
    expect(vr.valid).toBe(false);
  });

  test('rejects invalid profile (missing dimensions)', () => {
    const vr = validateCatalogFixture({
      version: '1.0',
      profiles: [{ profileKey: 'X', seriesName: 'S', crossSection: 'C', material: 'M', weightKgPerM: 1, loadRatingN: 100, finishOptions: [] }],
      connectors: [],
      supplierPolicies: [],
      skuMappings: [],
    });
    expect(vr.valid).toBe(false);
  });

  test('rejects invalid connector (bad hardwareItems quantity type)', () => {
    const vr = validateCatalogFixture({
      version: '1.0',
      profiles: [],
      connectors: [{
        connectorKey: 'C1',
        connectorFamilyKey: 'F1',
        topology: 'corner',
        compatibleProfileKeys: [],
        hardwareItems: [{ partNumber: 'P1', description: 'D', quantity: 'not-a-number' }],
      }],
      supplierPolicies: [],
      skuMappings: [],
    });
    expect(vr.valid).toBe(false);
  });

  test('rejects empty profileKey', () => {
    const vr = validateCatalogFixture({
      version: '1.0',
      profiles: [{ profileKey: '', seriesName: 'S', crossSection: 'C', dimensions: { widthMm: 1, heightMm: 1, wallThicknessMm: 1 }, material: 'M', weightKgPerM: 1, loadRatingN: 100, finishOptions: [] }],
      connectors: [],
      supplierPolicies: [],
      skuMappings: [],
    });
    expect(vr.valid).toBe(false);
  });
});

// ── Contract tests: getCatalog ────────────────────────────────────────────────────

describe('Contract: getCatalog', () => {
  test('returns catalog for "latest" version', async () => {
    const result = await getCatalog('latest');
    expect(result.catalog).toBeDefined();
    expect(result.catalog).toBe(CATALOG_FIXTURE);
  });

  test('returns catalog for current version', async () => {
    const result = await getCatalog(CATALOG_FIXTURE.version);
    expect(result.catalog).toBeDefined();
    expect(result.catalog).toBe(CATALOG_FIXTURE);
  });

  test('returns null catalog for unknown version', async () => {
    const result = await getCatalog('nonexistent');
    expect(result.catalog).toBeNull();
    expect(result.message).toBeDefined();
  });
});

// ── Contract tests: HTTP endpoints ────────────────────────────────────────────────

describe('Contract: Catalog HTTP endpoints', () => {
  let server: Server;

  beforeAll(() => {
    server = createApiServer({ port: 0 });
  });

  afterAll(() => {
    server.close();
  });

  test('GET /v1/catalog/latest returns catalog', async () => {
    const { status, data } = await httpGet(server, '/v1/catalog/latest');
    expect(status).toBe(200);
    const d = data as Record<string, unknown>;
    expect(d.status).toBe('ok');
    expect(d.catalog).toBeDefined();
  });

  test('GET /v1/catalog/{version} returns 404 for unknown version', async () => {
    const { status, data } = await httpGet(server, '/v1/catalog/nonexistent');
    expect(status).toBe(404);
    const d = data as Record<string, unknown>;
    expect(d.error).toBeDefined();
  });

  test('POST /v1/catalog/import without format returns 400', async () => {
    const { status } = await httpPost(server, '/v1/catalog/import', { data: 'dGVzdA==' });
    expect(status).toBe(400);
  });

  test('POST /v1/catalog/import with invalid format returns 400', async () => {
    const { status } = await httpPost(server, '/v1/catalog/import', { format: 'pdf', data: 'dGVzdA==' });
    expect(status).toBe(400);
  });

  test('POST /v1/catalog/import with empty data returns 400', async () => {
    const { status } = await httpPost(server, '/v1/catalog/import', { format: 'xlsx', data: '' });
    expect(status).toBe(400);
  });

  test('POST /v1/catalog/import with invalid base64 returns 422', async () => {
    const { status, data } = await httpPost(server, '/v1/catalog/import', { format: 'xlsx', data: '!!!' });
    expect(status).toBe(422);
    const d = data as Record<string, unknown>;
    expect(d.status).toBe('error');
    expect(d.errors).toBeDefined();
  });

  test('POST /v1/catalog/import with valid XLSX returns 200', async () => {
    const base64Data = buildXlsxBase64({
      profiles: validProfiles,
      connectors: validConnectors,
      supplierPolicies: validSuppliers,
      skuMappings: validSkuMappings,
    });

    const { status, data } = await httpPost(server, '/v1/catalog/import', {
      format: 'xlsx',
      data: base64Data,
      version: '1.0.0-test',
    });

    expect(status).toBe(200);
    const d = data as Record<string, unknown>;
    expect(d.status).toBe('ok');
    expect(d.catalog).toBeDefined();
    const cat = d.catalog as Record<string, unknown>;
    expect(cat.version).toBe('1.0.0-test');
    expect(cat.profiles).toBeDefined();
  });

  test('legacy GET /v1/export/pdf returns catalog', async () => {
    const { status, data } = await httpGet(server, '/v1/export/pdf?version=latest');
    expect(status).toBe(200);
    const d = data as Record<string, unknown>;
    expect(d.status).toBe('ok');
  });
});

// ── Round-trip: import produces data that validates against built-in fixture ──────

describe('Catalog Import Round-trip', () => {
  test('imported catalog matches built-in fixture shape', () => {
    // Build XLSX matching the built-in CATALOG_FIXTURE
    const profiles = CATALOG_FIXTURE.profiles.map((p) => ({
      profileKey: p.profileKey,
      seriesName: p.seriesName,
      crossSection: p.crossSection,
      dimensions: JSON.stringify(p.dimensions),
      material: p.material,
      weightKgPerM: p.weightKgPerM,
      loadRatingN: p.loadRatingN,
      finishOptions: JSON.stringify(p.finishOptions),
    }));

    const connectors = CATALOG_FIXTURE.connectors.map((c) => ({
      connectorKey: c.connectorKey,
      connectorFamilyKey: c.connectorFamilyKey,
      topology: c.topology,
      compatibleProfileKeys: JSON.stringify(c.compatibleProfileKeys),
      hardwareItems: JSON.stringify(c.hardwareItems),
    }));

    const supplierPolicies = CATALOG_FIXTURE.supplierPolicies.map((s) => ({
      supplierId: s.supplierId,
      name: s.name,
      region: s.region,
      leadTimeDays: s.leadTimeDays,
      minOrderQty: s.minOrderQty,
      packRounding: s.packRounding,
      currency: s.currency,
      paymentTerms: s.paymentTerms,
      notes: s.notes ?? '',
    }));

    const skuMappings = CATALOG_FIXTURE.skuMappings.map((m) => ({
      profileSpecKey: m.profileSpecKey,
      connectorSpecKey: m.connectorSpecKey,
      tradeBomSku: m.tradeBomSku,
      tradeBomDesc: m.tradeBomDesc,
      unitCost: m.unitCost,
      currency: m.currency,
      unit: m.unit,
      lengthMm: m.lengthMm ?? '',
    }));

    const input = makeInput({ profiles, connectors, supplierPolicies, skuMappings });
    const result = importCatalog(input);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.catalog.profiles).toHaveLength(CATALOG_FIXTURE.profiles.length);
      expect(result.catalog.connectors).toHaveLength(CATALOG_FIXTURE.connectors.length);
      expect(result.catalog.supplierPolicies).toHaveLength(CATALOG_FIXTURE.supplierPolicies.length);
      expect(result.catalog.skuMappings).toHaveLength(CATALOG_FIXTURE.skuMappings.length);

      // Validate the round-tripped catalog against the schema
      const vr = validateCatalogFixture(result.catalog);
      expect(vr.valid).toBe(true);
    }
  });
});

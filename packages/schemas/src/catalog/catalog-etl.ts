// @profileaxis/schemas — Catalog ETL: CSV/XLSX → normalized JSON
// Architecture: shared normalization + validation, callable from both frontend and backend.
// Gate P1-005: catalog CSV/XLSX → canonical JSON validated against catalog-fixture.schema.json

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import Ajv, { ValidateFunction } from 'ajv';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ── Types (mirrored from @profileaxis/stdlib for self-contained validation) ─────

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

export interface CatalogFixture {
  version: string;
  profiles: ProfileSpec[];
  connectors: ConnectorSpec[];
  supplierPolicies: SupplierPolicyData[];
  skuMappings: SkuMappingData[];
}

export interface CatalogEtlResult {
  success: boolean;
  catalog?: CatalogFixture;
  errors: string[];
}

export interface ValidationResult {
  valid: boolean;
  errors: Array<{ path: string; message: string }>;
}

// ── CSV Parser ──────────────────────────────────────────────────────────────────

function parseCsv(text: string): Record<string, string>[] {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length === 0) return [];

  const headers = parseCsvLine(lines[0]).map((h) => h.trim());
  const rows: Record<string, string>[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const values = parseCsvLine(line);
    const row: Record<string, string> = {};
    for (let j = 0; j < headers.length; j++) {
      row[headers[j]] = values[j]?.trim() ?? '';
    }
    rows.push(row);
  }

  return rows;
}

function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (i + 1 < line.length && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        current += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ',') {
        result.push(current);
        current = '';
      } else {
        current += ch;
      }
    }
  }
  result.push(current);
  return result;
}

// ── Normalizers — CSV row → typed spec ──────────────────────────────────────────

function parseNumber(raw: string | undefined, fallback: number): number {
  if (!raw || raw.trim() === '') return fallback;
  const n = Number(raw.trim());
  return Number.isFinite(n) ? n : fallback;
}

function parseIntNum(raw: string | undefined, fallback: number): number {
  if (!raw || raw.trim() === '') return fallback;
  const n = parseInt(raw.trim(), 10);
  return Number.isFinite(n) ? n : fallback;
}

function parseJsonField<T>(raw: string | undefined, fallback: T): T {
  if (!raw || raw.trim() === '') return fallback;
  try {
    return JSON.parse(raw.trim()) as T;
  } catch {
    return fallback;
  }
}

function normalizeProfiles(rows: Record<string, string>[]): ProfileSpec[] {
  return rows.map((row) => ({
    profileKey: row.profileKey ?? '',
    seriesName: row.seriesName ?? '',
    crossSection: row.crossSection ?? '',
    dimensions: {
      widthMm: parseNumber(row.widthMm, 0),
      heightMm: parseNumber(row.heightMm, 0),
      wallThicknessMm: parseNumber(row.wallThicknessMm, 0),
    },
    material: row.material ?? '',
    weightKgPerM: parseNumber(row.weightKgPerM, 0),
    loadRatingN: parseNumber(row.loadRatingN, 0),
    finishOptions: parseJsonField<ProfileSpec['finishOptions']>(row.finishOptions, []),
  }));
}

function normalizeConnectors(rows: Record<string, string>[]): ConnectorSpec[] {
  return rows.map((row) => ({
    connectorKey: row.connectorKey ?? '',
    connectorFamilyKey: row.connectorFamilyKey ?? '',
    topology: row.topology ?? '',
    compatibleProfileKeys: parseJsonField<string[]>(row.compatibleProfileKeys, []),
    hardwareItems: parseJsonField<ConnectorSpec['hardwareItems']>(row.hardwareItems, []),
  }));
}

function normalizeSupplierPolicies(rows: Record<string, string>[]): SupplierPolicyData[] {
  return rows.map((row) => ({
    supplierId: row.supplierId ?? '',
    name: row.name ?? '',
    region: row.region ?? '',
    leadTimeDays: parseIntNum(row.leadTimeDays, 0),
    minOrderQty: parseIntNum(row.minOrderQty, 0),
    packRounding: parseIntNum(row.packRounding, 1),
    currency: row.currency ?? '',
    paymentTerms: row.paymentTerms ?? '',
    notes: row.notes || undefined,
  }));
}

function normalizeSkuMappings(rows: Record<string, string>[]): SkuMappingData[] {
  return rows.map((row) => {
    const lengthRaw = row.lengthMm?.trim();
    const lengthMm = lengthRaw && lengthRaw !== '' ? parseNumber(lengthRaw, 0) : null;
    return {
      profileSpecKey: row.profileSpecKey ?? '',
      connectorSpecKey: row.connectorSpecKey ?? '',
      tradeBomSku: row.tradeBomSku ?? '',
      tradeBomDesc: row.tradeBomDesc ?? '',
      unitCost: parseNumber(row.unitCost, 0),
      currency: row.currency ?? '',
      unit: row.unit ?? '',
      lengthMm,
    };
  });
}

// ── XLSX Parser (optional xlsx dependency) ──────────────────────────────────────

async function parseXlsxSheets(filePath: string): Promise<Record<string, Record<string, string>[]>> {
  let XLSX: any;
  try {
    XLSX = await import('xlsx');
  } catch {
    throw new Error('xlsx package not installed. Install with: pnpm add xlsx');
  }

  // Use XLSX.read with buffer (compatible with ESM dynamic import)
  // XLSX.readFile may not be available when imported dynamically as ESM
  const buf = readFileSync(filePath);
  const workbook = XLSX.read(buf, { type: 'buffer' });
  const sheets: Record<string, Record<string, string>[]> = {};

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    const raw: unknown[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
    if (raw.length === 0) continue;

    const headers = (raw[0] as string[]).map((h: string) => String(h).trim());
    const rows: Record<string, string>[] = [];

    for (let i = 1; i < raw.length; i++) {
      const vals = raw[i] as string[];
      const row: Record<string, string> = {};
      for (let j = 0; j < headers.length; j++) {
        row[headers[j]] = vals[j] != null ? String(vals[j]).trim() : '';
      }
      rows.push(row);
    }
    sheets[sheetName] = rows;
  }

  return sheets;
}

// ── Schema validator ────────────────────────────────────────────────────────────

let _validateCatalog: ValidateFunction | null = null;

function getCatalogValidator(): ValidateFunction {
  if (!_validateCatalog) {
    const schemaPath = resolve(__dirname, 'catalog-fixture.schema.json');
    const schema = JSON.parse(readFileSync(schemaPath, 'utf-8'));
    const ajv = new Ajv({ allErrors: true, strict: false });
    _validateCatalog = ajv.compile(schema);
  }
  return _validateCatalog;
}

export function validateCatalog(data: unknown): ValidationResult {
  const validateFn = getCatalogValidator();
  const valid = validateFn(data);
  if (!valid && validateFn.errors) {
    return {
      valid: false,
      errors: validateFn.errors.map((e) => ({
        path: e.instancePath || '/',
        message: e.message || 'Unknown error',
      })),
    };
  }
  return { valid: true, errors: [] };
}

// ── Builder — assemble CatalogFixture from parsed tables ────────────────────────

export function buildCatalogFromRows(
  version: string,
  profilesRows: Record<string, string>[],
  connectorsRows: Record<string, string>[],
  supplierPoliciesRows: Record<string, string>[],
  skuMappingsRows: Record<string, string>[],
): CatalogFixture {
  return {
    version,
    profiles: normalizeProfiles(profilesRows),
    connectors: normalizeConnectors(connectorsRows),
    supplierPolicies: normalizeSupplierPolicies(supplierPoliciesRows),
    skuMappings: normalizeSkuMappings(skuMappingsRows),
  };
}

// ── Main API: build catalog from CSV files ──────────────────────────────────────

export interface CsvFileSet {
  profilesCsvPath: string;
  connectorsCsvPath: string;
  supplierPoliciesCsvPath: string;
  skuMappingsCsvPath: string;
}

export function buildCatalogFromCsvFiles(version: string, files: CsvFileSet): CatalogEtlResult {
  const missing: string[] = [];
  for (const [key, path] of Object.entries(files)) {
    if (!existsSync(path)) missing.push(`${key}: ${path}`);
  }
  if (missing.length > 0) {
    return { success: false, errors: [`Missing CSV files: ${missing.join(', ')}`] };
  }

  try {
    const profilesRows = parseCsv(readFileSync(files.profilesCsvPath, 'utf-8'));
    const connectorsRows = parseCsv(readFileSync(files.connectorsCsvPath, 'utf-8'));
    const supplierPoliciesRows = parseCsv(readFileSync(files.supplierPoliciesCsvPath, 'utf-8'));
    const skuMappingsRows = parseCsv(readFileSync(files.skuMappingsCsvPath, 'utf-8'));

    const catalog = buildCatalogFromRows(
      version,
      profilesRows,
      connectorsRows,
      supplierPoliciesRows,
      skuMappingsRows,
    );

    const validation = validateCatalog(catalog);
    if (!validation.valid) {
      return {
        success: false,
        catalog,
        errors: validation.errors.map((e) => `${e.path}: ${e.message}`),
      };
    }

    return { success: true, catalog, errors: [] };
  } catch (err: any) {
    return { success: false, errors: [err.message] };
  }
}

// ── Main API: build catalog from XLSX file ──────────────────────────────────────

export async function buildCatalogFromXlsxFile(
  version: string,
  xlsxPath: string,
  sheetMap?: { profiles?: string; connectors?: string; supplierPolicies?: string; skuMappings?: string },
): Promise<CatalogEtlResult> {
  if (!existsSync(xlsxPath)) {
    return { success: false, errors: [`XLSX file not found: ${xlsxPath}`] };
  }

  try {
    const sheets = await parseXlsxSheets(xlsxPath);
    const map = {
      profiles: sheetMap?.profiles ?? 'profiles',
      connectors: sheetMap?.connectors ?? 'connectors',
      supplierPolicies: sheetMap?.supplierPolicies ?? 'supplierPolicies',
      skuMappings: sheetMap?.skuMappings ?? 'skuMappings',
    };

    const missingSheets = Object.entries(map)
      .filter(([, name]) => !sheets[name])
      .map(([key, name]) => `${key}: "${name}"`);

    if (missingSheets.length > 0) {
      return {
        success: false,
        errors: [
          `Missing sheet(s) in XLSX: ${missingSheets.join(', ')}. Available: ${Object.keys(sheets).join(', ')}`,
        ],
      };
    }

    const catalog = buildCatalogFromRows(
      version,
      sheets[map.profiles],
      sheets[map.connectors],
      sheets[map.supplierPolicies],
      sheets[map.skuMappings],
    );

    const validation = validateCatalog(catalog);
    if (!validation.valid) {
      return {
        success: false,
        catalog,
        errors: validation.errors.map((e) => `${e.path}: ${e.message}`),
      };
    }

    return { success: true, catalog, errors: [] };
  } catch (err: any) {
    return { success: false, errors: [err.message] };
  }
}

// ── Output helpers ──────────────────────────────────────────────────────────────

export function writeCanonicalJson(catalog: CatalogFixture, outputPath: string): void {
  writeFileSync(outputPath, JSON.stringify(catalog, null, 2) + '\n', 'utf-8');
}

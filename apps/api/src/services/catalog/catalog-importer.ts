// Catalog importer — CSV/XLSX → canonical CatalogFixture JSON
import type {
  CatalogFixture,
  ProfileSpec,
  ConnectorSpec,
  SupplierPolicyData,
  SkuMappingData,
} from '@profileaxis/stdlib';
import { validateCatalog } from '@profileaxis/schemas/catalog';
import type { ValidationResult } from '@profileaxis/schemas/catalog';

// ── Types ────────────────────────────────────────────────────────────────────────

export type CatalogFormat = 'xlsx' | 'csv';

export interface CatalogImportInput {
  format: CatalogFormat;
  /** Base64-encoded file content */
  data: string;
}

export interface CatalogImportSuccess {
  success: true;
  catalog: CatalogFixture;
  validation: ValidationResult;
  warnings: string[];
}

export interface CatalogImportFailure {
  success: false;
  errors: Array<{ sheet: string; row: number | null; message: string }>;
  warnings: string[];
}

export type CatalogImportResult = CatalogImportSuccess | CatalogImportFailure;

// ── Helpers ───────────────────────────────────────────────────────────────────────

function parseNumeric(value: unknown, fallback: number): number {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const n = Number(value.trim());
    return Number.isFinite(n) ? n : fallback;
  }
  return fallback;
}

function parseOptionalNumeric(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const n = Number(value.trim());
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function parseJsonField(value: unknown, fieldName: string, sheetName: string, rowIndex: number): { result?: unknown; error?: string } {
  if (typeof value === 'object' && value !== null) return { result: value };
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return { result: undefined };
    try {
      return { result: JSON.parse(trimmed) };
    } catch {
      return { error: `${sheetName} row ${rowIndex + 1}: invalid JSON in field "${fieldName}": ${trimmed.substring(0, 80)}` };
    }
  }
  return { error: `${sheetName} row ${rowIndex + 1}: unexpected type for field "${fieldName}"` };
}

// ── Row parsers ──────────────────────────────────────────────────────────────────

function parseProfileRow(row: Record<string, unknown>, sheetName: string, rowIndex: number): { result?: ProfileSpec; error?: string } {
  const pk = String(row.profileKey ?? '').trim();
  if (!pk) return { error: `${sheetName} row ${rowIndex + 1}: missing profileKey` };

  const dimsRaw = parseJsonField(row.dimensions, 'dimensions', sheetName, rowIndex);
  if (dimsRaw.error) return { error: dimsRaw.error };

  const finishRaw = parseJsonField(row.finishOptions, 'finishOptions', sheetName, rowIndex);
  if (finishRaw.error) return { error: finishRaw.error };

  return {
    result: {
      profileKey: pk,
      seriesName: String(row.seriesName ?? '').trim(),
      crossSection: String(row.crossSection ?? '').trim(),
      dimensions: (dimsRaw.result as ProfileSpec['dimensions']) ?? { widthMm: 0, heightMm: 0, wallThicknessMm: 0 },
      material: String(row.material ?? '').trim(),
      weightKgPerM: parseNumeric(row.weightKgPerM, 0),
      loadRatingN: parseNumeric(row.loadRatingN, 0),
      finishOptions: (finishRaw.result as ProfileSpec['finishOptions']) ?? [],
    },
  };
}

function parseConnectorRow(row: Record<string, unknown>, sheetName: string, rowIndex: number): { result?: ConnectorSpec; error?: string } {
  const ck = String(row.connectorKey ?? '').trim();
  if (!ck) return { error: `${sheetName} row ${rowIndex + 1}: missing connectorKey` };

  const cpkRaw = parseJsonField(row.compatibleProfileKeys, 'compatibleProfileKeys', sheetName, rowIndex);
  if (cpkRaw.error) return { error: cpkRaw.error };

  const hwRaw = parseJsonField(row.hardwareItems, 'hardwareItems', sheetName, rowIndex);
  if (hwRaw.error) return { error: hwRaw.error };

  return {
    result: {
      connectorKey: ck,
      connectorFamilyKey: String(row.connectorFamilyKey ?? '').trim(),
      topology: String(row.topology ?? '').trim(),
      compatibleProfileKeys: (cpkRaw.result as string[]) ?? [],
      hardwareItems: (hwRaw.result as ConnectorSpec['hardwareItems']) ?? [],
    },
  };
}

function parseSupplierRow(row: Record<string, unknown>, sheetName: string, rowIndex: number): { result?: SupplierPolicyData; error?: string } {
  const sid = String(row.supplierId ?? '').trim();
  if (!sid) return { error: `${sheetName} row ${rowIndex + 1}: missing supplierId` };

  const notes = row.notes != null && String(row.notes).trim() !== '' ? String(row.notes).trim() : undefined;

  return {
    result: {
      supplierId: sid,
      name: String(row.name ?? '').trim(),
      region: String(row.region ?? '').trim(),
      leadTimeDays: parseNumeric(row.leadTimeDays, 0),
      minOrderQty: parseNumeric(row.minOrderQty, 0),
      packRounding: parseNumeric(row.packRounding, 1),
      currency: String(row.currency ?? '').trim(),
      paymentTerms: String(row.paymentTerms ?? '').trim(),
      ...(notes ? { notes } : {}),
    },
  };
}

function parseSkuMappingRow(row: Record<string, unknown>, sheetName: string, rowIndex: number): { result?: SkuMappingData; error?: string } {
  const tbs = String(row.tradeBomSku ?? '').trim();
  if (!tbs) return { error: `${sheetName} row ${rowIndex + 1}: missing tradeBomSku` };

  return {
    result: {
      profileSpecKey: String(row.profileSpecKey ?? '').trim(),
      connectorSpecKey: String(row.connectorSpecKey ?? '').trim(),
      tradeBomSku: tbs,
      tradeBomDesc: String(row.tradeBomDesc ?? '').trim(),
      unitCost: parseNumeric(row.unitCost, 0),
      currency: String(row.currency ?? '').trim(),
      unit: String(row.unit ?? '').trim(),
      lengthMm: parseOptionalNumeric(row.lengthMm),
    },
  };
}

// ── Main import logic ─────────────────────────────────────────────────────────────

export function importCatalog(input: CatalogImportInput): CatalogImportResult {
  const warnings: string[] = [];
  const errors: Array<{ sheet: string; row: number | null; message: string }> = [];

  let workbook: {
    SheetNames: string[];
    Sheets: Record<string, unknown>;
  };

  try {
    const XLSX = loadXlsx();

    if (input.format === 'csv') {
      // CSV: decode base64 to UTF-8 string, parse with xlsx string mode
      const csvString = Buffer.from(input.data, 'base64').toString('utf-8');
      if (csvString.length === 0) {
        return {
          success: false,
          errors: [{ sheet: '', row: null, message: 'Invalid base64 data: decoded CSV is empty' }],
          warnings: [],
        };
      }
      workbook = XLSX.read(csvString, { type: 'string' });
    } else {
      // XLSX: parse binary buffer
      const buffer = Buffer.from(input.data, 'base64');
      if (buffer.length === 0) {
        return {
          success: false,
          errors: [{ sheet: '', row: null, message: 'Invalid base64 data: decoded buffer is empty' }],
          warnings: [],
        };
      }
      workbook = XLSX.read(buffer, { type: 'buffer' });
    }

    // Validate workbook has at least some sheets (garbage data may parse as empty workbook)
    if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
      return {
        success: false,
        errors: [{ sheet: '', row: null, message: `Invalid ${input.format.toUpperCase()} file: no sheets found in workbook` }],
        warnings: [],
      };
    }
  } catch (err) {
    return {
      success: false,
      errors: [{ sheet: '', row: null, message: `Failed to parse ${input.format.toUpperCase()} file: ${err instanceof Error ? err.message : String(err)}` }],
      warnings: [],
    };
  }

  // Parse each expected sheet
  const profiles = parseSheet(workbook, 'profiles', parseProfileRow, errors, warnings);
  const connectors = parseSheet(workbook, 'connectors', parseConnectorRow, errors, warnings);
  const supplierPolicies = parseSheet(workbook, 'supplierPolicies', parseSupplierRow, errors, warnings);
  const skuMappings = parseSheet(workbook, 'skuMappings', parseSkuMappingRow, errors, warnings);

  if (errors.length > 0) {
    return { success: false, errors, warnings };
  }

  // Validate at least one sheet has actual data (catches garbage XLSX that parses as empty).
  // CSV format produces a single unnamed sheet that won't match named sheets — empty
  // catalog is valid and passes schema validation; don't reject.
  const totalRows = profiles.length + connectors.length + supplierPolicies.length + skuMappings.length;
  if (totalRows === 0 && input.format === 'xlsx') {
    return {
      success: false,
      errors: [{ sheet: '', row: null, message: 'No valid data found in any sheet of the workbook' }],
      warnings,
    };
  }

  if (totalRows === 0) {
    warnings.push('CSV format produces a single-sheet workbook; no named catalog sheets (profiles/connectors/supplierPolicies/skuMappings) found — resulting catalog will be empty');
  }

  // Warn on empty sheets
  if (profiles.length === 0) warnings.push('Sheet "profiles" is empty');
  if (connectors.length === 0) warnings.push('Sheet "connectors" is empty');
  if (supplierPolicies.length === 0) warnings.push('Sheet "supplierPolicies" is empty');
  if (skuMappings.length === 0) warnings.push('Sheet "skuMappings" is empty');

  const catalog: CatalogFixture = {
    version: 'imported',
    profiles,
    connectors,
    supplierPolicies,
    skuMappings,
  };

  const validation = validateCatalog(catalog);
  if (!validation.valid) {
    return {
      success: false,
      errors: validation.errors.map((e) => ({ sheet: '', row: null, message: `Schema validation: ${e.path}: ${e.message}` })),
      warnings,
    };
  }

  return { success: true, catalog, validation, warnings };
}

// ── Sheet parser ─────────────────────────────────────────────────────────────────

function parseSheet<T>(
  workbook: { SheetNames: string[]; Sheets: Record<string, unknown> },
  sheetName: string,
  parseRow: (row: Record<string, unknown>, sheetName: string, rowIndex: number) => { result?: T; error?: string },
  errors: Array<{ sheet: string; row: number | null; message: string }>,
  warnings: string[],
): T[] {
  const XLSX = loadXlsx();

  if (!workbook.SheetNames.includes(sheetName)) {
    warnings.push(`Sheet "${sheetName}" not found in workbook`);
    return [];
  }

  const sheet = workbook.Sheets[sheetName];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const raw = XLSX.utils.sheet_to_json(sheet as any, { defval: '' }) as Record<string, unknown>[];

  if (raw.length === 0) return [];

  const results: T[] = [];
  for (let i = 0; i < raw.length; i++) {
    const { result, error } = parseRow(raw[i], sheetName, i);
    if (error) {
      errors.push({ sheet: sheetName, row: i + 1, message: error });
    } else if (result !== undefined) {
      results.push(result);
    }
  }

  return results;
}

// ── XLSX loader — lazy dynamic import ─────────────────────────────────────────────

let _xlsx: typeof import('xlsx') | null = null;

function loadXlsx(): typeof import('xlsx') {
  if (!_xlsx) {
    throw new Error('xlsx module not loaded — call loadXlsxModule() first');
  }
  return _xlsx;
}

export async function loadXlsxModule(): Promise<void> {
  _xlsx = await import('xlsx');
}

// For testing: inject xlsx module
export function __injectXlsx(mod: typeof import('xlsx')): void {
  _xlsx = mod;
}

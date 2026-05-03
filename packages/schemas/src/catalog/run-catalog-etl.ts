#!/usr/bin/env node
// @profileaxis/schemas — Catalog ETL runner (Gate P1-005)
// Reads CSV (or XLSX) catalog files, normalizes, validates, outputs canonical JSON.

import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import {
  buildCatalogFromCsvFiles,
  buildCatalogFromXlsxFile,
  writeCanonicalJson,
  validateCatalog,
} from './catalog-etl.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES_DIR = resolve(__dirname, 'fixtures');

interface RunResult {
  stage: string;
  pass: boolean;
  detail: string;
}

async function main(): Promise<void> {
  console.log('=== P1-005 Catalog ETL ===\n');

  const results: RunResult[] = [];
  const version = '1.0.0-m1';

  // Step 1: Build catalog from CSV fixtures
  console.log('Step 1: Reading CSV fixtures...\n');
  const csvResult = buildCatalogFromCsvFiles(version, {
    profilesCsvPath: resolve(FIXTURES_DIR, 'profiles.csv'),
    connectorsCsvPath: resolve(FIXTURES_DIR, 'connectors.csv'),
    supplierPoliciesCsvPath: resolve(FIXTURES_DIR, 'supplier-policies.csv'),
    skuMappingsCsvPath: resolve(FIXTURES_DIR, 'sku-mappings.csv'),
  });

  if (!csvResult.success || !csvResult.catalog) {
    console.log('❌ CSV build FAILED:');
    for (const err of csvResult.errors) {
      console.log(`  - ${err}`);
    }
    results.push({ stage: 'CSV build', pass: false, detail: csvResult.errors.join('; ') });
    process.exit(1);
  }

  console.log('✅ CSV build: PASS');
  console.log(`   profiles: ${csvResult.catalog.profiles.length}`);
  console.log(`   connectors: ${csvResult.catalog.connectors.length}`);
  console.log(`   supplierPolicies: ${csvResult.catalog.supplierPolicies.length}`);
  console.log(`   skuMappings: ${csvResult.catalog.skuMappings.length}`);
  results.push({
    stage: 'CSV build',
    pass: true,
    detail: `${csvResult.catalog.profiles.length}P/${csvResult.catalog.connectors.length}C/${csvResult.catalog.supplierPolicies.length}SP/${csvResult.catalog.skuMappings.length}SKU`,
  });

  // Step 2: Validate canonical catalog against schema
  console.log('\nStep 2: Validating against catalog schema...\n');
  const validation = validateCatalog(csvResult.catalog);
  if (!validation.valid) {
    console.log('❌ Schema validation FAILED:');
    for (const err of validation.errors) {
      console.log(`  - ${err.path}: ${err.message}`);
    }
    results.push({
      stage: 'Schema validation',
      pass: false,
      detail: validation.errors.map((e) => e.message).join('; '),
    });
    process.exit(1);
  }
  console.log('✅ Schema validation: PASS');
  results.push({ stage: 'Schema validation', pass: true, detail: 'OK' });

  // Step 3: Write canonical JSON (from CSV)
  const outputPath = resolve(FIXTURES_DIR, '..', 'catalog-canonical.json');
  console.log(`\nStep 3: Writing canonical JSON → ${outputPath}\n`);
  writeCanonicalJson(csvResult.catalog, outputPath);
  console.log('✅ Canonical JSON written');
  results.push({ stage: 'Write canonical JSON', pass: true, detail: outputPath });

  // Step 4: Build catalog from XLSX fixture
  console.log('\nStep 4: Reading XLSX fixture...\n');
  const xlsxPath = resolve(FIXTURES_DIR, 'catalog-fixture.xlsx');
  const xlsxResult = await buildCatalogFromXlsxFile(version, xlsxPath);

  if (!xlsxResult.success || !xlsxResult.catalog) {
    console.log('❌ XLSX build FAILED:');
    for (const err of xlsxResult.errors) {
      console.log(`  - ${err}`);
    }
    results.push({ stage: 'XLSX build', pass: false, detail: xlsxResult.errors.join('; ') });
    // XLSX failure is non-fatal if CSV works; continue to summary
  } else {
    console.log('✅ XLSX build: PASS');
    console.log(`   profiles: ${xlsxResult.catalog.profiles.length}`);
    console.log(`   connectors: ${xlsxResult.catalog.connectors.length}`);
    console.log(`   supplierPolicies: ${xlsxResult.catalog.supplierPolicies.length}`);
    console.log(`   skuMappings: ${xlsxResult.catalog.skuMappings.length}`);
    results.push({
      stage: 'XLSX build',
      pass: true,
      detail: `${xlsxResult.catalog.profiles.length}P/${xlsxResult.catalog.connectors.length}C/${xlsxResult.catalog.supplierPolicies.length}SP/${xlsxResult.catalog.skuMappings.length}SKU`,
    });

    // Step 5: Validate XLSX-derived catalog
    console.log('\nStep 5: Validating XLSX-derived catalog...\n');
    const xlsxValidation = validateCatalog(xlsxResult.catalog);
    if (!xlsxValidation.valid) {
      console.log('❌ XLSX schema validation FAILED:');
      for (const err of xlsxValidation.errors) {
        console.log(`  - ${err.path}: ${err.message}`);
      }
      results.push({
        stage: 'XLSX schema validation',
        pass: false,
        detail: xlsxValidation.errors.map((e) => e.message).join('; '),
      });
    } else {
      console.log('✅ XLSX schema validation: PASS');
      results.push({ stage: 'XLSX schema validation', pass: true, detail: 'OK' });
    }

    // Step 6: Cross-validate CSV vs XLSX parity
    console.log('\nStep 6: Cross-validating CSV ↔ XLSX parity...\n');
    const csvJson = JSON.stringify(csvResult.catalog);
    const xlsxJson = JSON.stringify(xlsxResult.catalog);
    if (csvJson === xlsxJson) {
      console.log('✅ CSV ↔ XLSX parity: PASS (identical catalogs)');
      results.push({ stage: 'CSV ↔ XLSX parity', pass: true, detail: 'Identical' });
    } else {
      // Compare field by field for friendlier error messages
      const diffs: string[] = [];
      if (csvResult.catalog.profiles.length !== xlsxResult.catalog.profiles.length) {
        diffs.push(`profile count: CSV=${csvResult.catalog.profiles.length} vs XLSX=${xlsxResult.catalog.profiles.length}`);
      }
      if (csvResult.catalog.connectors.length !== xlsxResult.catalog.connectors.length) {
        diffs.push(`connector count: CSV=${csvResult.catalog.connectors.length} vs XLSX=${xlsxResult.catalog.connectors.length}`);
      }
      if (csvResult.catalog.supplierPolicies.length !== xlsxResult.catalog.supplierPolicies.length) {
        diffs.push(`supplier policy count: CSV=${csvResult.catalog.supplierPolicies.length} vs XLSX=${xlsxResult.catalog.supplierPolicies.length}`);
      }
      if (csvResult.catalog.skuMappings.length !== xlsxResult.catalog.skuMappings.length) {
        diffs.push(`SKU mapping count: CSV=${csvResult.catalog.skuMappings.length} vs XLSX=${xlsxResult.catalog.skuMappings.length}`);
      }
      console.log(`❌ CSV ↔ XLSX parity: FAILED — ${diffs.join('; ')}`);
      results.push({ stage: 'CSV ↔ XLSX parity', pass: false, detail: diffs.join('; ') });
    }
  }

  // Summary
  console.log('\n=== P1-005 Summary ===');
  const passed = results.filter((r) => r.pass).length;
  const total = results.length;
  console.log(`${passed}/${total} stages passed`);

  if (passed < total) {
    console.log('\n❌ P1-005 FAILED');
    process.exit(1);
  }
  console.log('\n✅ P1-005 Catalog ETL PASS. Canonical JSON produced and validated.');
  process.exit(0);
}

main().catch((e) => {
  console.error('Catalog ETL runner error:', e);
  process.exit(1);
});

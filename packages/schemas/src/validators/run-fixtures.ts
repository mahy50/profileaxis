#!/usr/bin/env node
// @profileaxis/schemas - Fixture validation runner
// Gate P0-002 automatic check: all fixtures pass validator

import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES_DIR = resolve(__dirname, '../fixtures');

// Import validators - need to build first
async function main() {
  console.log('=== P0-002 Fixture Validation ===\n');

  const results: Array<{ name: string; pass: boolean; errors?: string[] }> = [];

  // Dynamic import of compiled validator
  let validator: any;
  try {
    const validatorPath = resolve(__dirname, './validator.js');
    validator = await import(validatorPath);
  } catch (e) {
    console.error('ERROR: Validator not built. Run "pnpm build" first in packages/schemas');
    process.exit(1);
  }

  const fixtures = [
    { name: 'intent-dsl.fixture.json', fn: validator.validateIntent },
    { name: 'confirmation-dsl.fixture.json', fn: validator.validateConfirmation },
    { name: 'draft-dsl.fixture.json', fn: validator.validateDraft },
    { name: 'resolved-dsl.fixture.json', fn: validator.validateResolved },
  ];

  for (const fixture of fixtures) {
    try {
      const data = JSON.parse(readFileSync(resolve(FIXTURES_DIR, fixture.name), 'utf-8'));
      const result = fixture.fn(data);
      if (result.valid) {
        console.log(`✅ ${fixture.name}: PASS`);
        results.push({ name: fixture.name, pass: true });
      } else {
        const errors = result.errors.map((e: any) => `  - ${e.path}: ${e.message}`).join('\n');
        console.log(`❌ ${fixture.name}: FAIL\n${errors}`);
        results.push({ name: fixture.name, pass: false, errors: result.errors.map((e: any) => e.message) });
      }
    } catch (e: any) {
      console.log(`❌ ${fixture.name}: ERROR - ${e.message}`);
      results.push({ name: fixture.name, pass: false, errors: [e.message] });
    }
  }

  console.log('\n=== Summary ===');
  const passed = results.filter((r) => r.pass).length;
  const total = results.length;
  console.log(`${passed}/${total} fixtures passed`);

  if (passed < total) {
    process.exit(1);
  }
  console.log('\n✅ All fixtures passed. Gate P0-002 automatic checks PASS.');
  process.exit(0);
}

main().catch((e) => {
  console.error('Fixture runner error:', e);
  process.exit(1);
});

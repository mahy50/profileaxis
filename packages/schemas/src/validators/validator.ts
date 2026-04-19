// @profileaxis/schemas - Runtime JSON Schema validator
// Uses Ajv for JSON Schema draft-07 validation

import Ajv, { ValidateFunction } from 'ajv';
import addFormats from 'ajv-formats';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SCHEMAS_DIR = resolve(__dirname, '../dsl');
const API_DIR = resolve(__dirname, '../api');

// Load schemas
const intentDslSchema = JSON.parse(readFileSync(resolve(SCHEMAS_DIR, 'intent-dsl.schema.json'), 'utf-8'));
const confirmationDslSchema = JSON.parse(readFileSync(resolve(SCHEMAS_DIR, 'confirmation-dsl.schema.json'), 'utf-8'));
const draftDslSchema = JSON.parse(readFileSync(resolve(SCHEMAS_DIR, 'draft-dsl.schema.json'), 'utf-8'));
const resolvedDslSchema = JSON.parse(readFileSync(resolve(SCHEMAS_DIR, 'resolved-dsl.schema.json'), 'utf-8'));
const intentApiSchema = JSON.parse(readFileSync(resolve(API_DIR, 'intent.schema.json'), 'utf-8'));
const draftApiSchema = JSON.parse(readFileSync(resolve(API_DIR, 'draft.schema.json'), 'utf-8'));

// Initialize Ajv with formats (date-time, uri, etc.)
const ajv = new Ajv({ allErrors: true, strict: false });
addFormats(ajv);

// Compile validators
const validateIntentDsl: ValidateFunction = ajv.compile(intentDslSchema);
const validateConfirmationDsl: ValidateFunction = ajv.compile(confirmationDslSchema);
const validateDraftDsl: ValidateFunction = ajv.compile(draftDslSchema);
const validateResolvedDsl: ValidateFunction = ajv.compile(resolvedDslSchema);

export interface ValidationResult {
  valid: boolean;
  errors: Array<{ path: string; message: string }>;
}

function formatErrors(validateFn: ValidateFunction): ValidationResult {
  if (validateFn.errors) {
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

export function validateIntent(data: unknown): ValidationResult {
  const valid = validateIntentDsl(data);
  return formatErrors(validateIntentDsl);
}

export function validateConfirmation(data: unknown): ValidationResult {
  const valid = validateConfirmationDsl(data);
  return formatErrors(validateConfirmationDsl);
}

export function validateDraft(data: unknown): ValidationResult {
  const valid = validateDraftDsl(data);
  return formatErrors(validateDraftDsl);
}

export function validateResolved(data: unknown): ValidationResult {
  const valid = validateResolvedDsl(data);
  return formatErrors(validateResolvedDsl);
}

export { validateIntentDsl, validateConfirmationDsl, validateDraftDsl, validateResolvedDsl };

// Catalog validator — re-exports from @profileaxis/schemas
import { validateCatalog } from '@profileaxis/schemas/catalog';
import type { ValidationResult } from '@profileaxis/schemas/catalog';

export type CatalogValidationResult = ValidationResult;

export const validateCatalogFixture = validateCatalog;

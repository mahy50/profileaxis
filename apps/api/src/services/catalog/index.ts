// Catalog service — CSV/XLSX import + validation
export { importCatalog, loadXlsxModule, __injectXlsx } from './catalog-importer.js';
export type {
  CatalogFormat,
  CatalogImportInput,
  CatalogImportResult,
  CatalogImportSuccess,
  CatalogImportFailure,
} from './catalog-importer.js';
export { validateCatalogFixture } from './catalog-validator.js';
export type { CatalogValidationResult } from './catalog-validator.js';

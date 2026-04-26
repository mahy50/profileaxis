// @profileaxis/export - SVG three-view, CSV, PDF payload
// No apps/web dependencies. Source of truth = resolvedDsl

// SVG exports
export type { ThreeViewSvg, SvgDimension, DimensionViewModel } from './svg/index.js';
export { generateThreeViewSvg } from './svg/index.js';

// PDF payload exports
export type { PdfPayload, PdfMetadata, ProjectInfo } from './pdf-payload/index.js';
export { buildPdfPayload, buildMinimalPdfPayload } from './pdf-payload/index.js';

// Re-exports for convenience
import type { ResolvedDsl } from '@profileaxis/domain';
import type { BomSummary } from '@profileaxis/bom';
import type { ThreeViewSvg } from './svg/index.js';
import type { DimensionViewModel } from './svg/index.js';
import type { PdfPayload } from './pdf-payload/index.js';
import { buildPdfPayload, buildMinimalPdfPayload } from './pdf-payload/index.js';
import { generateThreeViewSvg } from './svg/index.js';

/**
 * Convenience: generate three-view SVG for a resolvedDsl
 * with a default DimensionViewModel derived from overallSizeMm.
 */
export function generateThreeViewFromResolved(
  resolved: ResolvedDsl,
  bayWidths?: number[],
  levelHeights?: number[]
): ThreeViewSvg {
  const dimVm: DimensionViewModel = {
    overallWidth: resolved.overallSizeMm.width,
    overallDepth: resolved.overallSizeMm.depth,
    overallHeight: resolved.overallSizeMm.height,
    bayWidths: bayWidths ?? [resolved.overallSizeMm.width],
    levelHeights: levelHeights ?? [resolved.overallSizeMm.height],
  };
  return generateThreeViewSvg(resolved, dimVm);
}

/**
 * Convenience: build full PDF payload from resolvedDsl + BOM.
 */
export function buildPdfPayloadFromResolved(
  projectName: string,
  resolved: ResolvedDsl,
  bom: BomSummary,
  threeViewSvg: ThreeViewSvg,
  stdlibVersion: string,
  ruleVersion: string,
  catalogVersion: string
): PdfPayload {
  return buildPdfPayload(
    projectName,
    resolved,
    bom,
    stdlibVersion,
    ruleVersion,
    catalogVersion,
    threeViewSvg
  );
}
// @profileaxis/export/pdf-payload - PDF payload builder
// No apps/web dependencies

import type { ResolvedDsl } from '@profileaxis/domain';
import type { BomSummary } from '@profileaxis/bom';
import type { ThreeViewSvg } from '../svg/index.js';

export interface PdfPayload {
  projectName: string;
  dslVersion: string;
  threeViewSvg: ThreeViewSvg;
  bomSummaryCsv: string;
  metadata: PdfMetadata;
  projectInfo: ProjectInfo;
}

export interface PdfMetadata {
  stdlibVersion: string;
  ruleVersion: string;
  catalogVersion: string;
  generatedAt: string;
}

export interface ProjectInfo {
  projectId: string;
  projectName: string;
  overallSizeMm: { width: number; depth: number; height: number };
  nodeCount: number;
  jointCount: number;
  moduleCount: number;
}

/**
 * Build a PDF payload from resolvedDsl and BOM results.
 * This payload is consumed by apps/api for actual PDF rendering.
 */
export function buildPdfPayload(
  projectName: string,
  resolved: ResolvedDsl,
  bom: BomSummary,
  stdlibVersion: string,
  ruleVersion: string,
  catalogVersion: string,
  threeViewSvg: ThreeViewSvg
): PdfPayload {
  return {
    projectName,
    dslVersion: resolved.dslVersion,
    threeViewSvg,
    bomSummaryCsv: buildBomCsv(resolved, bom),
    metadata: {
      stdlibVersion,
      ruleVersion,
      catalogVersion,
      generatedAt: new Date().toISOString(),
    },
    projectInfo: {
      projectId: resolved.sourceRevisionId ?? 'unknown',
      projectName,
      overallSizeMm: resolved.overallSizeMm,
      nodeCount: resolved.nodes.length,
      jointCount: resolved.joints.length,
      moduleCount: resolved.modules.length,
    },
  };
}

/**
 * Build a BOM summary CSV from resolvedDsl and BomSummary.
 */
function buildBomCsv(resolved: ResolvedDsl, bom: BomSummary): string {
  const lines: string[] = [];

  // BOM Summary section
  lines.push('# BOM Summary');
  lines.push(`Design Coverage: ${(bom.designCoverage * 100).toFixed(1)}%`);
  lines.push(`Trade Coverage: ${(bom.tradeCoverage * 100).toFixed(1)}%`);
  lines.push('');
  lines.push('Type,Item,Specification,Quantity,Unit,Mapping Status');

  // Design BOM items
  for (const item of bom.designBom) {
    lines.push([
      'design',
      `"${item.role}"`,
      item.profileSpecKey ?? item.connectorSpecKey ?? '',
      item.quantity.toString(),
      item.lengthMm !== null ? `${item.lengthMm} mm` : 'EA',
      item.mappingStatus,
    ].join(','));
  }

  // Trade BOM items
  for (const item of bom.tradeBom) {
    lines.push([
      'trade',
      `"${item.sku}"`,
      item.supplierId,
      item.quantity.toString(),
      `${item.unitPrice} ${item.totalCost > 0 ? `(total: ${item.totalCost})` : ''}`,
      item.mappingStatus,
    ].join(','));
  }

  return lines.join('\n');
}

/**
 * Build a minimal PDF payload when BOM is not yet available.
 */
export function buildMinimalPdfPayload(
  projectName: string,
  resolved: ResolvedDsl,
  threeViewSvg: ThreeViewSvg
): PdfPayload {
  return {
    projectName,
    dslVersion: resolved.dslVersion,
    threeViewSvg,
    bomSummaryCsv: '',
    metadata: {
      stdlibVersion: '',
      ruleVersion: '',
      catalogVersion: '',
      generatedAt: new Date().toISOString(),
    },
    projectInfo: {
      projectId: resolved.sourceRevisionId ?? 'unknown',
      projectName,
      overallSizeMm: resolved.overallSizeMm,
      nodeCount: resolved.nodes.length,
      jointCount: resolved.joints.length,
      moduleCount: resolved.modules.length,
    },
  };
}
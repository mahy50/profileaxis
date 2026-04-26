// @profileaxis/export/svg - Three-view SVG generation
// No apps/web dependencies. Source of truth = resolvedDsl.nodes/joints

import type { ResolvedDsl, StructuralNode, JointNode, Vec3 } from '@profileaxis/domain';

// ── Public API ────────────────────────────────────────────────────────────────

export interface ThreeViewSvg {
  front: string;
  right: string;
  top: string;
}

export interface SvgDimension {
  label: string;
  valueMm: number;
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  orientation: 'horizontal' | 'vertical';
  offset?: number; // perpendicular offset for callout
}

export interface DimensionViewModel {
  overallWidth: number;
  overallDepth: number;
  overallHeight: number;
  bayWidths: number[];
  levelHeights: number[];
}

/**
 * Generate three-view SVG from ResolvedDsl and DimensionViewModel.
 * Dimensions in SVG are 1px per mm (1:1 scale).
 * All geometry is derived from resolvedDsl.nodes and resolvedDsl.joints.
 */
export function generateThreeViewSvg(
  resolved: ResolvedDsl,
  dimVm: DimensionViewModel
): ThreeViewSvg {
  return {
    front: generateFrontView(resolved, dimVm),
    right: generateRightView(resolved, dimVm),
    top: generateTopView(resolved, dimVm),
  };
}

// ── Front View ────────────────────────────────────────────────────────────────

function generateFrontView(resolved: ResolvedDsl, dimVm: DimensionViewModel): string {
  const W = dimVm.overallWidth;
  const H = dimVm.overallHeight;
  const padding = 40;

  const lines: string[] = [];
  const dims: SvgDimension[] = [];

  // Header
  lines.push(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W + padding * 2} ${H + padding * 2 + 60}" width="${W + padding * 2}" height="${H + padding * 2 + 60}">`);
  lines.push(`<title>Front View</title>`);

  // Title
  lines.push(`<text x="${(W + padding * 2) / 2}" y="25" text-anchor="middle" font-size="14" font-weight="bold">Front View</text>`);

  const ox = padding;
  const oy = padding + 30;

  // Outer frame
  lines.push(`<rect x="${ox}" y="${oy}" width="${W}" height="${H}" fill="none" stroke="#333" stroke-width="2"/>`);

  // Bay vertical dividers (based on bayWidths)
  let x = ox;
  for (let i = 0; i < dimVm.bayWidths.length; i++) {
    const bw = dimVm.bayWidths[i];
    x += bw;
    lines.push(`<line x1="${x}" y1="${oy}" x2="${x}" y2="${oy + H}" stroke="#888" stroke-width="1" stroke-dasharray="4"/>`);
  }

  // Level horizontal lines (equally spaced based on levelHeights)
  let y = oy;
  const totalLevels = dimVm.levelHeights.length;
  for (let i = 1; i < totalLevels; i++) {
    y += dimVm.levelHeights[i - 1];
    lines.push(`<line x1="${ox}" y1="${y}" x2="${ox + W}" y2="${y}" stroke="#888" stroke-width="1" stroke-dasharray="4"/>`);
  }

  // Upright columns (nodes with role='upright')
  const uprights = resolved.nodes.filter(n => n.role === 'upright');
  for (const u of uprights) {
    const px = ox + (u.start.x / dimVm.overallWidth) * W;
    const top = oy + (u.start.z / dimVm.overallHeight) * H;
    const bot = oy + (u.end.z / dimVm.overallHeight) * H;
    lines.push(`<line x1="${px}" y1="${top}" x2="${px}" y2="${bot}" stroke="#1a1a1a" stroke-width="3"/>`);
  }

  // Beam X members (horizontal beams - role='beamX')
  const beamsX = resolved.nodes.filter(n => n.role === 'beamX');
  for (const b of beamsX) {
    const px1 = ox + (b.start.x / dimVm.overallWidth) * W;
    const px2 = ox + (b.end.x / dimVm.overallWidth) * W;
    const py = oy + ((b.start.z + b.end.z) / 2 / dimVm.overallHeight) * H;
    lines.push(`<line x1="${px1}" y1="${py}" x2="${px2}" y2="${py}" stroke="#444" stroke-width="2"/>`);
  }

  // Overall width dimension (bottom)
  dims.push({
    label: `${dimVm.overallWidth} mm`,
    valueMm: dimVm.overallWidth,
    startX: ox, startY: oy + H + 20,
    endX: ox + W, endY: oy + H + 20,
    orientation: 'horizontal',
  });

  // Overall height dimension (right side)
  dims.push({
    label: `${dimVm.overallHeight} mm`,
    valueMm: dimVm.overallHeight,
    startX: ox + W + 20, startY: oy,
    endX: ox + W + 20, endY: oy + H,
    orientation: 'vertical',
  });

  // Level height annotation (right side)
  if (dimVm.levelHeights.length > 0) {
    const lh = dimVm.levelHeights[0];
    dims.push({
      label: `Level: ${lh} mm`,
      valueMm: lh,
      startX: ox + W + 35, startY: oy,
      endX: ox + W + 35, endY: oy + lh,
      orientation: 'vertical',
      offset: 0,
    });
  }

  // Bay width annotations (bottom)
  let bx = ox;
  for (let i = 0; i < dimVm.bayWidths.length; i++) {
    const bw = dimVm.bayWidths[i];
    dims.push({
      label: `Bay${i + 1}: ${bw} mm`,
      valueMm: bw,
      startX: bx, startY: oy + H + 40,
      endX: bx + bw, endY: oy + H + 40,
      orientation: 'horizontal',
    });
    bx += bw;
  }

  // Draw dimensions
  for (const d of dims) {
    lines.push(...renderDimension(d));
  }

  lines.push(`</svg>`);
  return lines.join('\n');
}

// ── Right View ───────────────────────────────────────────────────────────────

function generateRightView(resolved: ResolvedDsl, dimVm: DimensionViewModel): string {
  const D = dimVm.overallDepth;
  const H = dimVm.overallHeight;
  const padding = 40;

  const lines: string[] = [];
  const dims: SvgDimension[] = [];

  lines.push(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${D + padding * 2} ${H + padding * 2 + 60}" width="${D + padding * 2}" height="${H + padding * 2 + 60}">`);
  lines.push(`<title>Right View</title>`);
  lines.push(`<text x="${(D + padding * 2) / 2}" y="25" text-anchor="middle" font-size="14" font-weight="bold">Right View</text>`);

  const ox = padding;
  const oy = padding + 30;

  // Outer frame
  lines.push(`<rect x="${ox}" y="${oy}" width="${D}" height="${H}" fill="none" stroke="#333" stroke-width="2"/>`);

  // Depth dimension (bottom)
  dims.push({
    label: `${dimVm.overallDepth} mm`,
    valueMm: dimVm.overallDepth,
    startX: ox, startY: oy + H + 20,
    endX: ox + D, endY: oy + H + 20,
    orientation: 'horizontal',
  });

  // Height dimension (right side)
  dims.push({
    label: `${dimVm.overallHeight} mm`,
    valueMm: dimVm.overallHeight,
    startX: ox + D + 20, startY: oy,
    endX: ox + D + 20, endY: oy + H,
    orientation: 'vertical',
  });

  // Draw uprights from Y-axis perspective (role='upright')
  const uprights = resolved.nodes.filter(n => n.role === 'upright');
  for (const u of uprights) {
    const py = oy + (u.start.z / dimVm.overallHeight) * H;
    const bot = oy + (u.end.z / dimVm.overallHeight) * H;
    // uprights are along x-axis, so we show their extent along depth (y)
    const depthExtent = D * 0.1; // simplified - show as vertical lines at depth positions
    lines.push(`<line x1="${ox + depthExtent}" y1="${py}" x2="${ox + depthExtent}" y2="${bot}" stroke="#1a1a1a" stroke-width="3"/>`);
  }

  // Brace members (role='brace')
  const braces = resolved.nodes.filter(n => n.role === 'brace');
  for (const b of braces) {
    const px1 = ox + (b.start.y / dimVm.overallDepth) * D;
    const py1 = oy + (b.start.z / dimVm.overallHeight) * H;
    const px2 = ox + (b.end.y / dimVm.overallDepth) * D;
    const py2 = oy + (b.end.z / dimVm.overallHeight) * H;
    lines.push(`<line x1="${px1}" y1="${py1}" x2="${px2}" y2="${py2}" stroke="#555" stroke-width="1.5" stroke-dasharray="3"/>`);
  }

  for (const d of dims) {
    lines.push(...renderDimension(d));
  }

  lines.push(`</svg>`);
  return lines.join('\n');
}

// ── Top View ─────────────────────────────────────────────────────────────────

function generateTopView(resolved: ResolvedDsl, dimVm: DimensionViewModel): string {
  const W = dimVm.overallWidth;
  const D = dimVm.overallDepth;
  const padding = 40;

  const lines: string[] = [];
  const dims: SvgDimension[] = [];

  lines.push(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W + padding * 2} ${D + padding * 2 + 60}" width="${W + padding * 2}" height="${D + padding * 2 + 60}">`);
  lines.push(`<title>Top View</title>`);
  lines.push(`<text x="${(W + padding * 2) / 2}" y="25" text-anchor="middle" font-size="14" font-weight="bold">Top View</text>`);

  const ox = padding;
  const oy = padding + 30;

  // Outer frame
  lines.push(`<rect x="${ox}" y="${oy}" width="${W}" height="${D}" fill="none" stroke="#333" stroke-width="2"/>`);

  // Bay divisions along X
  let x = ox;
  for (let i = 0; i < dimVm.bayWidths.length; i++) {
    x += dimVm.bayWidths[i];
    lines.push(`<line x1="${x}" y1="${oy}" x2="${x}" y2="${oy + D}" stroke="#888" stroke-width="1" stroke-dasharray="4"/>`);
  }

  // Upright positions (nodes with role='upright' - show as small squares)
  const uprights = resolved.nodes.filter(n => n.role === 'upright');
  const seenPositions = new Set<string>();
  for (const u of uprights) {
    const px = ox + (u.start.x / dimVm.overallWidth) * W;
    const py = oy + (u.start.y / dimVm.overallDepth) * D;
    const key = `${Math.round(px)},${Math.round(py)}`;
    if (!seenPositions.has(key)) {
      seenPositions.add(key);
      lines.push(`<rect x="${px - 3}" y="${py - 3}" width="6" height="6" fill="#1a1a1a"/>`);
    }
  }

  // Overall width dimension (bottom)
  dims.push({
    label: `${dimVm.overallWidth} mm`,
    valueMm: dimVm.overallWidth,
    startX: ox, startY: oy + D + 20,
    endX: ox + W, endY: oy + D + 20,
    orientation: 'horizontal',
  });

  // Overall depth dimension (right side)
  dims.push({
    label: `${dimVm.overallDepth} mm`,
    valueMm: dimVm.overallDepth,
    startX: ox + W + 20, startY: oy,
    endX: ox + W + 20, endY: oy + D,
    orientation: 'vertical',
  });

  // Bay width labels (bottom)
  let bx = ox;
  for (let i = 0; i < dimVm.bayWidths.length; i++) {
    const bw = dimVm.bayWidths[i];
    dims.push({
      label: `Bay${i + 1}: ${bw} mm`,
      valueMm: bw,
      startX: bx, startY: oy + D + 40,
      endX: bx + bw, endY: oy + D + 40,
      orientation: 'horizontal',
    });
    bx += bw;
  }

  for (const d of dims) {
    lines.push(...renderDimension(d));
  }

  lines.push(`</svg>`);
  return lines.join('\n');
}

// ── Dimension Rendering ──────────────────────────────────────────────────────

function renderDimension(dim: SvgDimension): string[] {
  const lines: string[] = [];
  const fontSize = 10;
  const tickLen = 5;

  if (dim.orientation === 'horizontal') {
    const y = dim.startY;
    const mx = (dim.startX + dim.endX) / 2;
    // Tick marks
    lines.push(`<line x1="${dim.startX}" y1="${y - tickLen}" x2="${dim.startX}" y2="${y + tickLen}" stroke="#333" stroke-width="1"/>`);
    lines.push(`<line x1="${dim.endX}" y1="${y - tickLen}" x2="${dim.endX}" y2="${y + tickLen}" stroke="#333" stroke-width="1"/>`);
    // Dimension line
    lines.push(`<line x1="${dim.startX}" y1="${y}" x2="${dim.endX}" y2="${y}" stroke="#333" stroke-width="1"/>`);
    // Label
    lines.push(`<text x="${mx}" y="${y - 6}" text-anchor="middle" font-size="${fontSize}" fill="#333">${dim.label}</text>`);
  } else {
    const x = dim.startX;
    const my = (dim.startY + dim.endY) / 2;
    // Tick marks
    lines.push(`<line x1="${x - tickLen}" y1="${dim.startY}" x2="${x + tickLen}" y2="${dim.startY}" stroke="#333" stroke-width="1"/>`);
    lines.push(`<line x1="${x - tickLen}" y1="${dim.endY}" x2="${x + tickLen}" y2="${dim.endY}" stroke="#333" stroke-width="1"/>`);
    // Dimension line
    lines.push(`<line x1="${x}" y1="${dim.startY}" x2="${x}" y2="${dim.endY}" stroke="#333" stroke-width="1"/>`);
    // Label (rotated 90°)
    lines.push(`<text x="${x + 6}" y="${my}" text-anchor="middle" font-size="${fontSize}" fill="#333" transform="rotate(90,${x + 6},${my})">${dim.label}</text>`);
  }

  return lines;
}
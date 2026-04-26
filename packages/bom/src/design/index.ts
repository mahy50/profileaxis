// @profileaxis/bom/design — Design BOM from resolvedDsl

import type { ResolvedDsl } from '@profileaxis/domain';
import type { DesignBomItem, MappingStatus } from '../types.js';

// ── Helpers ───────────────────────────────────────────────────────────────────

let _idCounter = 0;
function uid(prefix: string): string {
  return `${prefix}-${++_idCounter}`;
}

/** Pick the best mapping status when merging multiple nodes. */
function mergeStatus(statuses: MappingStatus[]): MappingStatus {
  if (statuses.every(s => s === 'mapped')) return 'mapped';
  if (statuses.every(s => s === 'unmapped')) return 'unmapped';
  return 'ambiguous';
}

// ── Public API ─────────────────────────────────────────────────────────────────

/**
 * Build Design BOM items from a resolved DSL.
 *
 * Strategy:
 * - Structural nodes are grouped by profileSpecKey → one DesignBomItem per group
 * - Joint nodes are grouped by connectorSpecKey → one DesignBomItem per group
 * - lengthMm is the SUM of individual lengths for structural; null for joints
 * - mappingStatus is inferred as unmapped (to be resolved by mapping layer)
 */
export function designBomFromResolvedDsl(resolvedDsl: ResolvedDsl): DesignBomItem[] {
  const items: DesignBomItem[] = [];

  // ── Structural nodes: group by profileSpecKey ──────────────────────────────
  const structuralGroups = new Map<
    string,
    { role: string; lengths: number[]; nodeIds: string[] }
  >();

  for (const node of resolvedDsl.nodes) {
    const key = node.profileSpecKey ?? 'unknown';
    if (!structuralGroups.has(key)) {
      structuralGroups.set(key, { role: node.role, lengths: [], nodeIds: [] });
    }
    const g = structuralGroups.get(key)!;
    g.role = node.role;
    g.lengths.push(node.lengthMm);
    g.nodeIds.push(node.nodeId);
  }

  for (const [profileSpecKey, g] of structuralGroups) {
    const totalLength = g.lengths.reduce((s, l) => s + l, 0);
    items.push({
      id: uid('design-struct'),
      kind: 'structural',
      role: g.role,
      profileSpecKey,
      connectorSpecKey: undefined,
      lengthMm: totalLength,
      quantity: g.nodeIds.length,
      mappingStatus: 'unmapped',
      nodeIds: g.nodeIds,
    });
  }

  // ── Joint nodes: group by connectorSpecKey ─────────────────────────────────
  const jointGroups = new Map<
    string,
    { topology: string; connectorSpecKey: string; jointIds: string[] }
  >();

  for (const joint of resolvedDsl.joints) {
    const key = joint.connectorSpecKey ?? 'unknown';
    if (!jointGroups.has(key)) {
      jointGroups.set(key, {
        topology: joint.topology,
        connectorSpecKey: joint.connectorSpecKey,
        jointIds: [],
      });
    }
    jointGroups.get(key)!.jointIds.push(joint.jointId);
  }

  for (const [, g] of jointGroups) {
    items.push({
      id: uid('design-joint'),
      kind: 'joint',
      role: g.topology,
      profileSpecKey: undefined,
      connectorSpecKey: g.connectorSpecKey,
      lengthMm: null, // joints have no length
      quantity: g.jointIds.length,
      mappingStatus: 'unmapped',
      nodeIds: g.jointIds,
    });
  }

  return items;
}

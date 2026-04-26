// checks/index.ts — Rule-based validation checks on resolvedDsl
// No AI, no LLM — pure deterministic rule evaluation

import type { ResolvedDsl, CheckIssue, NodeId, JointNode, StructuralNode } from '@profileaxis/domain';
import { PROFILES, CONNECTORS } from '@profileaxis/stdlib';

// ── Check Configuration ─────────────────────────────────────────────────────

const MIN_BAY_WIDTH_MM = 500;
const MAX_BAY_WIDTH_MM = 6000;
const MIN_LEVEL_HEIGHT_MM = 100;
const MAX_LEVEL_HEIGHT_MM = 3000;
const MAX_NODES_PER_MODULE = 200;

// Known profile keys from stdlib
const VALID_PROFILE_KEYS = new Set(PROFILES.map(p => p.profileKey));
const VALID_CONNECTOR_KEYS = new Set(CONNECTORS.map(c => c.connectorKey));

// ── Helper: make issue ──────────────────────────────────────────────────────

function makeIssue(
  issueId: string,
  severity: CheckIssue['severity'],
  ruleId: string,
  message: string,
  nodeIds: NodeId[] = [],
  semanticPaths: string[] = [],
  fixSuggestion: string | null = null
): CheckIssue {
  return { issueId, severity, ruleId, message, nodeIds, semanticPaths, fixSuggestion };
}

// ── Helper: extract axis position for overlap checking ──────────────────────
// Only nodes within the same YZ "slice" can overlap on X axis.
// Only nodes within the same XZ "slice" can overlap on Y axis.
// Only nodes within the same XY "slice" can overlap on Z axis.

function getAxisPos(node: StructuralNode, axis: 'x' | 'y' | 'z'): number {
  if (axis === 'x') return node.start.x;
  if (axis === 'y') return node.start.y;
  return node.start.z;
}

// Two nodes on the same axis are only comparable if their other-coord
// positions are within a small epsilon (they're in the same plane)
const PLANE_EPSILON_MM = 1;

function inSamePlane(a: StructuralNode, b: StructuralNode, axis: 'x' | 'y' | 'z'): boolean {
  if (axis === 'x') return Math.abs(a.start.y - b.start.y) < PLANE_EPSILON_MM && Math.abs(a.start.z - b.start.z) < PLANE_EPSILON_MM;
  if (axis === 'y') return Math.abs(a.start.x - b.start.x) < PLANE_EPSILON_MM && Math.abs(a.start.z - b.start.z) < PLANE_EPSILON_MM;
  return Math.abs(a.start.x - b.start.x) < PLANE_EPSILON_MM && Math.abs(a.start.y - b.start.y) < PLANE_EPSILON_MM;
}

// ── Helper: check if nodes overlap on same axis ────────────────────────────
// Only flag real overlaps: same axis, same YZ plane (for X-axis nodes),
// same XZ plane (for Y-axis nodes), same XY plane (for Z-axis nodes)

function checkOverlappingNodes(nodes: StructuralNode[]): CheckIssue[] {
  const issues: CheckIssue[] = [];

  for (const axis of ['x', 'y', 'z'] as const) {
    // Filter nodes on this axis
    const axisNodes = nodes.filter(n => n.axis === axis);

    // Group by plane (Y,Z for X-axis; X,Z for Y-axis; X,Y for Z-axis)
    const planeKey = (n: StructuralNode) => {
      if (axis === 'x') return `${n.start.y.toFixed(1)},${n.start.z.toFixed(1)}`;
      if (axis === 'y') return `${n.start.x.toFixed(1)},${n.start.z.toFixed(1)}`;
      return `${n.start.x.toFixed(1)},${n.start.y.toFixed(1)}`;
    };

    const byPlane = new Map<string, StructuralNode[]>();
    for (const node of axisNodes) {
      const key = planeKey(node);
      const list = byPlane.get(key) ?? [];
      list.push(node);
      byPlane.set(key, list);
    }

    // Within each plane, sort by start position and check overlaps
    for (const [, planeNodes] of byPlane) {
      const sorted = [...planeNodes].sort((a, b) => getAxisPos(a, axis) - getAxisPos(b, axis));

      for (let i = 0; i < sorted.length - 1; i++) {
        const curr = sorted[i];
        const next = sorted[i + 1];

        const getStart = (n: StructuralNode) => getAxisPos(n, axis);
        const getEnd = (n: StructuralNode) =>
          n.axis === 'x' ? n.end.x : n.axis === 'y' ? n.end.y : n.end.z;

        const currEnd = getEnd(curr);
        const nextStart = getStart(next);

        if (currEnd > nextStart) {
          issues.push(makeIssue(
            `CHECK_OVERLAP_${axis}_${i}`,
            'blocker',
            'no-overlap',
            `Node "${curr.semanticPath}" and "${next.semanticPath}" overlap on ${axis}-axis (end ${currEnd.toFixed(0)}mm > start ${nextStart.toFixed(0)}mm)`,
            [curr.nodeId, next.nodeId],
            [curr.semanticPath, next.semanticPath],
            'Adjust node positions to prevent overlap'
          ));
        }
      }
    }
  }

  return issues;
}

// ── Helper: check all joints have compatible connectors ─────────────────────

function checkConnectorCompatibility(joints: JointNode[]): CheckIssue[] {
  const issues: CheckIssue[] = [];

  for (const joint of joints) {
    if (!VALID_CONNECTOR_KEYS.has(joint.connectorSpecKey)) {
      // FOOT-BASE-PLATE and other foot-level connectors may not be in stdlib
      // Downgrade to warning to allow resolver to produce valid structural output
      const isFootTopology = joint.topology === 'foot';
      const severity: CheckIssue['severity'] = isFootTopology ? 'warning' : 'blocker';
      issues.push(makeIssue(
        `CHECK_INVALID_CONNECTOR_${joint.jointId}`,
        severity,
        'connector-compatible',
        `Joint "${joint.semanticPath}" uses unknown connector "${joint.connectorSpecKey}"`,
        joint.memberIds,
        [joint.semanticPath],
        `Use a valid connector key from stdlib`
      ));
    }

    // Check connector family matches topology
    const connectorDef = CONNECTORS.find(c => c.connectorKey === joint.connectorSpecKey);
    if (connectorDef && connectorDef.topology !== joint.topology) {
      issues.push(makeIssue(
        `CHECK_TOPOLOGY_MISMATCH_${joint.jointId}`,
        'warning',
        'connector-compatible',
        `Joint "${joint.semanticPath}" topology "${joint.topology}" does not match connector "${joint.connectorSpecKey}" topology "${connectorDef.topology}"`,
        joint.memberIds,
        [joint.semanticPath],
        null
      ));
    }
  }

  return issues;
}

// ── Helper: check all nodes reference valid profileSpecKeys ───────────────

function checkValidProfileRefs(nodes: StructuralNode[]): CheckIssue[] {
  const issues: CheckIssue[] = [];

  for (const node of nodes) {
    if (!VALID_PROFILE_KEYS.has(node.profileSpecKey)) {
      // CASTER-STD-50 and other foot-module profiles may not be in stdlib
      // Downgrade to warning to allow resolver to produce valid structural output
      const isFootNode = node.role === 'foot';
      const severity: CheckIssue['severity'] = isFootNode ? 'warning' : 'blocker';
      issues.push(makeIssue(
        `CHECK_INVALID_PROFILE_${node.nodeId}`,
        severity,
        'profile-valid',
        `Node "${node.semanticPath}" references unknown profile "${node.profileSpecKey}"`,
        [node.nodeId],
        [node.semanticPath],
        'Use a valid profile key from stdlib'
      ));
    }
  }

  return issues;
}

// ── Helper: check module span within structural limits ─────────────────────

function checkModuleSpan(resolved: ResolvedDsl): CheckIssue[] {
  const issues: CheckIssue[] = [];

  for (const mod of resolved.modules) {
    if (mod.spanMm < MIN_BAY_WIDTH_MM) {
      issues.push(makeIssue(
        `CHECK_BAY_TOO_NARROW_${mod.moduleId}`,
        'blocker',
        'bay-span',
        `Module "${mod.moduleId}" bay width ${mod.spanMm}mm is below minimum ${MIN_BAY_WIDTH_MM}mm`,
        [],
        [`module:${mod.moduleId}`],
        `Increase bay width to at least ${MIN_BAY_WIDTH_MM}mm`
      ));
    }
    if (mod.spanMm > MAX_BAY_WIDTH_MM) {
      issues.push(makeIssue(
        `CHECK_BAY_TOO_WIDE_${mod.moduleId}`,
        'blocker',
        'bay-span',
        `Module "${mod.moduleId}" bay width ${mod.spanMm}mm exceeds maximum ${MAX_BAY_WIDTH_MM}mm`,
        [],
        [`module:${mod.moduleId}`],
        `Reduce bay width to at most ${MAX_BAY_WIDTH_MM}mm`
      ));
    }
  }

  return issues;
}

// ── Helper: check node count within reasonable limits ─────────────────────

function checkNodeCount(nodes: StructuralNode[]): CheckIssue[] {
  const issues: CheckIssue[] = [];

  if (nodes.length > MAX_NODES_PER_MODULE) {
    issues.push(makeIssue(
      'CHECK_TOO_MANY_NODES',
      'warning',
      'node-count',
      `Node count ${nodes.length} exceeds recommended maximum ${MAX_NODES_PER_MODULE}`,
      [],
      [],
      'Consider simplifying the structural layout'
    ));
  }

  return issues;
}

// ── Main check function ─────────────────────────────────────────────────────

/**
 * Run all rule-based validation checks on a resolvedDsl.
 * Returns array of CheckIssue (empty array means all checks passed).
 */
export function check(resolved: ResolvedDsl): CheckIssue[] {
  const issues: CheckIssue[] = [];

  if (!resolved) {
    return [makeIssue(
      'CHECK_NO_RESOLVED_DSL',
      'blocker',
      'input-valid',
      'ResolvedDsl is null or undefined',
      [],
      [],
      'Provide a valid resolvedDsl input'
    )];
  }

  // Check overall size validity
  if (!resolved.overallSizeMm || resolved.overallSizeMm.width <= 0) {
    issues.push(makeIssue(
      'CHECK_INVALID_OVERALL_WIDTH',
      'blocker',
      'overall-size',
      'overallSizeMm.width must be positive',
      [],
      [],
      'Set a positive widthMm in intent'
    ));
  }

  if (!resolved.modules || resolved.modules.length === 0) {
    issues.push(makeIssue(
      'CHECK_NO_MODULES',
      'blocker',
      'module-exists',
      'At least one module is required',
      [],
      [],
      'Define at least one rect-bay module'
    ));
  }

  const nodes = resolved.nodes ?? [];
  const joints = resolved.joints ?? [];

  // Run individual checks
  issues.push(...checkOverlappingNodes(nodes));
  issues.push(...checkConnectorCompatibility(joints));
  issues.push(...checkValidProfileRefs(nodes));
  issues.push(...checkModuleSpan(resolved));
  issues.push(...checkNodeCount(nodes));

  // Check that joints reference valid node IDs
  const nodeIds = new Set(nodes.map(n => n.nodeId));
  for (const joint of joints) {
    for (const memberId of joint.memberIds) {
      if (!nodeIds.has(memberId)) {
        issues.push(makeIssue(
          `CHECK_ORPHAN_JOINT_${joint.jointId}`,
          'blocker',
          'joint-node-ref',
          `Joint "${joint.semanticPath}" references non-existent node "${memberId}"`,
          [joint.jointId],
          [joint.semanticPath],
          'Ensure all memberIds in joints reference valid nodeIds'
        ));
      }
    }
  }

  return issues;
}
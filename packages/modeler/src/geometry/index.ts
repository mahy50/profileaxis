// @profileaxis/modeler/geometry - ResolvedDsl -> geometry primitives
// No Babylon dependencies allowed

import type { Vec3, StructuralNode, JointNode, ResolvedDsl } from '@profileaxis/domain';
import type { BoxGeometry, CylinderGeometry, GeometryPrimitive, ProfileSpec, ConnectorSpec, CatalogBundle, DimensionAnnotation } from '../types.js';

// ── Helpers ───────────────────────────────────────────────────────────────────

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function midPoint(a: Vec3, b: Vec3): Vec3 {
  return { x: lerp(a.x, b.x, 0.5), y: lerp(a.y, b.y, 0.5), z: lerp(a.z, b.z, 0.5) };
}

// ── Profile lookup ────────────────────────────────────────────────────────────

function findProfile(profileKey: string, catalog: CatalogBundle): ProfileSpec | undefined {
  return catalog.profiles.find(p => p.profileKey === profileKey);
}

function findConnector(connectorKey: string, catalog: CatalogBundle): ConnectorSpec | undefined {
  return catalog.connectors.find(c => c.connectorKey === connectorKey);
}

// ── nodeToGeometry ─────────────────────────────────────────────────────────────

/**
 * Convert a StructuralNode to a BoxGeometry.
 * Uses profile cross-section dimensions from stdlib for the section perpendicular to the axis,
 * and node.lengthMm for the along-axis dimension.
 *
 * The box `position` is the center of the member.
 * `rotation` encodes the member's axis direction via Euler angles.
 *
 * The returned geometry id matches node.nodeId so render layers can pick by id.
 */
export function nodeToGeometry(node: StructuralNode, catalog: CatalogBundle): BoxGeometry {
  const profile = findProfile(node.profileSpecKey, catalog);

  // Cross-section dimensions (perpendicular to axis)
  const cw = profile?.dimensions.widthMm ?? 40; // cross-section width
  const ch = profile?.dimensions.heightMm ?? 40; // cross-section height

  // Along-axis dimension = member length
  const length = node.lengthMm;

  // Compute center position (midpoint between start and end)
  const center = midPoint(node.start, node.end);

  // Rotation: align box local Y-axis with the member axis
  // Euler angles (XYZ convention) to rotate (0,1,0) to the node axis direction
  const rotation = axisToEuler(node.axis);

  let size: { x: number; y: number; z: number };

  if (node.axis === 'x') {
    // Member runs along X: box "length" is along X
    size = { x: length, y: ch, z: cw };
  } else if (node.axis === 'y') {
    // Member runs along Y
    size = { x: cw, y: length, z: ch };
  } else {
    // node.axis === 'z'
    size = { x: cw, y: ch, z: length };
  }

  return {
    kind: 'box',
    id: node.nodeId,
    position: center,
    size,
    rotation,
  };
}

/**
 * Convert a JointNode to one or more CylinderGeometry primitives.
 * A connector is represented as a short cylinder at the joint position.
 * Returns an empty array if the connector spec is not found.
 */
export function jointToGeometry(joint: JointNode, catalog: CatalogBundle): GeometryPrimitive[] {
  const connector = findConnector(joint.connectorSpecKey, catalog);
  if (!connector) return [];

  // Represent joint as a short cylinder (bolt cluster visualization)
  // Radius based on connector family: use a fixed reasonable radius per topology
  const radiusByTopology: Record<string, number> = {
    'corner-3way': 15,
    'tee-3way': 15,
    'cross-4way': 18,
    'brace-end': 12,
    'foot': 20,
  };

  const radius = radiusByTopology[joint.topology] ?? 15;
  const height = 8; // short cylinder representing connector thickness

  const cylinder: CylinderGeometry = {
    kind: 'cylinder',
    id: joint.jointId,
    position: joint.position,
    radius,
    height,
    axis: 'y', // connector plates are typically horizontal
  };

  return [cylinder];
}

// ── computeModuleBounds ───────────────────────────────────────────────────────

/**
 * Compute the axis-aligned bounding box for a set of structural nodes.
 * Returns { min, max } in world coordinates.
 */
export function computeModuleBounds(nodes: StructuralNode[]): { min: Vec3; max: Vec3 } {
  if (nodes.length === 0) {
    return { min: { x: 0, y: 0, z: 0 }, max: { x: 0, y: 0, z: 0 } };
  }

  let minX = Infinity, minY = Infinity, minZ = Infinity;
  let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;

  for (const node of nodes) {
    const pts = [node.start, node.end];
    for (const p of pts) {
      if (p.x < minX) minX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.z < minZ) minZ = p.z;
      if (p.x > maxX) maxX = p.x;
      if (p.y > maxY) maxY = p.y;
      if (p.z > maxZ) maxZ = p.z;
    }
  }

  return {
    min: { x: minX, y: minY, z: minZ },
    max: { x: maxX, y: maxY, z: maxZ },
  };
}

// ── computeOverallDimensions ─────────────────────────────────────────────────

/**
 * Annotate the overall external dimensions of the resolved rack.
 * Returns one DimensionAnnotation per axis (width, depth, height).
 */
export function computeOverallDimensions(resolvedDsl: ResolvedDsl): DimensionAnnotation[] {
  const { width, depth, height } = resolvedDsl.overallSizeMm;
  const annotations: DimensionAnnotation[] = [];

  // Width (X axis)
  annotations.push({
    id: 'overall-width',
    start: { x: 0, y: 0, z: 0 },
    end: { x: width, y: 0, z: 0 },
    label: `${width}`,
    unit: 'mm',
  });

  // Depth (Y axis)
  annotations.push({
    id: 'overall-depth',
    start: { x: 0, y: 0, z: 0 },
    end: { x: 0, y: depth, z: 0 },
    label: `${depth}`,
    unit: 'mm',
  });

  // Height (Z axis)
  annotations.push({
    id: 'overall-height',
    start: { x: 0, y: 0, z: 0 },
    end: { x: 0, y: 0, z: height },
    label: `${height}`,
    unit: 'mm',
  });

  return annotations;
}

// ── Internal: axis → Euler rotation ─────────────────────────────────────────

/**
 * Return Euler angles (XYZ, in radians) that rotate the +Y axis to align with `axis`.
 * Used to orient box geometry to match member direction.
 */
function axisToEuler(axis: 'x' | 'y' | 'z'): { x: number; y: number; z: number } {
  // Rotation from (0,1,0) to direction vector
  if (axis === 'x') {
    // +Y -> +X: rotate -90° around Z
    return { x: 0, y: 0, z: -Math.PI / 2 };
  } else if (axis === 'y') {
    // +Y -> +Y: no rotation
    return { x: 0, y: 0, z: 0 };
  } else {
    // axis === 'z': +Y -> +Z: rotate +90° around X
    return { x: Math.PI / 2, y: 0, z: 0 };
  }
}

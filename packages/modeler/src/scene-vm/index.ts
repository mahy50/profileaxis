// @profileaxis/modeler/scene-vm - SceneViewModel construction
// No Babylon dependencies allowed

import type { ResolvedDsl } from '@profileaxis/domain';
import type { SceneViewModel, CatalogBundle, SceneVMOptions } from '../types.js';
import {
  nodeToGeometry,
  jointToGeometry,
  computeOverallDimensions,
} from '../geometry/index.js';

/**
 * Build a pure-data SceneViewModel from a ResolvedDsl.
 *
 * This function is idempotent — calling it twice with the same inputs
 * produces identical output (no random ids, no side effects).
 *
 * The returned SceneViewModel contains NO Babylon Scene instances.
 * Geometry primitives reference node/joint ids from ResolvedDsl so
 * render layers can map back for picking.
 */
export function buildSceneViewModel(
  resolvedDsl: ResolvedDsl,
  catalog: CatalogBundle,
  options: SceneVMOptions = {},
): SceneViewModel {
  const includeDimensionAnnotations = options.includeDimensionAnnotations ?? true;

  const geometryPrimitives = buildGeometryPrimitives(resolvedDsl, catalog);

  const dimensionAnnotations = includeDimensionAnnotations
    ? computeOverallDimensions(resolvedDsl)
    : [];

  const moduleViews = buildModuleViews(resolvedDsl);

  return {
    geometryPrimitives,
    dimensionAnnotations,
    moduleViews,
  };
}

function buildGeometryPrimitives(
  resolvedDsl: ResolvedDsl,
  catalog: CatalogBundle,
) {
  const primitives = [];

  // Structural members -> BoxGeometry
  for (const node of resolvedDsl.nodes) {
    primitives.push(nodeToGeometry(node, catalog));
  }

  // Joints -> CylinderGeometry (connector representations)
  for (const joint of resolvedDsl.joints) {
    primitives.push(...jointToGeometry(joint, catalog));
  }

  return primitives;
}

function buildModuleViews(resolvedDsl: ResolvedDsl) {
  // Group nodeIds and jointIds by moduleId
  const moduleNodeMap = new Map<string, string[]>();
  const moduleJointMap = new Map<string, string[]>();

  for (const node of resolvedDsl.nodes) {
    // Extract moduleId from semanticPath or just use first segment
    const moduleId = resolveModuleId(node.semanticPath);
    if (!moduleNodeMap.has(moduleId)) {
      moduleNodeMap.set(moduleId, []);
    }
    moduleNodeMap.get(moduleId)!.push(node.nodeId);
  }

  for (const joint of resolvedDsl.joints) {
    const moduleId = resolveModuleId(joint.semanticPath);
    if (!moduleJointMap.has(moduleId)) {
      moduleJointMap.set(moduleId, []);
    }
    moduleJointMap.get(moduleId)!.push(joint.jointId);
  }

  // Union of moduleIds from both maps
  const allModuleIds = new Set([...moduleNodeMap.keys(), ...moduleJointMap.keys()]);

  return Array.from(allModuleIds).map(moduleId => ({
    moduleId,
    nodeIds: moduleNodeMap.get(moduleId) ?? [],
    jointIds: moduleJointMap.get(moduleId) ?? [],
  }));
}

/**
 * Derive a moduleId from a semanticPath like "rack.bay[0].level[0].upright[0]".
 * Returns the top-level module identifier (e.g. "bay[0]") or the first path segment.
 */
function resolveModuleId(semanticPath: string): string {
  const segments = semanticPath.split('.');
  if (segments.length >= 2) {
    // Prefer "bay[N]" or "module[N]" style identifiers
    const second = segments[1];
    if (second.startsWith('bay[') || second.startsWith('module[')) {
      return second;
    }
  }
  return segments[0] ?? 'root';
}

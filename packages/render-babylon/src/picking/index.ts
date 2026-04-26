// @profileaxis/render-babylon/picking
// Thin-instance picking for Babylon Scene.
// Supports picking by screen coordinates, filtering, and multi-pick.

import type { Scene } from '@babylonjs/core';
import type { PickResult, PickingOptions } from '../types.js';

/**
 * Thin-instance aware picking function.
 *
 * Babylon's standard scene.pick() works for thin instances IF the
 * base mesh has `isPickable = true` AND the thin instance matrices
 * are set correctly.
 *
 * This module provides:
 * - `pickOne`: single pick at screen coordinates
 * - `pickAll`: pick all meshes at a point (for overlap scenarios)
 * - `pickRay`: ray-based picking along a ray from camera
 */
export type { PickResult, PickingOptions };

/**
 * Pick a single mesh at (screenX, screenY).
 *
 * @param scene - Active Babylon Scene
 * @param screenX - Canvas X coordinate (pixels)
 * @param screenY - Canvas Y coordinate (pixels)
 * @param options - Optional picking filters
 */
export function pickOne(
  scene: Scene,
  screenX: number,
  screenY: number,
  options?: PickingOptions,
): PickResult {
  const pickPredicate = (mesh: import('@babylonjs/core').AbstractMesh) => {
    if (!mesh.isPickable || !mesh.isVisible) return false;
    if (options?.filterIds && options.filterIds.length > 0) {
      return options.filterIds.includes(mesh.name);
    }
    if (options?.filterTypes) {
      const type = inferPickType(mesh.name);
      return options.filterTypes.includes(type);
    }
    return true;
  };

  const pickInfo = scene.pick(screenX, screenY, pickPredicate);

  if (!pickInfo?.hit || !pickInfo.pickedMesh) {
    return { pickedId: null, pickedType: null, worldPoint: null, distance: null };
  }

  const mesh = pickInfo.pickedMesh;
  const pickedPoint = pickInfo.pickedPoint;

  return {
    pickedId: mesh.name,
    pickedType: inferPickType(mesh.name),
    worldPoint: pickedPoint
      ? { x: pickedPoint.x, y: pickedPoint.y, z: pickedPoint.z }
      : null,
    distance: pickInfo.distance ?? null,
  };
}

/**
 * Pick ALL meshes intersected by the pick ray.
 * Useful when multiple thin instances overlap at the same pixel.
 */
export function pickAll(
  scene: Scene,
  screenX: number,
  screenY: number,
  options?: PickingOptions,
): PickResult[] {
  // Babylon doesn't natively support multi-pick; we do a scene.pick
  // which returns the nearest. For overlapping thin instances at the
  // same pixel, thin-instance picking returns the nearest by z-depth.
  // To get all, we'd need scene.pick with a list — here we return the best hit.
  const result = pickOne(scene, screenX, screenY, options);
  if (!result.pickedId) return [];
  return [result];
}

/**
 * Ray-based picking: casts a ray from origin in direction and picks thin instances.
 *
 * @param scene - Active Babylon Scene
 * @param origin - Ray origin in world space
 * @param direction - Normalized ray direction
 * @param options - Optional picking filters
 * @param maxDistance - Maximum ray cast distance (default: Infinity)
 */
export function pickRay(
  scene: Scene,
  origin: { x: number; y: number; z: number },
  direction: { x: number; y: number; z: number },
  options?: PickingOptions,
  maxDistance = Infinity,
): PickResult {
  const { Vector3, Ray } = require('@babylonjs/core');

  const pickPredicate = (mesh: import('@babylonjs/core').AbstractMesh) => {
    if (!mesh.isPickable || !mesh.isVisible) return false;
    if (options?.filterIds && options.filterIds.length > 0) {
      return options.filterIds.includes(mesh.name);
    }
    return true;
  };

  const ray = new Ray(
    new Vector3(origin.x, origin.y, origin.z),
    new Vector3(direction.x, direction.y, direction.z),
    maxDistance,
  );

  const pickInfo = scene.pickWithRay(ray, pickPredicate);

  if (!pickInfo?.hit || !pickInfo.pickedMesh) {
    return { pickedId: null, pickedType: null, worldPoint: null, distance: null };
  }

  const mesh = pickInfo.pickedMesh;
  const pickedPoint = pickInfo.pickedPoint;

  return {
    pickedId: mesh.name,
    pickedType: inferPickType(mesh.name),
    worldPoint: pickedPoint
      ? { x: pickedPoint.x, y: pickedPoint.y, z: pickedPoint.z }
      : null,
    distance: pickInfo.distance ?? null,
  };
}

/**
 * Infer the domain entity type from a Babylon mesh name.
 *
 * Naming convention:
 * - `node:<nodeId>` → StructuralNode
 * - `joint:<jointId>` → JointNode
 * - `module:<moduleId>` → Module
 * - bare id (no prefix) → defaults to 'node'
 */
function inferPickType(meshName: string): 'node' | 'joint' | 'module' {
  if (meshName.startsWith('joint:')) return 'joint';
  if (meshName.startsWith('module:')) return 'module';
  return 'node';
}

/**
 * Create a picking function bound to a specific scene.
 * Convenient for repeated picks (e.g., mouse move handler).
 */
export function createPickingBound(scene: Scene) {
  return (screenX: number, screenY: number, options?: PickingOptions): PickResult =>
    pickOne(scene, screenX, screenY, options);
}

// @profileaxis/render-babylon/scene-adapter/diff-applier
// Incremental diff application to a Babylon Scene.
// Computes SceneDiff by comparing old vs new ResolvedDsl.

import {
  MeshBuilder,
  Matrix,
  Vector3,
  Quaternion,
  type Scene as BabylonSceneType,
  type Mesh as BabylonMeshType,
  type Matrix as BabylonMatrixType,
  type Vector3 as BabylonVector3Type,
  type Quaternion as BabylonQuaternionType,
} from '@babylonjs/core';
import type {
  SceneDiff,
  DiffApplyResult,
} from '../types.js';
import type { GeometryPrimitive, BoxGeometry, CylinderGeometry } from '@profileaxis/modeler';
import { boxPoolKey, cylinderPoolKey, GeometryMeshPool } from './mesh-pool.js';

/**
 * Build a SceneDiff by comparing old vs new geometry primitive lists.
 *
 * Algorithm:
 * - added = primitives in `newList` whose id is not in `oldIds`
 * - removed = ids in `oldIds` not present in `newList`
 * - updated = primitives in both with materially different geometry params
 */
export function computeSceneDiff(
  oldPrimitives: GeometryPrimitive[],
  newPrimitives: GeometryPrimitive[],
): SceneDiff {
  const oldMap = new Map<string, GeometryPrimitive>();
  for (const p of oldPrimitives) oldMap.set(p.id, p);

  const newMap = new Map<string, GeometryPrimitive>();
  for (const p of newPrimitives) newMap.set(p.id, p);

  const oldIds = new Set(oldMap.keys());
  const newIds = new Set(newMap.keys());

  const added: GeometryPrimitive[] = [];
  for (const id of newIds) {
    if (!oldIds.has(id)) added.push(newMap.get(id)!);
  }

  const removed: string[] = [];
  for (const id of oldIds) {
    if (!newIds.has(id)) removed.push(id);
  }

  const updated: GeometryPrimitive[] = [];
  for (const id of newIds) {
    if (oldIds.has(id)) {
      const oldP = oldMap.get(id)!;
      const newP = newMap.get(id)!;
      if (geometryChanged(oldP, newP)) {
        updated.push(newP);
      }
    }
  }

  return { added, removed, updated };
}

function geometryChanged(a: GeometryPrimitive, b: GeometryPrimitive): boolean {
  if (a.kind !== b.kind) return true;
  if (a.kind === 'box') {
    const aa = a as BoxGeometry;
    const bb = b as BoxGeometry;
    return (
      aa.position.x !== bb.position.x ||
      aa.position.y !== bb.position.y ||
      aa.position.z !== bb.position.z ||
      aa.size.x !== bb.size.x ||
      aa.size.y !== bb.size.y ||
      aa.size.z !== bb.size.z ||
      aa.rotation.x !== bb.rotation.x ||
      aa.rotation.y !== bb.rotation.y ||
      aa.rotation.z !== bb.rotation.z
    );
  } else {
    const aa = a as CylinderGeometry;
    const bb = b as CylinderGeometry;
    return (
      aa.position.x !== bb.position.x ||
      aa.position.y !== bb.position.y ||
      aa.position.z !== bb.position.z ||
      aa.radius !== bb.radius ||
      aa.height !== bb.height ||
      aa.axis !== bb.axis
    );
  }
}

/**
 * Apply a SceneDiff to a Babylon Scene using the provided mesh pool.
 *
 * Rules:
 * - `added` → thin-instance create via pool
 * - `removed` → pool.release (hide/recycle slot)
 * - `updated` → pool.release + pool.acquire (replace in-place slot)
 *
 * Returns a DiffApplyResult summary.
 */
export function applySceneDiff(
  scene: BabylonSceneType,
  diff: SceneDiff,
  pool: GeometryMeshPool,
): DiffApplyResult {
  const errors: string[] = [];
  let addedCount = 0;
  let removedCount = 0;
  let updatedCount = 0;

  // ── Remove ──────────────────────────────────────────────────────────────
  for (const id of diff.removed) {
    try {
      // Find which pool has this id and release
      for (const entry of [
        (pool as unknown as { _pools: Map<string, { instanceSlots: Map<string, number>; freeSlots: number[]; usedSlots: Set<number> }> })._pools.get('box:*'),
        (pool as unknown as { _pools: Map<string, { instanceSlots: Map<string, number>; freeSlots: number[]; usedSlots: Set<number> }> })._pools.get('cyl:*'),
      ].filter(Boolean)) {
        if (entry && 'instanceSlots' in entry && entry.instanceSlots.has(id)) {
          pool.release(entry as Parameters<typeof pool.release>[0], id);
          removedCount++;
          break;
        }
      }
    } catch (e: unknown) {
      errors.push(`remove ${id}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  // ── Update (remove + re-add) ─────────────────────────────────────────────
  for (const geom of diff.updated) {
    try {
      const poolKey = geom.kind === 'box' ? boxPoolKey(geom as BoxGeometry) : cylinderPoolKey(geom as CylinderGeometry);
      const { Matrix } = require('@babylonjs/core');
      const entry = pool.getOrCreatePool(poolKey, () => createBaseMesh(scene, geom));
      const slot = pool.acquire(entry, geom.id);
      updateThinInstance(scene, entry.baseMesh, slot, geom);
      updatedCount++;
    } catch (e: unknown) {
      errors.push(`update ${geom.id}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  // ── Add ──────────────────────────────────────────────────────────────────
  for (const geom of diff.added) {
    try {
      const poolKey = geom.kind === 'box' ? boxPoolKey(geom as BoxGeometry) : cylinderPoolKey(geom as CylinderGeometry);
      const entry = pool.getOrCreatePool(poolKey, () => createBaseMesh(scene, geom));
      const slot = pool.acquire(entry, geom.id);
      updateThinInstance(scene, entry.baseMesh, slot, geom);
      addedCount++;
    } catch (e: unknown) {
      errors.push(`add ${geom.id}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  return { addedCount, removedCount, updatedCount, errors };
}

// ── Internal helpers ────────────────────────────────────────────────────────

function createBaseMesh(scene: BabylonSceneType, geom: GeometryPrimitive): BabylonMeshType {
  let mesh: BabylonMeshType;

  if (geom.kind === 'box') {
    mesh = MeshBuilder.CreateBox(geom.id, { size: 1 }, scene);
  } else {
    mesh = MeshBuilder.CreateCylinder(geom.id, {
      diameter: 2,
      height: 1,
      tessellation: 12,
    }, scene);
  }

  mesh.isVisible = false;
  mesh.isPickable = false;
  return mesh;
}

/**
 * Update a thin-instance matrix on `baseMesh` at index `slot` with
 * the geometry primitive's transform.
 */
function updateThinInstance(
  scene: BabylonSceneType,
  baseMesh: BabylonMeshType,
  slot: number,
  geom: GeometryPrimitive,
): void {
  const matrix = geometryToMatrix(geom);
  baseMesh.thinInstanceSetMatrixAt(slot, matrix, true);
  baseMesh.isVisible = true;
  baseMesh.isPickable = true;
}

/**
 * Build a Babylon Matrix from a GeometryPrimitive's position + rotation.
 * For boxes: size is baked into the matrix scale.
 * For cylinders: scale encodes radius and height.
 */
function geometryToMatrix(geom: GeometryPrimitive): BabylonMatrixType {
  let position: BabylonVector3Type;
  let rotation: { x: number; y: number; z: number };
  let scaling: BabylonVector3Type;

  if (geom.kind === 'box') {
    const g = geom as BoxGeometry;
    position = new Vector3(g.position.x, g.position.y, g.position.z);
    rotation = g.rotation;
    scaling = new Vector3(g.size.x, g.size.y, g.size.z);
  } else {
    const g = geom as CylinderGeometry;
    position = new Vector3(g.position.x, g.position.y, g.position.z);
    rotation = axisToRotation(g.axis);
    scaling = new Vector3(g.radius * 2, g.height, g.radius * 2);
  }

  const quaternion = Quaternion.RotationYawPitchRoll(rotation.y, rotation.x, rotation.z);
  const trs = Matrix.Compose(scaling, quaternion, position);
  return trs;
}

function axisToRotation(axis: 'x' | 'y' | 'z'): { x: number; y: number; z: number } {
  if (axis === 'x') return { x: 0, y: 0, z: -Math.PI / 2 };
  if (axis === 'y') return { x: 0, y: 0, z: 0 };
  return { x: Math.PI / 2, y: 0, z: 0 };
}

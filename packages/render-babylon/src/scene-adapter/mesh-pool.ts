// @profileaxis/render-babylon/scene-adapter/mesh-pool
// Thin-instance mesh pool: reuses Babylon mesh instances by geometry type + id.
// Not exported from package root — used internally by scene-adapter.

import type { Mesh } from '@babylonjs/core';
import type { BoxGeometry, CylinderGeometry } from '@profileaxis/modeler';

/**
 * MeshPool manages a pool of thin-instanced meshes for geometry reuse.
 *
 * Strategy:
 * - One base mesh per unique geometry "signature" (kind + rough size bucket)
 * - Thin instances pointing to the base mesh per concrete id
 * - If a slot is already in use for `id`, return the existing slot
 * - LRU eviction when pool is exhausted (capacity exceeded)
 */
export interface MeshPoolEntry {
  baseMesh: Mesh;
  instanceSlots: Map<string, number>; // id -> thin-instance index
  freeSlots: number[];               // released indices available for reuse
  usedSlots: Set<number>;
}

export class GeometryMeshPool {
  private _pools = new Map<string, MeshPoolEntry>();
  private _maxSlotsPerPool: number;
  private _totalUsed = 0;
  private _peakUsed = 0;

  constructor(maxSlotsPerPool = 2000) {
    this._maxSlotsPerPool = maxSlotsPerPool;
  }

  // ── Public API ────────────────────────────────────────────────────────────

  get totalUsed(): number {
    return this._totalUsed;
  }

  get peakUsed(): number {
    return this._peakUsed;
  }

  getStats() {
    let total = 0;
    let used = 0;
    for (const entry of this._pools.values()) {
      total += this._maxSlotsPerPool;
      used += entry.usedSlots.size;
    }
    return { total, used, free: total - used, peak: this._peakUsed };
  }

  /**
   * Acquire a thin-instance slot for `id`.
   * Returns the slot index. If `id` already has a slot, returns the existing index.
   */
  acquire(entry: MeshPoolEntry, id: string, slotHint?: number): number {
    if (entry.instanceSlots.has(id)) {
      return entry.instanceSlots.get(id)!;
    }

    let slot: number;

    // Prefer a freed slot
    if (entry.freeSlots.length > 0) {
      slot = entry.freeSlots.pop()!;
    } else if (entry.usedSlots.size < this._maxSlotsPerPool) {
      slot = entry.usedSlots.size;
    } else {
      // Pool exhausted — LRU eviction
      slot = this._evictLru(entry);
    }

    entry.instanceSlots.set(id, slot);
    entry.usedSlots.add(slot);
    this._totalUsed++;
    if (this._totalUsed > this._peakUsed) this._peakUsed = this._totalUsed;

    return slot;
  }

  /** Release a slot for `id`. */
  release(entry: MeshPoolEntry, id: string): void {
    const slot = entry.instanceSlots.get(id);
    if (slot === undefined) return;

    entry.instanceSlots.delete(id);
    entry.usedSlots.delete(slot);
    entry.freeSlots.push(slot);
    this._totalUsed--;
  }

  has(entry: MeshPoolEntry, id: string): boolean {
    return entry.instanceSlots.has(id);
  }

  getSlot(entry: MeshPoolEntry, id: string): number | undefined {
    return entry.instanceSlots.get(id);
  }

  /** Remove a pool entirely (dispose base mesh). */
  removePool(poolKey: string, onDispose: (mesh: Mesh) => void): void {
    const entry = this._pools.get(poolKey);
    if (!entry) return;
    this._totalUsed -= entry.usedSlots.size;
    onDispose(entry.baseMesh);
    this._pools.delete(poolKey);
  }

  getOrCreatePool(
    poolKey: string,
    factory: () => Mesh,
  ): MeshPoolEntry {
    if (this._pools.has(poolKey)) {
      return this._pools.get(poolKey)!;
    }
    const baseMesh = factory();
    const entry: MeshPoolEntry = {
      baseMesh,
      instanceSlots: new Map(),
      freeSlots: [],
      usedSlots: new Set(),
    };
    this._pools.set(poolKey, entry);
    return entry;
  }

  // ── Internal ──────────────────────────────────────────────────────────────

  private _evictLru(entry: MeshPoolEntry): number {
    // Simple LRU: take the first used slot
    // In a more sophisticated implementation, we'd track access order
    const it = entry.usedSlots.values();
    const firstSlot = it.next().value as number;
    // Find the id for this slot and remove it
    for (const [id, slot] of entry.instanceSlots.entries()) {
      if (slot === firstSlot) {
        entry.instanceSlots.delete(id);
        entry.usedSlots.delete(firstSlot);
        return firstSlot;
      }
    }
    // Should not reach here
    return firstSlot;
  }

  dispose(onDispose: (mesh: Mesh) => void): void {
    for (const [poolKey, entry] of this._pools.entries()) {
      this._totalUsed -= entry.usedSlots.size;
      onDispose(entry.baseMesh);
    }
    this._pools.clear();
  }
}

/** Derive a pool key from a BoxGeometry for thin-instance grouping. */
export function boxPoolKey(geom: BoxGeometry): string {
  // Bucket by axis (x/y/z) and rounded size
  const bx = Math.round(geom.size.x / 50) * 50;
  const by = Math.round(geom.size.y / 50) * 50;
  const bz = Math.round(geom.size.z / 50) * 50;
  return `box:${geom.id.split(':')[0]}:${bx}x${by}x${bz}`;
}

/** Derive a pool key from a CylinderGeometry for thin-instance grouping. */
export function cylinderPoolKey(geom: CylinderGeometry): string {
  const r = Math.round(geom.radius / 5) * 5;
  const h = Math.round(geom.height / 5) * 5;
  return `cyl:${geom.id.split(':')[0]}:r${r}h${h}`;
}

// @profileaxis/render-babylon/types - Babylon-specific types
// All Babylon types (Scene, Mesh, AbstractMesh, HighlightLayer, etc.)
// must remain inside this package.Apps/web imports ONLY the adapter interface.

import type { SceneViewModel, GeometryPrimitive, BoxGeometry, CylinderGeometry } from '@profileaxis/modeler';
import type { ResolvedDsl } from '@profileaxis/domain';

// ── Adapter Options ─────────────────────────────────────────────────────────

export interface SceneAdapterOptions {
  /** Canvas element or ID for the Babylon engine */
  canvas: HTMLCanvasElement | string;
  /** Enable antialiasing (default: true) */
  antialias?: boolean;
  /** Scene background color as hex string (default: '#1a1a2e') */
  backgroundColor?: string;
  /** Optional camera preset: 'iso' | 'front' | 'right' | 'top' */
  cameraPreset?: 'iso' | 'front' | 'right' | 'top';
  /** Enable debug layer (default: false) */
  debugLayer?: boolean;
}

// ── Picking ────────────────────────────────────────────────────────────────

export interface PickResult {
  pickedId: string | null;
  pickedType: 'node' | 'joint' | 'module' | null;
  worldPoint: { x: number; y: number; z: number } | null;
  distance: number | null;
}

export interface PickingOptions {
  /** Pick only these nodeIds. If empty, picks all. */
  filterIds?: string[];
  /** Pick only these types */
  filterTypes?: Array<'node' | 'joint' | 'module'>;
}

// ── Highlight ──────────────────────────────────────────────────────────────

export type HighlightKind = 'selected' | 'hovered' | 'highlighted' | 'error';

export interface HighlightLayerOptions {
  /** Highlight color for selected items */
  selectedColor?: string;
  /** Highlight color for hovered items */
  hoveredColor?: string;
  /** Blinking speed (0 = no blink, higher = faster blink) */
  blinkSpeed?: number;
}

// ── Diff ───────────────────────────────────────────────────────────────────

export interface SceneDiff {
  added: GeometryPrimitive[];
  removed: string[]; // ids to remove
  updated: GeometryPrimitive[]; // ids that changed (re-create)
}

export interface DiffApplyResult {
  addedCount: number;
  removedCount: number;
  updatedCount: number;
  errors: string[];
}

// ── Mesh Pool ───────────────────────────────────────────────────────────────

export interface MeshPoolStats {
  total: number;
  used: number;
  free: number;
  peak: number;
}

// ── Scene Adapter (public interface) ───────────────────────────────────────

export interface ISceneAdapter {
  /** Dispose all Babylon resources */
  dispose(): void;

  /** Rebuild the entire scene from a ResolvedDsl */
  rebuildFromResolvedDsl(resolvedDsl: ResolvedDsl, sceneVm: SceneViewModel): void;

  /** Incrementally apply a diff to the scene */
  applyDiff(diff: SceneDiff): DiffApplyResult;

  /** Set highlighted/selected nodeIds */
  setHighlightState(state: HighlightState): void;

  /** Pick at screen coordinates */
  pick(screenX: number, screenY: number, options?: PickingOptions): PickResult;

  /** Get the underlying Babylon Scene (apps/web only) */
  getScene(): import('@babylonjs/core').Scene;
}

export interface HighlightState {
  /** Node/joint ids that should be highlighted with selection color */
  selectedIds: string[];
  /** Node/joint ids that should be highlighted with hover color */
  hoveredIds: string[];
  /** Additional highlighted ids (generic highlight) */
  highlightedIds: string[];
  /** Ids with error/warning state */
  errorIds: string[];
}

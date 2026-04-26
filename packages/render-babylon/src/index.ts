// @profileaxis/render-babylon - Babylon Scene adapter, picking, highlight
// All Babylon types (Scene, Mesh, etc.) stay within this package.
// Only types.ts interfaces and adapter factory are exported publicly.

export type {
  SceneAdapterOptions,
  ISceneAdapter,
  PickResult,
  PickingOptions,
  HighlightState,
  HighlightLayerOptions,
  SceneDiff,
  DiffApplyResult,
  MeshPoolStats,
} from './types.js';

export { createSceneAdapter, BabylonSceneAdapter } from './scene-adapter/index.js';

export { pickOne, pickAll, pickRay, createPickingBound } from './picking/index.js';

export { GeometryMeshPool, boxPoolKey, cylinderPoolKey } from './scene-adapter/mesh-pool.js';
export { computeSceneDiff, applySceneDiff } from './scene-adapter/diff-applier.js';
export { createHighlightLayerManager, type HighlightLayerManager } from './scene-adapter/highlight.js';

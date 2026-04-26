// @profileaxis/modeler - ResolvedDsl -> geometry primitives + SceneViewModel
// No Babylon dependencies allowed

export { buildSceneViewModel } from './scene-vm/index.js';
export { nodeToGeometry, jointToGeometry, computeModuleBounds, computeOverallDimensions } from './geometry/index.js';
export type {
  GeometryPrimitive,
  BoxGeometry,
  CylinderGeometry,
  DimensionAnnotation,
  ModuleView,
  SceneViewModel,
  ProfileSpec,
  ConnectorSpec,
  CatalogBundle,
  SceneVMOptions,
} from './types.js';

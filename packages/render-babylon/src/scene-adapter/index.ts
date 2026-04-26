// @profileaxis/render-babylon/scene-adapter
// Babylon Scene adapter: builds and manages a Babylon Scene from ResolvedDsl.

import {
  Engine as BabylonEngine,
  Scene as BabylonScene,
  ArcRotateCamera,
  Vector3,
  Matrix,
  Quaternion,
  Color4,
  MeshBuilder,
  type Scene as BabylonSceneType,
  type Vector3 as BabylonVector3Type,
  type Mesh as BabylonMeshType,
} from '@babylonjs/core';
import type {
  SceneAdapterOptions,
  ISceneAdapter,
  HighlightState,
  DiffApplyResult,
  PickResult,
  PickingOptions,
} from '../types.js';
import type { ResolvedDsl } from '@profileaxis/domain';
import type { SceneViewModel, GeometryPrimitive, BoxGeometry, CylinderGeometry } from '@profileaxis/modeler';

import { GeometryMeshPool, boxPoolKey, cylinderPoolKey } from './mesh-pool.js';
import { createHighlightLayerManager, type HighlightLayerManager } from './highlight.js';
import { applySceneDiff } from './diff-applier.js';

export type {
  SceneAdapterOptions,
  ISceneAdapter,
  HighlightState,
  DiffApplyResult,
  PickResult,
  PickingOptions,
};

export { BabylonSceneAdapter, createSceneAdapter };

function createSceneAdapter(options: SceneAdapterOptions): ISceneAdapter {
  return new BabylonSceneAdapter(options);
}

// ── SceneAdapter implementation ─────────────────────────────────────────────

class BabylonSceneAdapter implements ISceneAdapter {
  private _engine: BabylonEngine | null = null;
  private _scene: BabylonSceneType | null = null;
  private _pool: GeometryMeshPool;
  private _highlightManager: HighlightLayerManager | null = null;
  private _options: SceneAdapterOptions;
  private _disposed = false;

  constructor(options: SceneAdapterOptions) {
    this._options = options;
    this._pool = new GeometryMeshPool(2000);
  }

  dispose(): void {
    if (this._disposed) return;
    this._disposed = true;

    this._highlightManager?.dispose();
    this._highlightManager = null;

    this._pool.dispose((mesh: BabylonMeshType) => mesh.dispose());
    this._pool = null as unknown as GeometryMeshPool;

    if (this._scene) {
      this._scene.dispose();
      this._scene = null;
    }
    if (this._engine) {
      this._engine.dispose();
      this._engine = null;
    }
  }

  rebuildFromResolvedDsl(resolvedDsl: ResolvedDsl, sceneVm: SceneViewModel): void {
    const scene = this._getOrCreateScene();

    // Full rebuild: clear all pools
    this._pool.dispose((mesh: BabylonMeshType) => mesh.dispose());

    // Create all primitives
    for (const geom of sceneVm.geometryPrimitives) {
      this._createOrUpdatePrimitive(scene, geom);
    }

    // Reset highlight state
    this._highlightManager?.setState({
      selectedIds: [],
      hoveredIds: [],
      highlightedIds: [],
      errorIds: [],
    });
  }

  applyDiff(diff: import('../types.js').SceneDiff): DiffApplyResult {
    if (!this._scene) throw new Error('Scene not initialized');
    return applySceneDiff(this._scene, diff, this._pool);
  }

  setHighlightState(state: HighlightState): void {
    if (!this._highlightManager) {
      if (!this._scene) return;
      this._highlightManager = createHighlightLayerManager(this._scene, {
        selectedColor: '#4fc3f7',
        hoveredColor: '#fff59d',
      });
    }
    this._highlightManager.setState(state);
  }

  pick(screenX: number, screenY: number, options?: PickingOptions): PickResult {
    if (!this._scene) {
      return { pickedId: null, pickedType: null, worldPoint: null, distance: null };
    }

    const scene = this._scene;
    const pickInfo = scene.pick(screenX, screenY, (mesh) => {
      if (options?.filterIds && options.filterIds.length > 0) {
        return options.filterIds.includes(mesh.name);
      }
      return mesh.isPickable && mesh.isVisible;
    });

    if (!pickInfo?.hit || !pickInfo.pickedMesh) {
      return { pickedId: null, pickedType: null, worldPoint: null, distance: null };
    }

    const meshName = pickInfo.pickedMesh.name;
    const pickedPoint = pickInfo.pickedPoint;

    let pickedType: 'node' | 'joint' | 'module' | null = null;
    if (meshName.startsWith('joint:')) {
      pickedType = 'joint';
    } else if (meshName.startsWith('module:')) {
      pickedType = 'module';
    } else {
      pickedType = 'node';
    }

    return {
      pickedId: meshName,
      pickedType,
      worldPoint: pickedPoint
        ? { x: pickedPoint.x, y: pickedPoint.y, z: pickedPoint.z }
        : null,
      distance: pickInfo.distance ?? null,
    };
  }

  getScene(): BabylonSceneType {
    if (!this._scene) throw new Error('Scene not initialized. Call rebuildFromResolvedDsl first.');
    return this._scene;
  }

  // ── Internal ──────────────────────────────────────────────────────────────

  private _getOrCreateScene(): BabylonSceneType {
    if (this._scene) return this._scene;

    const canvas =
      typeof this._options.canvas === 'string'
        ? (document.getElementById(this._options.canvas) as HTMLCanvasElement)
        : this._options.canvas;

    if (!canvas) throw new Error(`Canvas not found: ${this._options.canvas}`);

    this._engine = new BabylonEngine(canvas, this._options.antialias ?? true);
    const scene = new BabylonScene(this._engine);

    // Background color
    const bgColor = this._options.backgroundColor ?? '#1a1a2e';
    const [r, g, b] = hexToRgb01(bgColor);
    scene.clearColor = new Color4(r, g, b, 1);

    // Camera
    this._setupCamera(scene, this._options.cameraPreset ?? 'iso');

    // Render loop
    this._engine.runRenderLoop(() => {
      this._scene?.render();
    });

    window?.addEventListener('resize', () => {
      this._engine?.resize();
    });

    this._scene = scene;
    return scene;
  }

  private _setupCamera(scene: BabylonSceneType, preset: 'iso' | 'front' | 'right' | 'top'): void {
    const presets: Record<string, { alpha: number; beta: number; radius: number }> = {
      iso:   { alpha: Math.PI / 4,    beta: Math.PI / 3,  radius: 5000 },
      front: { alpha: 0,              beta: Math.PI / 2,  radius: 3000 },
      right: { alpha: Math.PI / 2,   beta: Math.PI / 2,  radius: 3000 },
      top:   { alpha: 0,             beta: 0.01,         radius: 5000 },
    };

    const p = presets[preset] ?? presets.iso;
    const camera = new ArcRotateCamera('camera', p.alpha, p.beta, p.radius, new Vector3(0, 0, 0), scene);
    camera.lowerRadiusLimit = 10;
    camera.upperRadiusLimit = 20000;
    const renderCanvas = scene.getEngine().getRenderingCanvas();
    if (renderCanvas) {
      camera.attachControl(renderCanvas, true);
    }
  }

  private _createOrUpdatePrimitive(scene: BabylonSceneType, geom: GeometryPrimitive): void {
    const poolKey = geom.kind === 'box' ? boxPoolKey(geom as BoxGeometry) : cylinderPoolKey(geom as CylinderGeometry);
    const entry = this._pool.getOrCreatePool(poolKey, () => createBaseMesh(scene, geom));
    const slot = this._pool.acquire(entry, geom.id);
    updateThinInstanceAt(entry.baseMesh, slot, geom);
  }
}

// ── Module-local helpers ─────────────────────────────────────────────────────

function createBaseMesh(scene: BabylonSceneType, geom: GeometryPrimitive): BabylonMeshType {
  if (geom.kind === 'box') {
    const mesh = MeshBuilder.CreateBox(geom.id, { size: 1 }, scene);
    mesh.isVisible = false;
    mesh.isPickable = false;
    return mesh;
  } else {
    const mesh = MeshBuilder.CreateCylinder(geom.id, {
      diameter: 2,
      height: 1,
      tessellation: 12,
    }, scene);
    mesh.isVisible = false;
    mesh.isPickable = false;
    return mesh;
  }
}

function updateThinInstanceAt(
  baseMesh: BabylonMeshType,
  slot: number,
  geom: GeometryPrimitive,
): void {
  let position: BabylonVector3Type;
  let scaling: BabylonVector3Type;
  let rotation: { x: number; y: number; z: number };

  if (geom.kind === 'box') {
    const g = geom as BoxGeometry;
    position = new Vector3(g.position.x, g.position.y, g.position.z);
    scaling = new Vector3(g.size.x, g.size.y, g.size.z);
    rotation = g.rotation;
  } else {
    const g = geom as CylinderGeometry;
    position = new Vector3(g.position.x, g.position.y, g.position.z);
    scaling = new Vector3(g.radius * 2, g.height, g.radius * 2);
    rotation = cylinderAxisToEuler(g.axis);
  }

  const quaternion = Quaternion.RotationYawPitchRoll(rotation.y, rotation.x, rotation.z);
  const trs = Matrix.Compose(scaling, quaternion, position);

  baseMesh.thinInstanceSetMatrixAt(slot, trs, true);
  baseMesh.isVisible = true;
  baseMesh.isPickable = true;
}

function cylinderAxisToEuler(axis: 'x' | 'y' | 'z'): { x: number; y: number; z: number } {
  if (axis === 'x') return { x: 0, y: 0, z: -Math.PI / 2 };
  if (axis === 'y') return { x: 0, y: 0, z: 0 };
  return { x: Math.PI / 2, y: 0, z: 0 };
}

function hexToRgb01(hex: string): [number, number, number] {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  return [r, g, b];
}

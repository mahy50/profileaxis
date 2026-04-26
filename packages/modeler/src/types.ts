// @profileaxis/modeler - types
// No Babylon dependencies allowed

import type { Vec3, StructuralNode, JointNode } from '@profileaxis/domain';

// ── Profile / Connector Specs (mirrors stdlib data shapes) ───────────────────

export interface ProfileSpecDimensions {
  widthMm: number;
  heightMm: number;
  wallThicknessMm: number;
}

export interface ProfileSpec {
  profileKey: string;
  seriesName: string;
  crossSection: string;
  dimensions: ProfileSpecDimensions;
  material: string;
  weightKgPerM: number;
  loadRatingN: number;
  finishOptions: Array<{ finishKey: string; description: string }>;
}

export interface ConnectorSpec {
  connectorKey: string;
  connectorFamilyKey: string;
  topology: string;
  compatibleProfileKeys: string[];
  hardwareItems: Array<{
    partNumber: string;
    description: string;
    quantity: number;
  }>;
}

export interface CatalogBundle {
  profiles: ProfileSpec[];
  connectors: ConnectorSpec[];
}

export interface SceneVMOptions {
  includeDimensionAnnotations?: boolean;
}

// ── Geometry Primitives ───────────────────────────────────────────────────────

export interface BoxGeometry {
  kind: 'box';
  id: string;
  position: Vec3; // center of the box
  size: { x: number; y: number; z: number }; // width, height, depth in mm
  rotation: { x: number; y: number; z: number }; // Euler angles in radians
}

export interface CylinderGeometry {
  kind: 'cylinder';
  id: string;
  position: Vec3;
  radius: number;
  height: number;
  axis: 'x' | 'y' | 'z';
}

export type GeometryPrimitive = BoxGeometry | CylinderGeometry;

// ── View Models ──────────────────────────────────────────────────────────────

export interface SceneViewModel {
  geometryPrimitives: GeometryPrimitive[];
  dimensionAnnotations: DimensionAnnotation[];
  moduleViews: ModuleView[];
}

export interface DimensionAnnotation {
  id: string;
  start: Vec3;
  end: Vec3;
  label: string;
  unit: 'mm';
}

export interface ModuleView {
  moduleId: string;
  nodeIds: string[];
  jointIds: string[];
}

// Re-export domain types for consumers
export type { Vec3, StructuralNode, JointNode };

// @profileaxis/schemas - JSON Schema, AI I/O Schema, runtime validator
// No Vue/Babylon/application-service dependencies allowed

import type {
  ProjectDocument,
  IntentDsl,
  ConfirmationDsl,
  DraftDsl,
  ResolvedDsl,
  StructuralNode,
  JointNode,
  CheckIssue,
  CommandEntry,
} from '@profileaxis/domain';

// Schema version
export const SCHEMA_VERSION = '1.0.0';
export { SCHEMA_VERSION as DOMAIN_SCHEMA_VERSION } from '@profileaxis/domain';

// Re-export domain types for convenience
export type {
  ProjectDocument,
  IntentDsl,
  ConfirmationDsl,
  DraftDsl,
  ResolvedDsl,
  StructuralNode,
  JointNode,
  CheckIssue,
  CommandEntry,
};

// AI I/O Types
export interface ParseRequirementsRequest {
  text: string;
  locale?: 'zh-CN' | 'en-US';
}

export interface ProposeDraftRequest {
  intentDsl: IntentDsl;
  confirmationDsl: ConfirmationDsl | null;
}

export interface ResolveEditIntentRequest {
  referenceContext: ReferenceContext;
  editText: string;
}

export interface ReferenceContext {
  activeSelection: Array<{
    entityType: 'structural' | 'joint' | 'module';
    id: string;
    semanticPath: string;
    role?: string;
    axis?: 'x' | 'y' | 'z';
    center: Vec3;
    bbox: { min: Vec3; max: Vec3 };
    bayIndex?: number | null;
    levelIndex?: number | null;
  }>;
  hoverTarget: null | {
    entityType: string;
    id: string;
    semanticPath: string;
    worldPoint?: Vec3;
  };
  cameraContext: {
    viewPreset: 'iso' | 'front' | 'right' | 'top';
    forward: Vec3;
    up: Vec3;
    right: Vec3;
  };
  structureContext: {
    focusedModuleId?: string | null;
    expandedSemanticPaths: string[];
  };
  recentReferences: Array<{
    id: string;
    semanticPath: string;
    referencedAt: string;
  }>;
  allowedActions: EditAction[];
}

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export type EditAction =
  | 'resizeOverall'
  | 'resizeBay'
  | 'insertLevel'
  | 'removeLevel'
  | 'moveLevel'
  | 'toggleBrace'
  | 'replaceProfileSeries'
  | 'addBeam'
  | 'removeBeam'
  | 'insertBay'
  | 'removeBay'
  | 'restoreSnapshot';

export interface EditIntent {
  action: EditAction;
  targetMode: 'selected' | 'semantic' | 'relative' | 'global';
  targetRef: string | null;
  params: Record<string, unknown>;
  confidence: number;
  needsFollowUp: boolean;
}

// Runtime validators (built to dist/validators/)
export type { ValidationResult } from './validators/validator.js';
export { validateIntent, validateConfirmation, validateDraft, validateResolved } from './validators/validator.js';

// API Response types
export type AIResponseStatus = 'ok' | 'refusal' | 'schema_error';

export interface AIOKResponse<T> {
  status: 'ok';
  data: T;
}

export interface AIRefusalResponse {
  status: 'refusal';
  reason: string;
}

export interface AISchemaErrorResponse {
  status: 'schema_error';
  message: string;
  schemaPath?: string;
}

export type AIResponse<T> = AIOKResponse<T> | AIRefusalResponse | AISchemaErrorResponse;

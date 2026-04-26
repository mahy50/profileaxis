// resolve/index.ts — Generate resolvedDsl from normalized intent
// No AI, no LLM — pure deterministic geometry computation

import type { DraftDsl, IntentDsl, ResolvedDsl, StructuralNode, JointNode, Vec3, NodeId, JointId } from '@profileaxis/domain';
import { PROFILES, CONNECTORS } from '@profileaxis/stdlib';
import { computeLevelHeights } from '../normalize/index.js';

// Known profile series mapping from stdlib
const PROFILE_SERIES: Record<string, string> = {
  'U50': 'PC-AI50-50-3',
  'U60': 'PB-SB60-40-2.0',
  'U90': 'PA-UC90-70-2.5',
};

// Default profile keys
const DEFAULT_PROFILE_KEY = 'PA-UC90-70-2.5';
const DEFAULT_BEAM_PROFILE = 'PB-SB60-40-2.0';
const DEFAULT_BRACE_PROFILE = 'PC-AI50-50-3';
const DEFAULT_FINISH_KEY = 'FZ-pre galvanized';

/**
 * Generate deterministic NodeId from semantic path
 */
function makeNodeId(semanticPath: string): NodeId {
  let hash = 0;
  for (let i = 0; i < semanticPath.length; i++) {
    hash = ((hash << 5) - hash) + semanticPath.charCodeAt(i);
    hash = hash & hash;
  }
  return `N-${Math.abs(hash).toString(36).padStart(8, '0')}`;
}

/**
 * Generate deterministic JointId from semantic path
 */
function makeJointId(semanticPath: string): JointId {
  let hash = 0;
  for (let i = 0; i < semanticPath.length; i++) {
    hash = ((hash << 5) - hash) + semanticPath.charCodeAt(i);
    hash = hash & hash;
  }
  return `J-${Math.abs(hash).toString(36).padStart(8, '0')}`;
}

/**
 * Make a Vec3 at given coordinates
 */
function vec3(x: number, y: number, z: number): Vec3 {
  return { x, y, z };
}

/**
 * Resolve profile spec key from series
 */
function resolveProfileKey(series: string | null, fallback: string): string {
  if (series && PROFILE_SERIES[series]) {
    return PROFILE_SERIES[series];
  }
  return fallback;
}

interface NormalizedIntentInput {
  widthMm: number;
  depthMm: number;
  heightMm: number;
  shelfCount: number;
  profileSeries: string | null;
  rearBrace: boolean;
  caster: boolean;
}

interface BuildNodesResult {
  nodes: StructuralNode[];
  moduleSpanMm: number;
  uprightPositions: Vec3[];
}

/**
 * Build all structural nodes for a rack system
 */
function buildNodes(normalized: NormalizedIntentInput): BuildNodesResult {
  const nodes: StructuralNode[] = [];
  const { widthMm, depthMm, heightMm, shelfCount, profileSeries, rearBrace, caster } = normalized;

  const moduleSpanMm = widthMm;

  // Compute level heights
  const levelHeights = computeLevelHeights(heightMm, shelfCount);

  // Upright positions at 4 corners
  const uprightPositions: Vec3[] = [
    vec3(0, 0, 0),
    vec3(moduleSpanMm, 0, 0),
    vec3(0, depthMm, 0),
    vec3(moduleSpanMm, depthMm, 0),
  ];

  // Create uprights (vertical columns at 4 corners)
  for (let i = 0; i < uprightPositions.length; i++) {
    const pos = uprightPositions[i];
    const semanticPath = `upright/${i}`;
    const profileKey = resolveProfileKey(profileSeries, DEFAULT_PROFILE_KEY);
    const lengthMm = heightMm;

    nodes.push({
      nodeId: makeNodeId(semanticPath),
      kind: 'member',
      role: 'upright',
      semanticPath,
      axis: 'y',
      start: vec3(pos.x, pos.y, pos.z),
      end: vec3(pos.x, pos.y, pos.z + heightMm),
      lengthMm,
      profileSpecKey: profileKey,
      provenance: { source: 'rule', ruleIds: ['resolve-upright'] },
      finishKey: DEFAULT_FINISH_KEY,
      tags: [],
    });
  }

  // Create beams at each level (front and rear)
  let cumHeight = 0;
  for (let level = 0; level < shelfCount; level++) {
    const levelHeightMm = levelHeights[level] ?? Math.round(heightMm / shelfCount);
    cumHeight += levelHeightMm;
    const zPos = cumHeight;

    // Front beam
    const frontBeamPath = `beam/front/${level}`;
    nodes.push({
      nodeId: makeNodeId(frontBeamPath),
      kind: 'member',
      role: 'beamX',
      semanticPath: frontBeamPath,
      axis: 'x',
      start: vec3(0, 0, zPos),
      end: vec3(moduleSpanMm, 0, zPos),
      lengthMm: moduleSpanMm,
      profileSpecKey: resolveProfileKey(profileSeries, DEFAULT_BEAM_PROFILE),
      provenance: { source: 'rule', ruleIds: ['resolve-beam'] },
      finishKey: DEFAULT_FINISH_KEY,
      tags: [],
    });

    // Rear beam
    const rearBeamPath = `beam/rear/${level}`;
    nodes.push({
      nodeId: makeNodeId(rearBeamPath),
      kind: 'member',
      role: 'beamX',
      semanticPath: rearBeamPath,
      axis: 'x',
      start: vec3(0, depthMm, zPos),
      end: vec3(moduleSpanMm, depthMm, zPos),
      lengthMm: moduleSpanMm,
      profileSpecKey: resolveProfileKey(profileSeries, DEFAULT_BEAM_PROFILE),
      provenance: { source: 'rule', ruleIds: ['resolve-beam'] },
      finishKey: DEFAULT_FINISH_KEY,
      tags: [],
    });
  }

  // Optional rear braces
  if (rearBrace) {
    const braceZPositions = [heightMm * 0.3, heightMm * 0.6];
    for (const zFrac of braceZPositions) {
      const zPos = Math.round(zFrac);

      const bracePathFL = `brace/left/${zPos}`;
      nodes.push({
        nodeId: makeNodeId(bracePathFL),
        kind: 'member',
        role: 'brace',
        semanticPath: bracePathFL,
        axis: 'y',
        start: vec3(0, 0, zPos),
        end: vec3(0, depthMm, zPos),
        lengthMm: depthMm,
        profileSpecKey: resolveProfileKey(profileSeries, DEFAULT_BRACE_PROFILE),
        provenance: { source: 'rule', ruleIds: ['resolve-brace'] },
        finishKey: DEFAULT_FINISH_KEY,
        tags: [],
      });

      const bracePathFR = `brace/right/${zPos}`;
      nodes.push({
        nodeId: makeNodeId(bracePathFR),
        kind: 'member',
        role: 'brace',
        semanticPath: bracePathFR,
        axis: 'y',
        start: vec3(moduleSpanMm, 0, zPos),
        end: vec3(moduleSpanMm, depthMm, zPos),
        lengthMm: depthMm,
        profileSpecKey: resolveProfileKey(profileSeries, DEFAULT_BRACE_PROFILE),
        provenance: { source: 'rule', ruleIds: ['resolve-brace'] },
        finishKey: DEFAULT_FINISH_KEY,
        tags: [],
      });
    }
  }

  // Optional foot nodes
  if (caster) {
    for (let i = 0; i < uprightPositions.length; i++) {
      const pos = uprightPositions[i];
      const footPath = `foot/${i}`;
      nodes.push({
        nodeId: makeNodeId(footPath),
        kind: 'module',
        role: 'foot',
        semanticPath: footPath,
        axis: 'y',
        start: vec3(pos.x, pos.y, pos.z),
        end: vec3(pos.x, pos.y, pos.z + 80),
        lengthMm: 80,
        profileSpecKey: 'CASTER-STD-50',
        provenance: { source: 'rule', ruleIds: ['resolve-foot'] },
        finishKey: null,
        tags: [],
      });
    }
  }

  return { nodes, moduleSpanMm, uprightPositions };
}

/**
 * Build joint nodes between structural members
 */
function buildJoints(
  nodes: StructuralNode[],
  normalized: NormalizedIntentInput,
  uprightPositions: Vec3[]
): JointNode[] {
  const joints: JointNode[] = [];
  const { depthMm, heightMm, shelfCount, rearBrace } = normalized;
  const moduleSpanMm = normalized.widthMm;

  const levelHeights = computeLevelHeights(heightMm, shelfCount);
  let cumHeight = 0;

  for (let level = 0; level < shelfCount; level++) {
    const levelHeightMm = levelHeights[level] ?? Math.round(heightMm / shelfCount);
    cumHeight += levelHeightMm;
    const zPos = cumHeight;

    // 4 corner joints at each level
    const cornerJoints = [
      { path: `joint/corner-front-left/${level}`, pos: vec3(0, 0, zPos), uprightIdx: 0, level },
      { path: `joint/corner-front-right/${level}`, pos: vec3(moduleSpanMm, 0, zPos), uprightIdx: 1, level },
      { path: `joint/corner-rear-left/${level}`, pos: vec3(0, depthMm, zPos), uprightIdx: 2, level },
      { path: `joint/corner-rear-right/${level}`, pos: vec3(moduleSpanMm, depthMm, zPos), uprightIdx: 3, level },
    ];

    for (const cj of cornerJoints) {
      const uprightNode = nodes.find(n => n.semanticPath === `upright/${cj.uprightIdx}`);
      const beamNode = nodes.find(n => n.semanticPath === `beam/${cj.uprightIdx < 2 ? 'front' : 'rear'}/${cj.level}`);

      joints.push({
        jointId: makeJointId(cj.path),
        topology: 'corner-3way',
        semanticPath: cj.path,
        position: cj.pos,
        memberIds: [uprightNode?.nodeId, beamNode?.nodeId].filter((id): id is NodeId => id !== undefined),
        connectorSpecKey: 'JC3-CORNER',
        connectorFamilyKey: 'corner-3way',
      });
    }

    // T-joints at each level along the front beams (at x=0 upright positions)
    // Only add if this isn't already covered by corner joint (which it is, but
    // we keep T-joint for structural completeness of the beam-node topology)
    const uprightNodeT = nodes.find(n => n.semanticPath === 'upright/0');
    const frontBeamNodeT = nodes.find(n => n.semanticPath === `beam/front/${level}`);
    if (uprightNodeT && frontBeamNodeT) {
      const jTFL = `joint/tee-front-left/${level}`;
      joints.push({
        jointId: makeJointId(jTFL),
        topology: 'tee-3way',
        semanticPath: jTFL,
        position: vec3(0, 0, zPos),
        memberIds: [uprightNodeT.nodeId, frontBeamNodeT.nodeId],
        connectorSpecKey: 'JC3-TEE',
        connectorFamilyKey: 'tee-3way',
      });
    }
  }

  // Base joints at ground level
  for (let i = 0; i < uprightPositions.length; i++) {
    const pos = uprightPositions[i];
    const baseJointPath = `joint/base/${i}`;
    const uprightNode = nodes.find(n => n.semanticPath === `upright/${i}`);
    joints.push({
      jointId: makeJointId(baseJointPath),
      topology: 'foot',
      semanticPath: baseJointPath,
      position: vec3(pos.x, pos.y, pos.z),
      memberIds: [uprightNode?.nodeId].filter((id): id is NodeId => id !== undefined),
      connectorSpecKey: 'JC-FOOT',
      connectorFamilyKey: 'foot',
    });
  }

  // Brace end joints
  if (rearBrace) {
    const braceZPositions = [heightMm * 0.3, heightMm * 0.6];
    for (const zFrac of braceZPositions) {
      const zPos = Math.round(zFrac);
      const braceEndJointPath = `joint/brace-end/${zPos}`;
      const braceNodes = nodes.filter(n => n.semanticPath.includes(`brace/`) && n.semanticPath.endsWith(`/${zPos}`));
      joints.push({
        jointId: makeJointId(braceEndJointPath),
        topology: 'brace-end',
        semanticPath: braceEndJointPath,
        position: vec3(0, 0, zPos),
        memberIds: braceNodes.map(n => n.nodeId),
        connectorSpecKey: 'JC3-TEE',
        connectorFamilyKey: 'brace-end',
      });
    }
  }

  return joints;
}

/**
 * Main resolve function — transform NormalizedIntent into ResolvedDsl
 */
export function resolve(normalized: NormalizedIntentInput): ResolvedDsl {
  const { widthMm, depthMm, heightMm, shelfCount } = normalized;

  // Build nodes
  const { nodes, moduleSpanMm, uprightPositions } = buildNodes(normalized);

  // Build joints
  const joints = buildJoints(nodes, normalized, uprightPositions);

  // Build resolved modules
  const modules = [
    {
      moduleId: 'module-0',
      kind: 'rect-bay' as const,
      spanMm: moduleSpanMm,
    },
  ];

  // Generate source revision ID
  const revId = `rev-${widthMm}-${heightMm}-${shelfCount}-m1`;

  return {
    dslVersion: '1.0.0',
    projectType: 'storage_rack',
    sourceRevisionId: revId,
    overallSizeMm: { width: widthMm, depth: depthMm, height: heightMm },
    modules,
    nodes,
    joints,
  };
}
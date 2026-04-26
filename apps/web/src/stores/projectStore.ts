import { defineStore } from 'pinia';
import { ref, computed, type Ref, type ComputedRef } from 'vue';
import type {
  ProjectDocument,
  ResolvedDsl,
  StructuralNode,
  JointNode,
  DesignBomItem,
  TradeBomItem,
  CheckIssue,
} from '@profileaxis/domain';
import { computeBomSummary } from '@profileaxis/bom';
import { check } from '@profileaxis/rules';

export interface ProjectStoreState {
  projectDoc: Ref<ProjectDocument>;
  isDirty: Ref<boolean>;
  isLoading: Ref<boolean>;
  resolvedDsl: ComputedRef<ResolvedDsl>;
  structuralNodes: ComputedRef<StructuralNode[]>;
  jointNodes: ComputedRef<JointNode[]>;
  designBom: ComputedRef<DesignBomItem[]>;
  tradeBom: ComputedRef<TradeBomItem[]>;
  checkIssues: ComputedRef<CheckIssue[]>;
  projectName: ComputedRef<string>;
  loadProject(doc: ProjectDocument): void;
  updateResolvedDsl(dsl: ResolvedDsl): void;
  recalcDerived(): void;
  setStructuralNodes(nodes: StructuralNode[]): void;
  setJointNodes(joints: JointNode[]): void;
  setDesignBom(bom: DesignBomItem[]): void;
  setTradeBom(bom: TradeBomItem[]): void;
  setCheckIssues(issues: CheckIssue[]): void;
  markDirty(): void;
  markClean(): void;
}

function makeEmptyProject(): ProjectDocument {
  return {
    schemaVersion: '1.0.0',
    projectId: `proj-${Date.now()}`,
    name: 'New Rack',
    locale: 'zh-CN',
    unitSystem: 'mm',
    stdlibVersion: '1.0.0-m1',
    ruleVersion: '1.0.0-m1',
    catalogVersion: '1.0.0-m1',
    resolvedDsl: {
      dslVersion: '1.0.0',
      projectType: 'storage_rack',
      sourceRevisionId: 'init',
      overallSizeMm: { width: 1200, depth: 600, height: 2000 },
      modules: [{ moduleId: 'bay-1', kind: 'rect-bay', spanMm: 1200 }],
      nodes: [],
      joints: [],
    },
    structuralNodes: [],
    jointNodes: [],
    designBom: [],
    tradeBom: [],
    checkIssues: [],
    currentRevisionId: 'init',
    commandCursor: 0,
    snapshotIds: [],
    intentDsl: null,
    confirmationDsl: null,
    draftDsl: null,
    uiState: {},
  };
}

export const useProjectStore = defineStore('project', (): ProjectStoreState => {
  const projectDoc = ref<ProjectDocument>(makeEmptyProject());
  const isDirty = ref(false);
  const isLoading = ref(false);

  const resolvedDsl = computed(() => projectDoc.value.resolvedDsl);
  const structuralNodes = computed(() => projectDoc.value.structuralNodes);
  const jointNodes = computed(() => projectDoc.value.jointNodes);
  const designBom = computed(() => projectDoc.value.designBom);
  const tradeBom = computed(() => projectDoc.value.tradeBom);
  const checkIssues = computed(() => projectDoc.value.checkIssues);
  const projectName = computed(() => projectDoc.value.name);

  function loadProject(doc: ProjectDocument) {
    projectDoc.value = doc;
    isDirty.value = false;
  }

  function updateResolvedDsl(dsl: ResolvedDsl) {
    projectDoc.value.resolvedDsl = dsl;
    recalcDerived();
    isDirty.value = true;
  }

  function recalcDerived() {
    const dsl = projectDoc.value.resolvedDsl;
    projectDoc.value.structuralNodes = dsl.nodes ?? [];
    projectDoc.value.jointNodes = dsl.joints ?? [];

    try {
      const summary = computeBomSummary(dsl);
      projectDoc.value.designBom = summary.designBom;
      projectDoc.value.tradeBom = summary.tradeBom;
    } catch {
      projectDoc.value.designBom = [];
      projectDoc.value.tradeBom = [];
    }

    try {
      projectDoc.value.checkIssues = check(dsl);
    } catch {
      projectDoc.value.checkIssues = [];
    }
  }

  function setStructuralNodes(nodes: StructuralNode[]) {
    projectDoc.value.structuralNodes = nodes;
    isDirty.value = true;
  }

  function setJointNodes(joints: JointNode[]) {
    projectDoc.value.jointNodes = joints;
    isDirty.value = true;
  }

  function setDesignBom(bom: DesignBomItem[]) {
    projectDoc.value.designBom = bom;
  }

  function setTradeBom(bom: TradeBomItem[]) {
    projectDoc.value.tradeBom = bom;
  }

  function setCheckIssues(issues: CheckIssue[]) {
    projectDoc.value.checkIssues = issues;
  }

  function markDirty() {
    isDirty.value = true;
  }

  function markClean() {
    isDirty.value = false;
  }

  return {
    projectDoc,
    isDirty,
    isLoading,
    resolvedDsl,
    structuralNodes,
    jointNodes,
    designBom,
    tradeBom,
    checkIssues,
    projectName,
    loadProject,
    updateResolvedDsl,
    recalcDerived,
    setStructuralNodes,
    setJointNodes,
    setDesignBom,
    setTradeBom,
    setCheckIssues,
    markDirty,
    markClean,
  };
});

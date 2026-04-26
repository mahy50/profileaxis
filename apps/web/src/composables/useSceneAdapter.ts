import { ref, watch, onUnmounted, type Ref } from 'vue';
import type { ResolvedDsl } from '@profileaxis/domain';
import { buildSceneViewModel } from '@profileaxis/modeler';
import type { PickResult, HighlightState, SceneDiff, DiffApplyResult, SceneAdapterOptions } from '@profileaxis/render-babylon';
import { createSceneAdapter } from '@profileaxis/render-babylon';
import { useCatalog } from './useCatalog';
import { useSelectionStore } from '@/stores/selectionStore';
import { useProjectStore } from '@/stores/projectStore';

interface SceneAdapterProxy {
  dispose(): void;
  rebuildFromResolvedDsl(resolvedDsl: ResolvedDsl, sceneVm: unknown): void;
  applyDiff(diff: SceneDiff): DiffApplyResult;
  setHighlightState(state: HighlightState): void;
  pick(screenX: number, screenY: number, options?: { filterIds?: string[]; filterTypes?: string[] }): PickResult;
}

export interface SceneAdapterHandle {
  adapter: Ref<SceneAdapterProxy | null>;
  isReady: Ref<boolean>;
  lastPickResult: Ref<PickResult | null>;
  init(): void;
  rebuild(): void;
  syncHighlight(): void;
  handlePick(event: PointerEvent): void;
  handlePointerMove(event: PointerEvent): void;
  dispose(): void;
}

export function useSceneAdapter(canvasRef: Ref<HTMLCanvasElement | null>): SceneAdapterHandle {
  const adapter = ref<SceneAdapterProxy | null>(null);
  const isReady = ref(false);
  const lastPickResult = ref<PickResult | null>(null);

  const catalog = useCatalog();
  const selectionStore = useSelectionStore();
  const projectStore = useProjectStore();

  function init() {
    const canvas = canvasRef.value;
    if (!canvas || adapter.value) return;
    adapter.value = createSceneAdapter({ canvas, antialias: true });
    isReady.value = true;
  }

  function rebuild() {
    if (!adapter.value) return;
    const dsl = projectStore.resolvedDsl;
    if (!dsl || dsl.nodes.length === 0) return;
    const sceneVm = buildSceneViewModel(dsl as ResolvedDsl, catalog);
    adapter.value.rebuildFromResolvedDsl(dsl as ResolvedDsl, sceneVm);
    syncHighlight();
  }

  function syncHighlight() {
    if (!adapter.value) return;
    const s = selectionStore;
    adapter.value.setHighlightState({
      selectedIds: s.selectedIds,
      hoveredIds: s.hoveredId ? [s.hoveredId] : [],
      highlightedIds: s.highlightedIds,
      errorIds: s.errorIds,
    });
  }

  function handlePick(event: PointerEvent) {
    if (!adapter.value || !canvasRef.value) return;
    const rect = canvasRef.value.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    const result = adapter.value.pick(x, y);
    lastPickResult.value = result;

    if (result.pickedId) {
      // Simple click: select if not shift; toggle if shift
      if (event.shiftKey) {
        selectionStore.toggleSelect(result.pickedId);
      } else {
        selectionStore.select([result.pickedId]);
      }
    } else {
      selectionStore.clearSelection();
    }
    syncHighlight();
  }

  function handlePointerMove(event: PointerEvent) {
    if (!adapter.value || !canvasRef.value) return;
    const rect = canvasRef.value.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    const result = adapter.value.pick(x, y);
    selectionStore.hover(result.pickedId);
    syncHighlight();
  }

  // Watch selection store and sync highlight state
  watch(
    () => [selectionStore.selectedIds, selectionStore.hoveredId, selectionStore.highlightedIds, selectionStore.errorIds],
    () => syncHighlight(),
    { deep: true }
  );

  // Watch project's resolvedDsl and rebuild scene
  watch(
    () => projectStore.resolvedDsl,
    () => {
      if (isReady.value) rebuild();
    },
    { deep: true }
  );

  function dispose() {
    adapter.value?.dispose();
    adapter.value = null;
    isReady.value = false;
  }

  onUnmounted(dispose);

  return {
    adapter,
    isReady,
    lastPickResult,
    init,
    rebuild,
    syncHighlight,
    handlePick,
    handlePointerMove,
    dispose,
  };
}

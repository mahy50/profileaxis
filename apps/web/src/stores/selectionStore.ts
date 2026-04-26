import { defineStore } from 'pinia';
import { ref, computed } from 'vue';

export const useSelectionStore = defineStore('selection', () => {
  const selectedIds = ref<string[]>([]);
  const hoveredId = ref<string | null>(null);
  const highlightedIds = ref<string[]>([]);
  const errorIds = ref<string[]>([]);

  const isEmpty = computed(() => selectedIds.value.length === 0);
  const singleSelectedId = computed(() =>
    selectedIds.value.length === 1 ? selectedIds.value[0] : null
  );

  function select(ids: string[]) {
    selectedIds.value = [...ids];
  }

  function toggleSelect(id: string) {
    const idx = selectedIds.value.indexOf(id);
    if (idx >= 0) {
      selectedIds.value = selectedIds.value.filter(s => s !== id);
    } else {
      selectedIds.value = [...selectedIds.value, id];
    }
  }

  function clearSelection() {
    selectedIds.value = [];
  }

  function hover(id: string | null) {
    hoveredId.value = id;
  }

  function setHighlighted(ids: string[]) {
    highlightedIds.value = ids;
  }

  function setErrors(ids: string[]) {
    errorIds.value = ids;
  }

  function clearAll() {
    selectedIds.value = [];
    hoveredId.value = null;
    highlightedIds.value = [];
    errorIds.value = [];
  }

  return {
    selectedIds,
    hoveredId,
    highlightedIds,
    errorIds,
    isEmpty,
    singleSelectedId,
    select,
    toggleSelect,
    clearSelection,
    hover,
    setHighlighted,
    setErrors,
    clearAll,
  };
});

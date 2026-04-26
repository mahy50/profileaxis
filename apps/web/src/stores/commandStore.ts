import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import type { CommandEntry } from '@profileaxis/domain';

export const useCommandStore = defineStore('command', () => {
  const history = ref<CommandEntry[]>([]);
  const cursor = ref(0);

  const canUndo = computed(() => cursor.value > 0);
  const canRedo = computed(() => cursor.value < history.value.length);
  const commandCount = computed(() => history.value.length);

  function execute(cmd: CommandEntry) {
    history.value = [...history.value.slice(0, cursor.value), cmd];
    cursor.value = history.value.length;
  }

  function undo(): CommandEntry | null {
    if (!canUndo.value) return null;
    cursor.value--;
    return history.value[cursor.value];
  }

  function redo(): CommandEntry | null {
    if (!canRedo.value) return null;
    const cmd = history.value[cursor.value];
    cursor.value++;
    return cmd;
  }

  function clear() {
    history.value = [];
    cursor.value = 0;
  }

  return {
    history,
    cursor,
    canUndo,
    canRedo,
    commandCount,
    execute,
    undo,
    redo,
    clear,
  };
});

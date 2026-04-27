<script setup lang="ts">
import Viewport3D from './Viewport3D.vue';
import StructureTree from './StructureTree.vue';
import BomPanel from './BomPanel.vue';
import ChecksPanel from './ChecksPanel.vue';
import { useProjectStore } from '@/stores/projectStore';
import { useCommandStore } from '@/stores/commandStore';
import { createCommandBus } from '@/services/commandBus';

const projectStore = useProjectStore();
const commandStore = useCommandStore();
const bus = createCommandBus();

type PanelTab = 'tree' | 'bom' | 'checks';

const activeTab = ref<PanelTab>('tree');

function handleUndo() {
  bus.undo();
}
function handleRedo() {
  bus.redo();
}
</script>

<script lang="ts">
import { ref } from 'vue';
export default { name: 'EditorShell' };
</script>

<template>
  <div class="editor-shell">
    <!-- Toolbar -->
    <header class="editor-toolbar">
      <span class="toolbar-title">{{ projectStore.projectName }}</span>
      <div class="toolbar-actions">
        <button
          :disabled="!commandStore.canUndo"
          title="Undo"
          @click="handleUndo"
        >↩</button>
        <button
          :disabled="!commandStore.canRedo"
          title="Redo"
          @click="handleRedo"
        >↪</button>
        <span v-if="projectStore.isDirty" class="dirty-indicator">●</span>
      </div>
    </header>

    <!-- Main area -->
    <div class="editor-main">
      <!-- Sidebar -->
      <aside class="editor-sidebar">
        <nav class="panel-tabs">
          <button
            :class="{ active: activeTab === 'tree' }"
            @click="activeTab = 'tree'"
          >Structure</button>
          <button
            :class="{ active: activeTab === 'bom' }"
            @click="activeTab = 'bom'"
          >BOM</button>
          <button
            :class="{ active: activeTab === 'checks' }"
            @click="activeTab = 'checks'"
          >
            Checks
            <span
              v-if="projectStore.checkIssues.length > 0"
              class="badge"
            >{{ projectStore.checkIssues.length }}</span>
          </button>
        </nav>
        <div class="panel-content">
          <StructureTree v-if="activeTab === 'tree'" />
          <BomPanel v-else-if="activeTab === 'bom'" />
          <ChecksPanel v-else-if="activeTab === 'checks'" />
        </div>
      </aside>

      <!-- 3D Viewport -->
      <main class="editor-viewport">
        <Viewport3D />
      </main>
    </div>
  </div>
</template>

<style scoped>
.editor-shell {
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
  background: #0f0f1a;
  color: #e0e0e0;
  font-family: 'SF Mono', 'Fira Code', monospace;
  font-size: 13px;
}

.editor-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 40px;
  padding: 0 12px;
  background: #1a1a2e;
  border-bottom: 1px solid #2a2a4a;
  flex-shrink: 0;
}

.toolbar-title {
  font-weight: 600;
  color: #a0b0ff;
}

.toolbar-actions {
  display: flex;
  align-items: center;
  gap: 4px;
}

.toolbar-actions button {
  background: none;
  border: 1px solid #3a3a5a;
  color: #c0c0e0;
  width: 28px;
  height: 28px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
}
.toolbar-actions button:disabled {
  opacity: 0.3;
  cursor: default;
}
.toolbar-actions button:hover:not(:disabled) {
  background: #2a2a4a;
}

.dirty-indicator {
  color: #f0a040;
  font-size: 12px;
  margin-left: 8px;
}

.editor-main {
  display: flex;
  flex: 1;
  overflow: hidden;
}

.editor-sidebar {
  width: 320px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  border-right: 1px solid #2a2a4a;
  background: #141428;
}

.panel-tabs {
  display: flex;
  border-bottom: 1px solid #2a2a4a;
}

.panel-tabs button {
  flex: 1;
  background: none;
  border: none;
  color: #8080a0;
  padding: 8px 0;
  font-size: 12px;
  cursor: pointer;
  font-family: inherit;
  position: relative;
}
.panel-tabs button.active {
  color: #a0b0ff;
  border-bottom: 2px solid #6070e0;
}
.panel-tabs button:hover {
  color: #c0c0e0;
}

.badge {
  background: #e04040;
  color: #fff;
  font-size: 10px;
  padding: 1px 5px;
  border-radius: 8px;
  margin-left: 4px;
}

.panel-content {
  flex: 1;
  overflow-y: auto;
}

.editor-viewport {
  flex: 1;
  position: relative;
  overflow: hidden;
}
</style>

// @profileaxis/web - Vue 3 UI, Pinia stores, Babylon integration, IndexedDB
// Must NOT be imported by any package

export { createWebApp } from './createApp';

// Stores
export { useProjectStore } from './stores/projectStore';
export { useSelectionStore } from './stores/selectionStore';
export { useCommandStore } from './stores/commandStore';

// Composables
export { useSceneAdapter } from './composables/useSceneAdapter';
export { useCatalog, getCatalog } from './composables/useCatalog';

// Services
export { api } from './services/api';
export { createCommandBus, registerHandler } from './services/commandBus';
export type { CommandHandler } from './services/commandBus';

// Components
export {
  EditorShell,
  Viewport3D,
  StructureTree,
  BomPanel,
  ChecksPanel,
} from './features/editor';

// Re-export types for consumers
export type { ProjectState, ProjectStore } from './createApp';

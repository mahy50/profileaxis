// @profileaxis/web - Vue 3 UI, Pinia stores, Babylon integration, IndexedDB
// Must NOT be imported by any package

import { createApp } from 'vue';
import { createPinia } from 'pinia';

// Placeholder app bootstrap - full implementation in P0-012
export function createWebApp() {
  const app = createApp({
    template: '<div id="app">ProfileAxis Web - P0-012 full implementation</div>',
  });
  app.use(createPinia());
  return app;
}

// Project store placeholder (simple object, full Pinia in P0-012)
export interface ProjectState {
  projectId: string | null;
  isDirty: boolean;
  lastSaved: string | null;
}

export interface ProjectStore {
  state: ProjectState;
  loadProject(id: string): void;
  markDirty(): void;
}

export function createProjectStore(): ProjectStore {
  const state: ProjectState = {
    projectId: null,
    isDirty: false,
    lastSaved: null,
  };
  return {
    state,
    loadProject(id: string) {
      state.projectId = id;
      state.isDirty = false;
    },
    markDirty() {
      state.isDirty = true;
    },
  };
}

export const useProjectStore = createProjectStore;

// Selection store placeholder
export interface SelectionState {
  selectedIds: string[];
  hoveredId: string | null;
}

export interface SelectionStore {
  state: SelectionState;
  select(ids: string[]): void;
  hover(id: string | null): void;
}

export function createSelectionStore(): SelectionStore {
  const state: SelectionState = {
    selectedIds: [],
    hoveredId: null,
  };
  return {
    state,
    select(ids: string[]) {
      state.selectedIds = ids;
    },
    hover(id: string | null) {
      state.hoveredId = id;
    },
  };
}

export const useSelectionStore = createSelectionStore;

// Command bus placeholder (full in P0-013)
export interface Command {
  type: string;
  payload: Record<string, unknown>;
}

export interface CommandBus {
  history: Command[];
  cursor: number;
  execute(cmd: Command): void;
  undo(): void;
  redo(): void;
}

export function createCommandBus(): CommandBus {
  const history: Command[] = [];
  let cursor = 0;
  return {
    get history() { return history; },
    get cursor() { return cursor; },
    execute(cmd: Command) {
      history.splice(cursor);
      history.push(cmd);
      cursor = history.length;
    },
    undo() {
      if (cursor > 0) cursor--;
    },
    redo() {
      if (cursor < history.length) cursor++;
    },
  };
}

export const useCommandBus = createCommandBus;

// Persistence service placeholder (full in P0-014)
export interface PersistenceService {
  saveProject(doc: unknown): Promise<void>;
  loadProject(id: string): Promise<unknown>;
  listProjects(): Promise<Array<{ id: string; name: string; updatedAt: string }>>;
  saveSnapshot(projectId: string, snapshot: unknown): Promise<string>;
  loadSnapshot(snapshotId: string): Promise<unknown>;
}

export function createPersistence(): PersistenceService {
  return {
    async saveProject(_doc: unknown) {
      console.log('Persistence: saveProject not yet implemented - P0-014');
    },
    async loadProject(_id: string) {
      console.log('Persistence: loadProject not yet implemented - P0-014');
      throw new Error('Not implemented');
    },
    async listProjects() {
      console.log('Persistence: listProjects not yet implemented - P0-014');
      return [];
    },
    async saveSnapshot(_projectId: string, _snapshot: unknown) {
      console.log('Persistence: saveSnapshot not yet implemented - P0-014');
      throw new Error('Not implemented');
    },
    async loadSnapshot(_snapshotId: string) {
      console.log('Persistence: loadSnapshot not yet implemented - P0-014');
      throw new Error('Not implemented');
    },
  };
}

export const usePersistence = createPersistence;

console.log('ProfileAxis Web bootstrap - full implementation in P0-012');

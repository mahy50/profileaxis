import { createApp } from 'vue';
import { createPinia } from 'pinia';
import App from './App.vue';

export function createWebApp() {
  const app = createApp(App);
  app.use(createPinia());
  return app;
}

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

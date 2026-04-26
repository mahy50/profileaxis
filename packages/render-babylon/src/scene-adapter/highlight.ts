// @profileaxis/render-babylon/scene-adapter/highlight
// Babylon HighlightLayer integration.
// Manages selected/hovered/highlighted/error states on meshes.

import type { Scene, Mesh } from '@babylonjs/core';
import type { HighlightState } from '../types.js';

export interface HighlightLayerManager {
  setState(state: HighlightState): void;
  dispose(): void;
}

/**
 * Build a HighlightLayerManager backed by Babylon's HighlightLayer.
 *
 * Architecture rules:
 * - Only stores transient visual state (not business state)
 * - Maps node/joint ids to Babylon mesh names
 * - Does NOT write back to domain or ProjectDocument
 */
export function createHighlightLayerManager(
  scene: Scene,
  options: {
    selectedColor?: string;
    hoveredColor?: string;
    blinkSpeed?: number;
  } = {},
): HighlightLayerManager {
  const {
    selectedColor = '#4fc3f7',
    hoveredColor = '#fff59d',
  } = options;

  // Dynamic import to keep Babylon types isolated to this file
  const { HighlightLayer, Color3 } = require('@babylonjs/core');
  const highlightLayer = new HighlightLayer('highlightLayer', scene, { isStroke: false });

  // Track current state
  let currentState: HighlightState = {
    selectedIds: [],
    hoveredIds: [],
    highlightedIds: [],
    errorIds: [],
  };

  function parseColor(hex: string): import('@babylonjs/core').Color3 {
    const r = parseInt(hex.slice(1, 3), 16) / 255;
    const g = parseInt(hex.slice(3, 5), 16) / 255;
    const b = parseInt(hex.slice(5, 7), 16) / 255;
    return new Color3(r, g, b);
  }

  function addHighlightForIds(ids: string[], colorHex: string) {
    if (ids.length === 0) return;
    const color = parseColor(colorHex);
    for (const id of ids) {
      const mesh = scene.getMeshByName(id);
      if (mesh) {
        highlightLayer.addMesh(mesh as Mesh, color);
      }
    }
  }

  function removeAllHighlights() {
    highlightLayer.removeAllMeshes();
  }

  return {
    setState(state: HighlightState) {
      currentState = state;

      // Remove all current highlights and rebuild by priority
      removeAllHighlights();

      // Priority order (lowest to highest):
      // highlighted (white) → hovered (yellow) → selected (blue) → error (red)
      addHighlightForIds(currentState.highlightedIds, '#ffffff');
      addHighlightForIds(currentState.hoveredIds, hoveredColor);
      addHighlightForIds(currentState.selectedIds, selectedColor);
      addHighlightForIds(currentState.errorIds, '#ef5350');
    },

    dispose() {
      highlightLayer.dispose();
    },
  };
}

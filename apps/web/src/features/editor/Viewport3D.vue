<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from 'vue';
import { useSceneAdapter } from '@/composables/useSceneAdapter';
import { useProjectStore } from '@/stores/projectStore';

const projectStore = useProjectStore();
const canvasRef = ref<HTMLCanvasElement | null>(null);
const containerRef = ref<HTMLDivElement | null>(null);

const {
  isReady,
  init,
  rebuild,
  handlePick,
  handlePointerMove,
} = useSceneAdapter(canvasRef);

function resizeCanvas() {
  if (!canvasRef.value || !containerRef.value) return;
  const rect = containerRef.value.getBoundingClientRect();
  canvasRef.value.width = rect.width * window.devicePixelRatio;
  canvasRef.value.height = rect.height * window.devicePixelRatio;
  canvasRef.value.style.width = `${rect.width}px`;
  canvasRef.value.style.height = `${rect.height}px`;
}

onMounted(() => {
  resizeCanvas();
  init();
  if (projectStore.resolvedDsl.nodes.length > 0) {
    rebuild();
  }
  window.addEventListener('resize', resizeCanvas);
});

onUnmounted(() => {
  window.removeEventListener('resize', resizeCanvas);
});

// Rebuild when project loaded (watch in composable handles changes)
watch(() => projectStore.projectDoc, () => {
  if (isReady.value) rebuild();
}, { deep: true });
</script>

<script lang="ts">
export default { name: 'Viewport3D' };
</script>

<template>
  <div ref="containerRef" class="viewport-container">
    <canvas
      ref="canvasRef"
      class="viewport-canvas"
      @click="handlePick"
      @pointermove="handlePointerMove"
    />
    <div v-if="!isReady" class="viewport-placeholder">
      Initializing 3D viewport...
    </div>
  </div>
</template>

<style scoped>
.viewport-container {
  width: 100%;
  height: 100%;
  position: relative;
}

.viewport-canvas {
  display: block;
  width: 100%;
  height: 100%;
  outline: none;
  touch-action: none;
}

.viewport-placeholder {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #606080;
  font-size: 14px;
}
</style>

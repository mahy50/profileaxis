<script setup lang="ts">
import { computed } from 'vue';
import { useProjectStore } from '@/stores/projectStore';
import { useSelectionStore } from '@/stores/selectionStore';
import type { DesignBomItem, TradeBomItem } from '@profileaxis/domain';

const projectStore = useProjectStore();
const selectionStore = useSelectionStore();

type BomView = 'design' | 'trade';

const currentBomView = ref<BomView>('design');

const designItems = computed<DesignBomItem[]>(() => projectStore.designBom);
const tradeItems = computed<TradeBomItem[]>(() => projectStore.tradeBom);

function selectNodes(nodeIds: string[]) {
  selectionStore.select(nodeIds);
}
</script>

<script lang="ts">
import { ref } from 'vue';
export default { name: 'BomPanel' };
</script>

<template>
  <div class="bom-panel">
    <div class="bom-view-toggle">
      <button
        :class="{ active: currentBomView === 'design' }"
        @click="currentBomView = 'design'"
      >Design BOM</button>
      <button
        :class="{ active: currentBomView === 'trade' }"
        @click="currentBomView = 'trade'"
      >Trade BOM</button>
    </div>

    <!-- Design BOM -->
    <table v-if="currentBomView === 'design'" class="bom-table">
      <thead>
        <tr>
          <th>ID</th>
          <th>Role</th>
          <th>Spec</th>
          <th>Qty</th>
          <th>Length</th>
          <th>Map</th>
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="item in designItems"
          :key="item.id"
          @click="selectNodes(item.nodeIds)"
        >
          <td class="cell-id">{{ item.id.slice(0, 8) }}</td>
          <td>{{ item.role }}</td>
          <td>{{ item.profileSpecKey || item.connectorSpecKey || '-' }}</td>
          <td class="cell-num">{{ item.quantity }}</td>
          <td class="cell-num">{{ item.lengthMm?.toFixed(0) ?? '-' }}mm</td>
          <td>
            <span
              class="mapping-badge"
              :class="'map-' + item.mappingStatus"
            >{{ item.mappingStatus }}</span>
          </td>
        </tr>
      </tbody>
    </table>

    <!-- Trade BOM -->
    <table v-else class="bom-table">
      <thead>
        <tr>
          <th>SKU</th>
          <th>Supplier</th>
          <th>Qty</th>
          <th>Price</th>
          <th>Total</th>
          <th>Lead</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="item in tradeItems" :key="item.sku + item.supplierId">
          <td class="cell-id">{{ item.sku }}</td>
          <td>{{ item.supplierId }}</td>
          <td class="cell-num">{{ item.quantity }}</td>
          <td class="cell-num">¥{{ item.unitPrice.toFixed(2) }}</td>
          <td class="cell-num">¥{{ item.totalCost.toFixed(2) }}</td>
          <td class="cell-num">{{ item.leadTimeDays }}d</td>
        </tr>
      </tbody>
    </table>

    <div v-if="currentBomView === 'design' && designItems.length === 0" class="empty-hint">
      No BOM items computed yet. Load a project with resolved DSL.
    </div>
    <div v-else-if="currentBomView === 'trade' && tradeItems.length === 0" class="empty-hint">
      No trade items computed.
    </div>
  </div>
</template>

<style scoped>
.bom-panel {
  padding: 8px 0;
}

.bom-view-toggle {
  display: flex;
  gap: 4px;
  padding: 0 8px 8px;
}
.bom-view-toggle button {
  flex: 1;
  background: none;
  border: 1px solid #3a3a5a;
  color: #8080a0;
  padding: 4px 8px;
  font-size: 11px;
  cursor: pointer;
  border-radius: 3px;
  font-family: inherit;
}
.bom-view-toggle button.active {
  border-color: #5060c0;
  color: #a0b0ff;
  background: #1a1a40;
}

.bom-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 11px;
}
.bom-table th {
  text-align: left;
  padding: 4px 8px;
  color: #6060a0;
  font-weight: 600;
  font-size: 10px;
  text-transform: uppercase;
  border-bottom: 1px solid #2a2a4a;
}
.bom-table td {
  padding: 3px 8px;
  border-bottom: 1px solid #1a1a30;
  color: #b0b0d0;
}
.bom-table tr {
  cursor: pointer;
}
.bom-table tr:hover {
  background: #1e1e3a;
}

.cell-id { font-family: 'SF Mono', monospace; font-size: 10px; }
.cell-num { text-align: right; font-family: 'SF Mono', monospace; }

.mapping-badge {
  font-size: 9px;
  padding: 1px 5px;
  border-radius: 3px;
}
.map-mapped { background: #1a3a1a; color: #60d060; }
.map-unmapped { background: #3a1a1a; color: #d06060; }
.map-ambiguous { background: #3a3a1a; color: #d0d060; }

.empty-hint {
  padding: 24px 12px;
  text-align: center;
  color: #606080;
  font-size: 12px;
}
</style>

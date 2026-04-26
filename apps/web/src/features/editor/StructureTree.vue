<script setup lang="ts">
import { computed } from 'vue';
import { useProjectStore } from '@/stores/projectStore';
import { useSelectionStore } from '@/stores/selectionStore';
import type { StructuralNode, JointNode } from '@profileaxis/domain';

const projectStore = useProjectStore();
const selectionStore = useSelectionStore();

interface TreeNode {
  id: string;
  label: string;
  kind: 'node' | 'joint' | 'group';
  role?: string;
  children: TreeNode[];
  expanded: boolean;
}

// Build a tree from structural nodes grouped by semantic path prefix
const tree = computed<TreeNode[]>(() => {
  const nodes = projectStore.structuralNodes;
  const joints = projectStore.jointNodes;
  if (nodes.length === 0 && joints.length === 0) {
    return [{ id: 'empty', label: 'No structure yet', kind: 'group', children: [], expanded: true }];
  }

  const root: TreeNode[] = [];

  // Group nodes by their semantic path prefix (first 2 segments)
  const groups = new Map<string, { nodes: StructuralNode[]; joints: JointNode[] }>();
  for (const node of nodes) {
    const parts = node.semanticPath.split('/').filter(Boolean);
    const groupKey = parts.slice(0, 2).join('/') || 'root';
    if (!groups.has(groupKey)) {
      groups.set(groupKey, { nodes: [], joints: [] });
    }
    groups.get(groupKey)!.nodes.push(node);
  }
  for (const joint of joints) {
    const parts = joint.semanticPath.split('/').filter(Boolean);
    const groupKey = parts.slice(0, 2).join('/') || 'root';
    if (!groups.has(groupKey)) {
      groups.set(groupKey, { nodes: [], joints: [] });
    }
    groups.get(groupKey)!.joints.push(joint);
  }

  for (const [groupKey, group] of groups) {
    const children: TreeNode[] = [];
    for (const node of group.nodes) {
      children.push({
        id: node.nodeId,
        label: `${node.role} (${node.profileSpecKey})`,
        kind: 'node',
        role: node.role,
        children: [],
        expanded: true,
      });
    }
    for (const joint of group.joints) {
      children.push({
        id: joint.jointId,
        label: `${joint.topology} @ ${joint.connectorSpecKey}`,
        kind: 'joint',
        children: [],
        expanded: true,
      });
    }

    root.push({
      id: groupKey,
      label: groupKey === 'root' ? 'Structure' : groupKey,
      kind: 'group',
      children,
      expanded: true,
    });
  }

  return root;
});

function isSelected(id: string): boolean {
  return selectionStore.selectedIds.includes(id);
}

function handleClick(id: string, event: MouseEvent) {
  if (event.shiftKey) {
    selectionStore.toggleSelect(id);
  } else {
    selectionStore.select([id]);
  }
}
</script>

<script lang="ts">
export default { name: 'StructureTree' };
</script>

<template>
  <div class="structure-tree">
    <template v-for="group in tree" :key="group.id">
      <div class="tree-group">
        <div class="tree-group-header">{{ group.label }}</div>
        <div
          v-for="item in group.children"
          :key="item.id"
          class="tree-item"
          :class="{
            selected: isSelected(item.id),
            'kind-node': item.kind === 'node',
            'kind-joint': item.kind === 'joint',
          }"
          @click="handleClick(item.id, $event)"
        >
          <span class="tree-icon">{{ item.kind === 'node' ? '◻' : '◎' }}</span>
          <span class="tree-role" v-if="item.role">{{ item.role }}</span>
          <span class="tree-label">{{ item.label }}</span>
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.structure-tree {
  padding: 8px 0;
  user-select: none;
}

.tree-group {
  margin-bottom: 4px;
}

.tree-group-header {
  padding: 6px 12px;
  font-size: 11px;
  font-weight: 600;
  color: #6070c0;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.tree-item {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 12px 4px 20px;
  cursor: pointer;
  font-size: 12px;
  color: #c0c0e0;
  border-left: 2px solid transparent;
  transition: background 0.1s;
}
.tree-item:hover {
  background: #1e1e3a;
}
.tree-item.selected {
  background: #1a1a40;
  border-left-color: #6070e0;
  color: #ffffff;
}

.tree-icon {
  font-size: 10px;
  color: #8080a0;
  width: 14px;
  text-align: center;
}

.tree-role {
  color: #9090c0;
  font-size: 10px;
  min-width: 48px;
}

.tree-label {
  color: #a0a0c0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>

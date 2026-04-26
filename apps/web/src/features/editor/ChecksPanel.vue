<script setup lang="ts">
import { computed } from 'vue';
import { useProjectStore } from '@/stores/projectStore';
import { useSelectionStore } from '@/stores/selectionStore';
import type { CheckIssue } from '@profileaxis/domain';

const projectStore = useProjectStore();
const selectionStore = useSelectionStore();

const issues = computed<CheckIssue[]>(() => projectStore.checkIssues);

const blockers = computed(() => issues.value.filter(i => i.severity === 'blocker'));
const warnings = computed(() => issues.value.filter(i => i.severity === 'warning'));
const infos = computed(() => issues.value.filter(i => i.severity === 'info'));

function severityIcon(severity: string): string {
  switch (severity) {
    case 'blocker': return '⛔';
    case 'warning': return '⚠';
    case 'info': return 'ℹ';
    default: return '•';
  }
}

function severityClass(severity: string): string {
  return 'sev-' + severity;
}

function handleClick(issue: CheckIssue) {
  if (issue.nodeIds && issue.nodeIds.length > 0) {
    selectionStore.select(issue.nodeIds);
  }
  if (issue.semanticPaths && issue.semanticPaths.length > 0) {
    selectionStore.setHighlighted(issue.nodeIds ?? []);
  }
}
</script>

<script lang="ts">
export default { name: 'ChecksPanel' };
</script>

<template>
  <div class="checks-panel">
    <div v-if="issues.length === 0" class="empty-hint">
      No issues detected. ✓
    </div>

    <template v-else>
      <div v-if="blockers.length > 0" class="severity-section">
        <div class="severity-header sev-blocker">
          ⛔ Blockers ({{ blockers.length }})
        </div>
        <div
          v-for="issue in blockers"
          :key="issue.issueId"
          class="issue-item sev-blocker"
          @click="handleClick(issue)"
        >
          <span class="issue-icon">{{ severityIcon(issue.severity) }}</span>
          <div class="issue-content">
            <div class="issue-message">{{ issue.message }}</div>
            <div v-if="issue.fixSuggestion" class="issue-fix">{{ issue.fixSuggestion }}</div>
          </div>
        </div>
      </div>

      <div v-if="warnings.length > 0" class="severity-section">
        <div class="severity-header sev-warning">
          ⚠ Warnings ({{ warnings.length }})
        </div>
        <div
          v-for="issue in warnings"
          :key="issue.issueId"
          class="issue-item sev-warning"
          @click="handleClick(issue)"
        >
          <span class="issue-icon">{{ severityIcon(issue.severity) }}</span>
          <div class="issue-content">
            <div class="issue-message">{{ issue.message }}</div>
            <div v-if="issue.fixSuggestion" class="issue-fix">{{ issue.fixSuggestion }}</div>
          </div>
        </div>
      </div>

      <div v-if="infos.length > 0" class="severity-section">
        <div class="severity-header sev-info">
          ℹ Info ({{ infos.length }})
        </div>
        <div
          v-for="issue in infos"
          :key="issue.issueId"
          class="issue-item sev-info"
          @click="handleClick(issue)"
        >
          <span class="issue-icon">{{ severityIcon(issue.severity) }}</span>
          <div class="issue-content">
            <div class="issue-message">{{ issue.message }}</div>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.checks-panel {
  padding: 8px 0;
}

.empty-hint {
  padding: 24px 12px;
  text-align: center;
  color: #60d060;
  font-size: 12px;
}

.severity-section {
  margin-bottom: 12px;
}

.severity-header {
  padding: 4px 12px;
  font-size: 11px;
  font-weight: 600;
}
.severity-header.sev-blocker { color: #e06060; }
.severity-header.sev-warning { color: #e0c040; }
.severity-header.sev-info { color: #6080c0; }

.issue-item {
  display: flex;
  gap: 8px;
  padding: 6px 12px;
  cursor: pointer;
  border-left: 2px solid transparent;
  font-size: 12px;
}
.issue-item:hover {
  background: #1e1e3a;
}
.issue-item.sev-blocker { border-left-color: #c04040; }
.issue-item.sev-warning { border-left-color: #c0a030; }
.issue-item.sev-info { border-left-color: #4060a0; }

.issue-icon {
  flex-shrink: 0;
  width: 16px;
  text-align: center;
  font-size: 12px;
}

.issue-content {
  flex: 1;
  min-width: 0;
}

.issue-message {
  color: #c0c0e0;
  line-height: 1.4;
}

.issue-fix {
  color: #609060;
  font-size: 11px;
  margin-top: 2px;
  font-style: italic;
}
</style>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { useProjectStore } from '@/stores/projectStore';
import { createCommandBus } from '@/services/commandBus';
import { interpretEdit } from '@/services/editInterpreter';
import type { InterpretResult } from '@/services/editInterpreter';

defineOptions({
  name: 'ChatCommandInput',
});

const emit = defineEmits<{
  (e: 'command-executed', result: InterpretResult): void;
  (e: 'command-error', error: string): void;
}>();

const projectStore = useProjectStore();
const bus = createCommandBus();

const inputText = ref('');
const isProcessing = ref(false);
const feedback = ref<{
  type: 'success' | 'error' | 'info';
  text: string;
} | null>(null);

const history = ref<Array<{ text: string; result: string }>>([]);
const historyIndex = ref(-1);

const showInput = ref(true);

function clearFeedback() {
  feedback.value = null;
}

async function executeCommand() {
  const text = inputText.value.trim();
  if (!text || isProcessing.value) return;

  isProcessing.value = true;
  clearFeedback();

  try {
    const dsl = projectStore.resolvedDsl;
    const result = await interpretEdit(text, dsl);

    if (!result) {
      feedback.value = {
        type: 'error',
        text: '无法理解该指令，请尝试其他表述方式。',
      };
      return;
    }

    if (result.needsFollowUp) {
      feedback.value = {
        type: 'info',
        text: result.followUpQuestion ?? '需要更多信息来完成操作。',
      };
      return;
    }

    bus.execute(result.commandType, result.commandPayload, {
      source: 'user-chat',
      targetRefs: result.targetRefs,
    });

    const sourceLabel = result.source === 'local' ? '本地' : 'AI';
    history.value.push({ text, result: `${sourceLabel} → ${result.commandType}` });

    feedback.value = {
      type: 'success',
      text: `已执行: ${result.commandType} (${sourceLabel})`,
    };

    emit('command-executed', result);
    inputText.value = '';
    historyIndex.value = -1;
  } catch (err) {
    const message = err instanceof Error ? err.message : '执行失败';
    feedback.value = { type: 'error', text: message };
    emit('command-error', message);
  } finally {
    isProcessing.value = false;
  }
}

function handleKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    executeCommand();
  }
  if (e.key === 'ArrowUp') {
    e.preventDefault();
    if (history.value.length > 0) {
      historyIndex.value = Math.min(historyIndex.value + 1, history.value.length - 1);
      inputText.value = history.value[history.value.length - 1 - historyIndex.value].text;
    }
  }
  if (e.key === 'ArrowDown') {
    e.preventDefault();
    if (historyIndex.value > 0) {
      historyIndex.value--;
      inputText.value = history.value[history.value.length - 1 - historyIndex.value].text;
    } else {
      historyIndex.value = -1;
      inputText.value = '';
    }
  }
  if (e.key === 'Escape') {
    inputText.value = '';
  }
}

const placeholderText = computed(() => {
  const moduleCount = projectStore.resolvedDsl.modules.length;
  const levelCount = projectStore.resolvedDsl.nodes.filter(
    (n) => n.semanticPath.startsWith('beam/front/'),
  ).length;
  return `输入编辑指令 (${moduleCount}隔间, ${levelCount}层)... 例如: 宽度改为1500`;
});
</script>

<template>
  <div class="chat-command" v-if="showInput">
    <!-- Quick action chips -->
    <div class="quick-actions">
      <button
        v-for="label in ['宽度', '高度', '深度', '增加一层', '删除一层', '后撑']"
        :key="label"
        class="action-chip"
        @click="inputText = label"
      >{{ label }}</button>
      <button
        class="action-chip toggle-btn"
        @click="showInput = false"
        title="Hide input"
      >−</button>
    </div>

    <!-- Input area -->
    <div class="input-area">
      <input
        ref="inputEl"
        v-model="inputText"
        type="text"
        :placeholder="placeholderText"
        :disabled="isProcessing"
        class="command-input"
        @keydown="handleKeydown"
      />
      <button
        class="send-btn"
        :disabled="!inputText.trim() || isProcessing"
        @click="executeCommand"
      >
        {{ isProcessing ? '…' : '→' }}
      </button>
    </div>

    <!-- Feedback -->
    <div
      v-if="feedback"
      :class="['feedback', `feedback-${feedback.type}`]"
    >
      {{ feedback.text }}
      <button class="feedback-dismiss" @click="clearFeedback">×</button>
    </div>
  </div>

  <!-- Collapsed toggle -->
  <div v-else class="chat-toggle">
    <button @click="showInput = true; inputText = ''" title="Show command input">
      + 编辑指令
    </button>
  </div>
</template>

<style scoped>
.chat-command {
  border-top: 1px solid #2a2a4a;
  background: #141428;
  flex-shrink: 0;
}

.quick-actions {
  display: flex;
  gap: 4px;
  padding: 6px 8px 2px;
  flex-wrap: wrap;
}

.action-chip {
  background: #1e1e38;
  border: 1px solid #3a3a5a;
  color: #a0a0c0;
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 10px;
  cursor: pointer;
  font-family: inherit;
  transition: background 0.15s, color 0.15s;
}
.action-chip:hover {
  background: #2a2a5a;
  color: #d0d0f0;
}

.toggle-btn {
  margin-left: auto;
  font-size: 13px;
  min-width: 24px;
  text-align: center;
}

.input-area {
  display: flex;
  align-items: center;
  padding: 4px 8px 6px;
  gap: 6px;
}

.command-input {
  flex: 1;
  background: #1a1a30;
  border: 1px solid #3a3a4a;
  color: #e0e0f0;
  padding: 6px 10px;
  border-radius: 6px;
  font-family: inherit;
  font-size: 13px;
  outline: none;
  transition: border-color 0.15s;
}
.command-input:focus {
  border-color: #5060c0;
}
.command-input:disabled {
  opacity: 0.5;
}
.command-input::placeholder {
  color: #606080;
}

.send-btn {
  background: #3040a0;
  border: none;
  color: #fff;
  width: 30px;
  height: 30px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 14px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.15s;
}
.send-btn:hover:not(:disabled) {
  background: #4050c0;
}
.send-btn:disabled {
  opacity: 0.4;
  cursor: default;
}

.feedback {
  padding: 4px 10px 6px;
  font-size: 12px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-top: 1px solid #2a2a4a;
}
.feedback-success {
  color: #60d080;
  background: rgba(60, 200, 80, 0.08);
}
.feedback-error {
  color: #e06060;
  background: rgba(200, 60, 60, 0.08);
}
.feedback-info {
  color: #60a0e0;
  background: rgba(60, 120, 200, 0.08);
}

.feedback-dismiss {
  background: none;
  border: none;
  color: inherit;
  cursor: pointer;
  font-size: 14px;
  opacity: 0.6;
  padding: 0 4px;
}
.feedback-dismiss:hover {
  opacity: 1;
}

.chat-toggle {
  border-top: 1px solid #2a2a4a;
  padding: 4px 8px;
  background: #141428;
}
.chat-toggle button {
  background: #1e1e38;
  border: 1px solid #3a3a5a;
  color: #8080a0;
  font-size: 11px;
  padding: 3px 10px;
  border-radius: 4px;
  cursor: pointer;
  font-family: inherit;
}
.chat-toggle button:hover {
  color: #c0c0e0;
}
</style>

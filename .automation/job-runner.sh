#!/usr/bin/env bash
# job-runner.sh — profileaxis automation runner
# 调度策略：每 60 分钟一次，单任务串行，带锁/心跳/超时/重试

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
AUTOMATION_DIR="$REPO_ROOT/.automation"
STATE_FILE="$AUTOMATION_DIR/project-state.json"
LOCK_FILE="$AUTOMATION_DIR/locks/hourly-run.lock"
RUN_ID="$(date +%Y%m%d%H%M%S)-$$"

# ─── 工具函数 ───────────────────────────────────────────────
log()  { echo "[$(date '+%Y-%m-%d %H:%M:%S')] [runner] $*" >&2; }
warn() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] [runner] WARN: $*" >&2; }
die()  { log "FATAL: $*" ; exit 1; }

# JSON 读取（python）
json_get() {
  python3 -c "import json,sys; d=json.load(open('$STATE_FILE')); print(json.dumps(d${1:-}, ensure_ascii=False))"
}
json_set() {
  local path="$1"; local val="$2"
  python3 - << PYEOF
import json, sys
d = json.load(open('$STATE_FILE'))
keys = '$path'.split('.')
v = d
for k in keys[:-1]:
    v = v[k]
v[keys[-1]] = $val
json.dump(d, open('$STATE_FILE', 'w'), ensure_ascii=False, indent=2)
PYEOF
}

# 读取任务板，返回第一个 queued 任务的 taskId
pick_next_task() {
  local tasks_md="$REPO_ROOT/docs/06-task-board.md"
  grep -m1 '^| P0-' "$tasks_md" 2>/dev/null | \
    awk -F'|' '{gsub(/ /,"",$2); gsub(/ /,"",$7); if($7~/queued/) print $2}' | \
    head -1
}

# 读取当前 activeTaskId
get_active_task() {
  python3 -c "import json; d=json.load(open('$STATE_FILE')); print(d.get('activeTaskId',''))"
}

# 检查锁文件是否存活
is_locked() {
  if [[ ! -f "$LOCK_FILE" ]]; then return 1; fi
  local lock_age=$(($(date +%s) - $(stat -c %Y "$LOCK_FILE" 2>/dev/null || echo 0)))
  # 锁超过 55 分钟视为无效
  [[ $lock_age -gt 3300 ]] && return 1
  return 0
}

# 取全局锁
acquire_lock() {
  mkdir -p "$(dirname "$LOCK_FILE")"
  echo "{\"runId\":\"$RUN_ID\",\"activeTaskId\":\"${1:-null}\",\"startedAt\":\"$(date -Iseconds)\",\"heartbeatAt\":\"$(date -Iseconds)\"}" \
    > "$LOCK_FILE"
}

# 释放锁
release_lock() { rm -f "$LOCK_FILE"; }

# 写心跳
write_heartbeat() {
  local task_id="$1"
  mkdir -p "$AUTOMATION_DIR/heartbeats"
  echo "{\"taskId\":\"$task_id\",\"runId\":\"$RUN_ID\",\"heartbeatAt\":\"$(date -Iseconds)\"}" \
    > "$AUTOMATION_DIR/heartbeats/${task_id}.json"
}

# 检查心跳是否 stale
is_stale() {
  local task_id="$1"
  local hb_file="$AUTOMATION_DIR/heartbeats/${task_id}.json"
  [[ ! -f "$hb_file" ]] && return 0
  local age=$(($(date +%s) - $(date -r "$hb_file" +%s 2>/dev/null || echo 0)))
  [[ $age -gt 600 ]] && return 0
  return 1
}

# 生成结构化结果文件
write_result() {
  local task_id="$1"; local status="$2"; local changed_files="$3"
  local result_file="$AUTOMATION_DIR/results/${task_id}.result.json"
  mkdir -p "$(dirname "$result_file")"
  cat > "$result_file" << EOF
{
  "taskId": "$task_id",
  "runId": "$RUN_ID",
  "status": "$status",
  "changedFiles": $changed_files,
  "completedAt": "$(date -Iseconds)"
}
EOF
}

# ─── 主流程 ────────────────────────────────────────────────

log "=== Runner starting (run=$RUN_ID) ==="

# 1. 检查锁
if is_locked; then
  active=$(get_active_task)
  log "Lock exists for task=$active, checking stale..."
  if [[ -n "$active" ]] && is_stale "$active"; then
    warn "Task $active is stale, will takeover"
  else
    log "Another runner active, exiting"
    exit 0
  fi
fi

# 2. 取锁
acquire_lock
trap release_lock EXIT

# 3. 读取当前状态
active_task=$(get_active_task)

# 4. 如有活动任务，优先恢复/补验收
if [[ -n "$active_task" ]]; then
  log "Resuming active task: $active_task"
  if is_stale "$active_task"; then
    log "Task $active_task is stale, marking and will repick"
    # 标记 stale，重试计数
    python3 - << PYEOF
import json
d = json.load(open('$STATE_FILE'))
rb = d['retryBudget'].setdefault('$active_task', {'attempts': 0, 'lastStatus': 'stale'})
rb['attempts'] = rb.get('attempts', 0) + 1
rb['lastStatus'] = 'stale'
if rb['attempts'] >= 2:
    d.setdefault('blockedTasks', []).append('$active_task')
    d['activeTaskId'] = None
    print('blocked')
else:
    d['activeTaskId'] = None
    print('retry')
json.dump(d, open('$STATE_FILE', 'w'), ensure_ascii=False, indent=2)
PYEOF
  else
    log "Task $active_task still alive, write heartbeat"
    write_heartbeat "$active_task"
    exit 0
  fi
fi

# 5. 无活动任务，pick 下一个 queued 任务
task_id=$(pick_next_task)
if [[ -z "$task_id" ]]; then
  log "No queued tasks found, exiting"
  exit 0
fi

log "Picked task: $task_id"

# 6. 更新状态
python3 - << PYEOF
import json
d = json.load(open('$STATE_FILE'))
d['activeTaskId'] = '$task_id'
d['activeRunId'] = '$RUN_ID'
d['retryBudget']['$task_id'] = {'attempts': 0, 'lastStatus': 'picked'}
json.dump(d, open('$STATE_FILE', 'w'), ensure_ascii=False, indent=2)
PYEOF

# 7. 写任务包
mkdir -p "$AUTOMATION_DIR/tasks"
cat > "$AUTOMATION_DIR/tasks/${task_id}.json" << EOF
{
  "taskId": "$task_id",
  "runId": "$RUN_ID",
  "repoRoot": "$REPO_ROOT",
  "goal": "执行 docs/06-task-board.md 中 taskId=$task_id 对应任务",
  "inputs": [
    "docs/02-architecture.md",
    "docs/03-monorepo-design.md",
    "docs/04-api-contracts.md",
    "docs/06-task-board.md",
    "docs/07-acceptance-gates.md"
  ],
  "constraints": [
    "只允许修改 docs/06-task-board.md 中该任务的目录",
    "不得破坏依赖方向",
    "必须更新 docs/06-task-board.md 状态为 completed/failed/blocked",
    "必须输出结构化结果到 .automation/results/${task_id}.result.json"
  ],
  "acceptanceGateId": "gate-${task_id}"
}
EOF

# 8. 写初始心跳
write_heartbeat "$task_id"

# 9. 读取任务板，找到下一个任务（用于提示）
python3 - << PYEOF
import re
with open('$REPO_ROOT/docs/06-task-board.md') as f:
    content = f.read()
# 找 P0 任务列表，确定下一个
lines = [l for l in content.split('\n') if l.startswith('| P0-')]
next_idx = -1
for i, l in enumerate(lines):
    tid = re.split(r'\|', l)[2].strip()
    if tid == '$task_id':
        next_idx = i + 1
        break
if next_idx >= 0 and next_idx < len(lines):
    next_tid = re.split(r'\|', lines[next_idx])[2].strip()
    print(next_tid)
else:
    print('')
PYEOF
next_task=$(python3 -c "import re; lines=open('$REPO_ROOT/docs/06-task-board.md').read().split('\n'); [print(re.split(r'\|',l)[2].strip()) for l in lines if l.startswith('| P0-') and l.count('|')>=7]" 2>/dev/null | tail -1)

echo "Next task after $task_id: $next_task"

log "=== Runner finished ==="
log "Next step: run OpenClaw isolated session with task $task_id"
echo "RUNNER_OUTPUT: TASK_PICKED=$task_id NEXT=$next_task RUN_ID=$RUN_ID"

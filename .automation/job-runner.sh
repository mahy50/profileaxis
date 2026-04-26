#!/usr/bin/env bash
# job-runner.sh — profileaxis 自动化任务执行器
# 每小时运行一次，串行处理 P0 任务，含锁/心跳/超时/重试/执行/验收
set -euo pipefail

# ─── 环境 ──────────────────────────────────────────────────
export ANTHROPIC_API_KEY="${ANTHROPIC_API_KEY:-sk-2aeff343618145eb90efb54d3fcc5cf6}"
export ANTHROPIC_BASE_URL="${ANTHROPIC_BASE_URL:-https://api.deepseek.com/anthropic}"

REPO_ROOT="${REPO_ROOT:-$(cd "$(dirname "$0")/.." && pwd)}"
AUTOMATION_DIR="$REPO_ROOT/.automation"
STATE_FILE="$AUTOMATION_DIR/project-state.json"
SCHED_FILE="$AUTOMATION_DIR/scheduler-config.json"
LOCK_FILE="$AUTOMATION_DIR/locks/hourly-run.lock"
RUN_ID="$(date +%Y%m%d%H%M%S)-$$"
TASK_BOARD="$REPO_ROOT/docs/06-task-board.md"
GATES="$REPO_ROOT/docs/07-acceptance-gates.md"
TASK_TEMPLATE="$AUTOMATION_DIR/tasks/runner-task.txt"
LOGFILE="$REPO_ROOT/.automation/logs/runner-$(date +%Y%m%d).log"

# ─── 初始化 ──────────────────────────────────────────────────
mkdir -p "$AUTOMATION_DIR"/{locks,heartbeats,results,runs,tasks,logs}
exec >> "$LOGFILE" 2>&1

log()  { echo "[$(date '+%H:%M:%S')] $*"; }
warn() { echo "[$(date '+%H:%M:%S')] WARN: $*"; }
die()  { log "FATAL: $*"; exit 1; }

# ─── 工具函数 ──────────────────────────────────────────────────

json_get() { python3 -c "import json; d=json.load(open('$STATE_FILE')); print(json.dumps(${1:-d}, ensure_ascii=False))" 2>/dev/null || echo "null"; }
json_set() {
  python3 -c "
import json
d=json.load(open('$STATE_FILE'))
keys='$1'.split('.')
v=d
for k in keys[:-1]: v=v[k]
v[keys[-1]]=$2
json.dump(d, open('$STATE_FILE','w'), ensure_ascii=False, indent=2)
" 2>/dev/null || warn "json_set failed: $1=$2"
}

pick_next_task() {
  python3 -c "
with open('$TASK_BOARD') as f:
    lines = f.readlines()
for l in lines:
    if l.startswith('| P0-'):
        cols = [c.strip() for c in l.split('|')]
        # 8 列: TaskId|标题|目标|依赖|输入|输出|验收标准|状态
        if len(cols) >= 9 and cols[8] == 'queued':
            print(cols[1])
            break
" 2>/dev/null
}

is_locked() {
  [[ ! -f "$LOCK_FILE" ]] && return 1
  local lock_age=$(($(date +%s) - $(stat -f %m "$LOCK_FILE" 2>/dev/null || echo 0)))
  [[ $lock_age -gt 3300 ]] && { warn "Lock expired (${lock_age}s old)"; return 1; }
  return 0
}

acquire_lock() {
  cat > "$LOCK_FILE" << EOF
{"runId":"$RUN_ID","activeTaskId":"${1:-null}","startedAt":"$(date -Iseconds)"}
EOF
}

release_lock() { rm -f "$LOCK_FILE"; }

write_heartbeat() {
  cat > "$AUTOMATION_DIR/heartbeats/${1}.json" << EOF
{"taskId":"$1","runId":"$RUN_ID","heartbeatAt":"$(date -Iseconds)","status":"${2:-executing}"}
EOF
}

is_stale() {
  local hb="$AUTOMATION_DIR/heartbeats/${1}.json"
  [[ ! -f "$hb" ]] && return 0
  local age=$(($(date +%s) - $(stat -f %m "$hb" 2>/dev/null || date +%s)))
  [[ $age -gt 600 ]] && return 0
  return 1
}

# 从 task-board 提取指定任务的描述
get_task_description() {
  python3 -c "
import re
with open('$TASK_BOARD') as f:
    content = f.read()

# 找 P0 任务表中匹配的行
for l in content.split('\n'):
    if l.startswith('| $1 '):
        cols = [c.strip() for c in l.split('|')]
        print(f'任务ID: {cols[2]}')
        print(f'目标: {cols[3]}')
        print(f'依赖: {cols[4]}')
        print(f'输入: {cols[5]}')
        print(f'输出: {cols[6]}')
        print(f'验收: {cols[7]}')
        break

# 提取该任务下方的详细说明（到下一个任务或空行为止）
lines = content.split('\n')
in_section = False
desc_lines = []
for l in lines:
    if l.strip().startswith('**$1'):
        in_section = True
        continue
    if in_section:
        if l.strip().startswith('**P0-'):
            break
        if l.strip():
            desc_lines.append(l.strip())
if desc_lines:
    print('详细说明:')
    for dl in desc_lines[:20]:
        print(f'  {dl}')
" 2>/dev/null
}

# 提取验收标准
get_gate_info() {
  python3 -c "
import re
with open('$GATES') as f:
    content = f.read()
# 找对应 Gate 段落
pattern = rf'### Gate {{{{task_id}}}}\b'
match = re.search(pattern.replace('{{task_id}}', '$1'), content)
if match:
    start = match.start()
    # 找下一个 ### Gate
    next_gate = re.search(r'### Gate', content[start+10:])
    end = start + 10 + next_gate.start() if next_gate else len(content)
    print(content[start:end][:2000])
else:
    print('(未找到对应 Gate)')
" 2>/dev/null
}

# 检查是否所有 P0 都完成了
all_done() {
  local remaining=$(python3 -c "
import re
with open('$TASK_BOARD') as f:
    lines = f.readlines()
remaining = [l for l in lines if l.startswith('| P0-')]
queued = [l for l in remaining if 'queued' in l.split('|')[7].strip() if len(l.split('|'))>=8]
if queued:
    print(len(queued))
" 2>/dev/null)
  [[ -z "$remaining" || "$remaining" == "0" ]]
}

# ─── 任务执行 ──────────────────────────────────────────────────

execute_task() {
  local task_id="$1"
  log "=== 开始执行 $task_id ==="

  # 生成任务描述
  local task_desc
  task_desc=$(get_task_description "$task_id")
  log "任务描述: $(echo "$task_desc" | head -3 | tr '\n' ' ')"

  # 生成执行 prompt
  cat > "$AUTOMATION_DIR/tasks/${task_id}-prompt.txt" << PROMPT
你是 profileaxis 项目的自动化编码助手。请执行以下任务：

## 项目概况
- 项目: profileaxis — 3D 货架配置平台
- 仓库: $REPO_ROOT
- monorepo: packages/* (10个包) + apps/* (api + web)
- 语言: TypeScript strict mode, ESM
- 包管理器: pnpm
- 测试: vitest / node

## 当前任务: $task_id
$(get_task_description "$task_id")

## 验收标准
$(get_gate_info "$task_id")

## 架构约束
$(head -100 "$REPO_ROOT/docs/02-architecture.md" 2>/dev/null || echo "见 docs/02-architecture.md")

## 执行规则
1. 只修改任务范围内的文件
2. 不破坏现有依赖方向
3. 完成后运行 typecheck + test 验证
4. 不要 commit 或 push（由 runner 处理）
5. 完成后输出结构化的完成报告

## 输出格式
完成后请输出:
\`\`\`
COMPLETED: $task_id
FILES_CHANGED: <逗号分隔的文件列表>
SUMMARY: <一句话总结>
\`\`\`
PROMPT

  # 执行 Claude Code
  log "调用 Claude Code 执行 $task_id ..."
  write_heartbeat "$task_id" "executing"

  local cc_exit=0
  npx @anthropic-ai/claude-code \
    -p "$(cat "$AUTOMATION_DIR/tasks/${task_id}-prompt.txt")" \
    --model deepseek-v4-pro \
    --allowedTools "Bash(pnpm *),Bash(ls *),Bash(find *),Bash(cat *),Bash(grep *),Bash(node *),Bash(npx *),Bash(mkdir *),Bash(cp *),Read,Write,Edit" \
    --max-budget-usd 2 \
    --add-dir "$REPO_ROOT" \
    --verbose \
    2>&1 | tee "$AUTOMATION_DIR/tasks/${task_id}-output.log" || cc_exit=$?

  # 解析结果
  if [[ $cc_exit -eq 0 ]] && grep -q "COMPLETED: $task_id" "$AUTOMATION_DIR/tasks/${task_id}-output.log" 2>/dev/null; then
    log "$task_id 执行成功"
    local changed_files
    changed_files=$(grep "FILES_CHANGED:" "$AUTOMATION_DIR/tasks/${task_id}-output.log" | head -1 | sed 's/FILES_CHANGED: //' || echo "[]")
    
    # 运行 typecheck 验证
    if pnpm -r typecheck 2>/dev/null | tail -5; then
      log "typecheck 通过"
    else
      warn "typecheck 有警告"
    fi

    # 写结构化结果
    cat > "$AUTOMATION_DIR/results/${task_id}.result.json" << EOF
{
  "taskId": "$task_id",
  "runId": "$RUN_ID",
  "status": "completed",
  "changedFiles": "$changed_files",
  "completedAt": "$(date -Iseconds)",
  "ccExitCode": $cc_exit
}
EOF

    # 更新 project-state
    json_set "lastCompletedTaskId" "\"$task_id\""
    json_set "activeTaskId" "null"
    json_set "activeRunId" "null"
    json_set "lastRunStatus" "\"completed\""
    json_set "lastHeartbeatAt" "\"$(date -u +%Y-%m-%dT%H:%M:%SZ)\""
    json_set "retryBudget.$task_id.lastStatus" "\"completed\""

    # 更新 task-board 状态
    python3 -c "
import re
with open('$TASK_BOARD') as f:
    content = f.read()
content = content.replace('| $task_id |', '| $task_id |', 1)
# 改状态列为 completed
lines = content.split('\n')
new_lines = []
for l in lines:
    if l.startswith('| $task_id '):
        cols = l.split('|')
        if len(cols) >= 8:
            cols[7] = 'completed'
        l = '|'.join(cols)
    new_lines.append(l)
with open('$TASK_BOARD', 'w') as f:
    f.write('\n'.join(new_lines))
" 2>/dev/null || warn "Failed to update task board"

    # git commit
    cd "$REPO_ROOT"
    git add -A
    git commit -m "auto: $task_id completed by runner $RUN_ID" || log "No changes to commit"

    log "$task_id 完成"
    return 0
  else
    log "$task_id 执行异常 (exit=$cc_exit)"
    write_heartbeat "$task_id" "failed"
    
    # 记录失败
    json_set "retryBudget.$task_id.lastStatus" "\"failed\""
    local attempts=$(json_get "d['retryBudget']['$task_id']['attempts']")
    attempts=$((attempts + 1))
    json_set "retryBudget.$task_id.attempts" "$attempts"
    
    if [[ $attempts -ge 2 ]]; then
      warn "$task_id 已失败 $attempts 次，标记为 blocked"
      json_set "blockedTasks" "$(json_get "d.get('blockedTasks',[]) + ['$task_id']")"
      json_set "activeTaskId" "null"
    fi
    
    return 1
  fi
}

# ─── 主流程 ──────────────────────────────────────────────────

log "══════ Runner $RUN_ID 启动 ══════"

# 1. 参数模式：手动指定任务
if [[ $# -ge 1 ]]; then
  task_id="$1"
  log "手动模式: $task_id"
  acquire_lock "$task_id"
  trap release_lock EXIT
  execute_task "$task_id"
  exit $?
fi

# 2. 自动模式：检查调度开关
enabled=$(python3 -c "import json; print(json.load(open('$SCHED_FILE'))['schedule']['enabled'])" 2>/dev/null || echo "false")
if [[ "$enabled" != "True" ]]; then
  log "调度已禁用 (enabled=$enabled)，跳过"
  exit 0
fi

# 3. 检查锁
if is_locked; then
  active=$(json_get "d.get('activeTaskId','')")
  log "锁存在 (active=$active)"
  if [[ -n "$active" ]] && is_stale "$active"; then
    warn "任务 $active stale，接管"
  else
    log "其他 runner 活跃中，退出"
    exit 0
  fi
fi

# 4. 处理 active 任务
active=$(json_get "d.get('activeTaskId','')")
if [[ -n "$active" ]] && [[ "$active" != "null" ]]; then
  log "恢复 active 任务: $active"
  acquire_lock "$active"
  trap release_lock EXIT
  
  if is_stale "$active"; then
    warn "$active 已 stale"
    att=$(json_get "d['retryBudget'].get('$active',{}).get('attempts',0)")
    if [[ $att -ge 2 ]]; then
      warn "$active 已达最大重试，标记 blocked"
      json_set "blockedTasks" "$(python3 -c "import json; d=json.load(open('$STATE_FILE')); print(json.dumps(d.get('blockedTasks',[])+['$active']))")"
      json_set "activeTaskId" "null"
      release_lock
      # 继续 pick 下一个
    else
      execute_task "$active"
      exit $?
    fi
  else
    write_heartbeat "$active"
    log "$active 仍在执行中，仅更新心跳"
    exit 0
  fi
fi

# 5. Pick 下一个任务
task_id=$(pick_next_task)
if [[ -z "$task_id" ]]; then
  if all_done; then
    log "🎉 本期 P0 任务已全部完成！"
  else
    log "无 queued 任务（可能有 blocked 任务需人工处理）"
  fi
  exit 0
fi

log "选取任务: $task_id"

# 6. 执行
acquire_lock "$task_id"
trap release_lock EXIT

json_set "activeTaskId" "\"$task_id\""
json_set "activeRunId" "\"$RUN_ID\""
json_set "retryBudget.$task_id.attempts" "$(($(json_get "d['retryBudget'].get('$task_id',{}).get('attempts',0)") + 1))"
json_set "retryBudget.$task_id.lastStatus" "\"executing\""

execute_task "$task_id"
exit $?

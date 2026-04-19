# 自动执行方案设计

> 基于 docs/06-task-board.md 和 docs/07-acceptance-gates.md

## 调度总览

```
systemd timer / cron (每 60 分钟)
    ↓
job-runner.sh
    ↓ 读取锁文件、心跳、项目状态
    ↓ 检查当前活动任务
    ↓
    ├─ 有活动任务 → 恢复 / 补验收 / 补文档
    └─ 无活动任务 → 按依赖顺序取第一个 queued 任务
    ↓
生成结构化任务包 (.automation/tasks/<taskId>.json)
    ↓
调用 OpenClaw (isolated session)
    ↓ OpenClaw 调用 Claude Code
    ↓ Claude Code 实现 / 验收 / 更新文档
    ↓
job-runner 二次校验结果
    ↓
更新 .automation/project-state.json
更新 docs/06-task-board.md 状态
```

## 目录结构

```
repo/
├── .automation/
│   ├── project-state.json    # 全局状态
│   ├── scheduler-config.json  # 调度器配置
│   ├── tasks/                # 结构化任务包
│   │   └── P0-001.json
│   ├── results/              # 任务执行结果
│   │   └── P0-001.result.json
│   ├── runs/                 # 运行记录
│   │   └── run-001.json
│   ├── locks/                # 锁文件
│   │   └── hourly-run.lock
│   └── heartbeats/           # 心跳文件
│       └── P0-001.json
```

## project-state.json 最小字段

```json
{
  "activeTaskId": null,
  "activeRunId": null,
  "lastCompletedTaskId": null,
  "lastRunStatus": null,
  "lastHeartbeatAt": null,
  "retryBudget": {
    "P0-001": { "attempts": 0, "lastStatus": null },
    "P0-002": { "attempts": 0, "lastStatus": null }
  }
}
```

## 状态机

统一使用以下状态：

| 状态 | 含义 | 允许进入 |
|------|------|----------|
| `queued` | 等待执行 | `picked` |
| `picked` | 已领取 | `executing` |
| `executing` | Claude Code 执行中 | `validating` / `stale` |
| `validating` | 验收门校验中 | `documenting` / `failed` |
| `documenting` | 文档更新中 | `completed` / `failed` |
| `completed` | 完成 | — |
| `failed` | 失败（可重试） | `queued` |
| `blocked` | 阻断（需人工介入） | — |
| `stale` | 心跳超时 | `queued` / `blocked` |

## 单轮执行流程

```
1. 取全局锁 (.automation/locks/hourly-run.lock)
   └─ 锁存在且未超时（>55min）→ 本轮退出

2. 检查是否已有活动任务
   └─ 存在 picked/executing/validating/documenting → 优先恢复
   └─ 无活动任务 → 按 docs/06-task-board.md 依赖顺序取第一个 queued

3. 生成结构化任务包
   └─ 写入 .automation/tasks/<taskId>.json

4. 调 OpenClaw（isolated session）
   └─ system prompt = "docs/08-automation-plan.md 执行任务包"
   └─ 传入 .automation/tasks/<taskId>.json

5. 监听心跳（每 2 分钟更新 .automation/heartbeats/<taskId>.json）
   └─ 10 分钟无心跳 → 标记 stale，终止子进程

6. 执行完成后，独立校验验收门
   └─ 通过 → 标记 completed
   └─ 失败 → 标记 failed/blocked（按错误类型）

7. 更新 .automation/project-state.json
   └─ 更新 docs/06-task-board.md 状态

8. 释放全局锁
```

## 错误恢复策略

### 分阶段超时

| 阶段 | 超时 |
|------|------|
| `executing` | 30 分钟 |
| `validating` | 10 分钟 |
| `documenting` | 5 分钟 |

### 恢复策略

| 场景 | 动作 |
|------|------|
| executing 卡死 | 杀死 Claude Code 进程，保留改动，下一小时只发"恢复任务" |
| validating 失败 | 生成"修复验收失败"子任务，下一小时只处理失败项 |
| documenting 失败 | 强制补写 docs/06-task-board.md 与 result 文件 |
| 心跳超时（10min） | 标记 `stale`，终止子进程，进入恢复流程 |

### 重试策略

| 情况 | 策略 |
|------|------|
| 结构化结果缺失 | 自动重试 1 次 |
| 测试失败 | 自动修复 1 次 |
| 连续 2 次 stale | 标记 `blocked` |
| 连续 2 次同类错误 | 停止自动，等待人工 |

## 任务包模板

```json
{
  "taskId": "P0-002",
  "title": "建立 packages/schemas",
  "goal": "冻结 DSL / API contract、fixture、runtime validator",
  "constraints": [
    "只允许修改 packages/schemas 目录",
    "不得破坏 domain 依赖方向",
    "必须更新 docs/06-task-board.md 状态",
    "必须输出结构化结果到 .automation/results/P0-002.result.json"
  ],
  "inputs": [
    "docs/02-architecture.md",
    "docs/03-monorepo-design.md",
    "docs/04-api-contracts.md",
    "docs/06-task-board.md",
    "docs/07-acceptance-gates.md"
  ],
  "expectedOutputs": [
    "packages/schemas/src/dsl/*.schema.json",
    "packages/schemas/src/api/*.schema.json",
    "packages/schemas/src/validators/*.ts",
    ".automation/results/P0-002.result.json"
  ],
  "acceptanceGateId": "gate-P0-002"
}
```

## 传给 Claude Code 的任务提示词模板

```
基于 docs/06-task-board.md，执行 taskId=<TASK_ID>。

要求：
1. 只处理这个任务，不扩展到其他任务
2. 严格遵守 docs/02-architecture.md 的依赖方向与禁止事项
3. 先实现，再验收（docs/07-acceptance-gates.md），再更新任务文档
4. 必须输出结构化结果到 .automation/results/<TASK_ID>.result.json
5. 如果验收失败，先修复失败项，不要跳过
6. 如果发现任务定义本身有冲突，只能标记 blocked，不允许擅自重写架构

完成后输出：
{
  "taskId": "<TASK_ID>",
  "status": "done_with_concerns",
  "changedFiles": [...],
  "tests": { "ran": true, "passed": true, "summary": "..." },
  "docsUpdated": true,
  "concerns": [],
  "nextSuggestedTaskId": "<NEXT_TASK_ID>"
}
```

## 下一步落地建议

1. **第一版只做：**
   - 单仓库
   - 单任务串行
   - 每 60 分钟最多一个任务
   - 带锁、心跳、超时、重试、blocked

2. **技术选型：**
   - 调度器：`systemd timer` 或 `cron`
   - Runner：Shell 脚本 + OpenClaw CLI
   - 状态文件：JSON（.automation/project-state.json）

3. **落地顺序：**
   ```
   Week 1:  建立 .automation/ 目录结构和 project-state.json
   Week 2:  实现 job-runner.sh（取锁、心跳、超时）
   Week 3:  对接 OpenClaw isolated session
   Week 4:  对接 docs/07-acceptance-gates.md 自动校验
   Week 5:  稳定运行，收敛 bug
   ```

4. **不要在第一版做的事：**
   - 多 worker 并发
   - 多任务队列
   - 自动 review / qa 串联
   - 子阶段粒度恢复

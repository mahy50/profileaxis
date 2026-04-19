# OPENCLAW 架构设计执行工作流

## 目的

这份文档用于指导 OpenClaw 基于现有 MVP 蓝图，分阶段完成：

1. MVP 边界冻结
2. 系统架构冻结
3. monorepo 目录与包职责设计
4. 核心接口与 schema 冻结
5. 首轮风险验证计划
6. 第一阶段任务板生成
7. 阶段验收门生成
8. 自动执行方案设计

这不是开放式研究流程，而是工程执行收口流程。

---

## 适用前提

在开始前，确保：

* 项目工作区内已有 `MVP执行蓝图.md`
* OpenClaw 可访问当前仓库工作区
* OpenClaw 已可调用 Claude Code
* 目标是先产出文档工件，不直接生成业务代码

---

## 推荐技能安装

### 必装

* `coding-agent`

### 建议安装

* `skill-creator`

### 可选

* `gstack`

当前阶段不要求先安装大量技能。只要 `coding-agent` 可用，就足够完成架构设计与文档冻结。

---

## 推荐文档目录

在仓库中建立以下目录与文档：

```text
repo/
  docs/
    01-mvp-scope.md
    02-architecture.md
    03-monorepo-design.md
    04-api-contracts.md
    05-risk-spikes.md
    06-task-board.md
    07-acceptance-gates.md
    08-automation-plan.md
```

---

## 总体执行规则

所有步骤都遵守以下规则：

1. 只允许收口，不允许重新发散研究
2. 每一步只产出一个主要文档
3. 文档必须直接落到工作区文件中，不只是在聊天中总结
4. 在文档冻结完成前，不生成业务实现代码
5. 所有结论以 `MVP执行蓝图.md` 为主依据
6. 如果已有旧文档，则覆盖更新，不重复新增同类文件

建议在每一条提示词末尾统一追加：

```md
请直接在当前工作区创建或更新对应文档文件，不要只在聊天中总结。
需要深度分析和文档产出时，请使用 coding-agent 调用 Claude Code 完成。
在文档冻结之前，不要生成业务代码；只允许生成文档、目录草案、接口草案、任务板和验收门。
```

---

## Step 1：冻结 MVP 边界

### 目标文件

* `docs/01-mvp-scope.md`

### 提示词

```md
基于当前工作区中的《MVP执行蓝图.md》，只做“MVP 边界冻结”，不要写代码，不要发散讨论。

目标：
产出 docs/01-mvp-scope.md

要求：
1. 只保留首版必须做、可降级做、明确不做三部分
2. 明确本期唯一主链路
3. 明确成功标准与失败标准
4. 不重复背景介绍
5. 输出必须能作为后续架构设计输入

产出格式：
- 项目目标
- 本期范围
- 非目标
- MVP 主链路
- 验收口径
- 风险边界

如果工作区已有旧版本文档，覆盖更新。

请直接在当前工作区创建或更新对应文档文件，不要只在聊天中总结。
需要深度分析和文档产出时，请使用 coding-agent 调用 Claude Code 完成。
在文档冻结之前，不要生成业务代码；只允许生成文档、目录草案、接口草案、任务板和验收门。
```

### 产出目的

把 MVP 蓝图中的产品边界、主链路与成功标准单独冻结，作为所有后续文档的基础。

---

## Step 2：冻结系统架构

### 目标文件

* `docs/02-architecture.md`

### 提示词

```md
基于 docs/01-mvp-scope.md 和《MVP执行蓝图.md》，输出系统架构冻结版，不写代码。

目标：
产出 docs/02-architecture.md

要求：
1. 只保留一套主架构方案，不保留并行备选
2. 明确前端、后端、shared packages 的边界
3. 明确 ProjectDocument / resolvedDsl 是否为唯一真相源
4. 明确 AI、规则、BOM、渲染、导出的职责边界
5. 明确依赖方向，禁止反向依赖
6. 最后给出“本架构下禁止做的事”

输出结构：
- 架构总览
- 真相源定义
- 模块职责表
- 前后端边界
- 依赖方向
- 禁止事项

请直接在当前工作区创建或更新对应文档文件，不要只在聊天中总结。
需要深度分析和文档产出时，请使用 coding-agent 调用 Claude Code 完成。
在文档冻结之前，不要生成业务代码；只允许生成文档、目录草案、接口草案、任务板和验收门。
```

### 产出目的

冻结单一主架构，避免后续在实现阶段继续摇摆模块边界与依赖方向。

---

## Step 3：生成 monorepo 目录草案

### 目标文件

* `docs/03-monorepo-design.md`

### 提示词

```md
基于 docs/02-architecture.md 和《MVP执行蓝图.md》，输出 monorepo 目录与包职责草案，不写业务代码。

目标：
产出 docs/03-monorepo-design.md

要求：
1. 给出 repo 目录树
2. 给出每个 package / app 的职责
3. 给出允许依赖与禁止依赖
4. 给出建仓顺序
5. 给出哪些目录首版必须先建，哪些后置

输出结构：
- 顶层目录树
- packages 列表与职责
- apps 列表与职责
- 依赖约束表
- 建仓顺序
- 首版必建清单

请直接在当前工作区创建或更新对应文档文件，不要只在聊天中总结。
需要深度分析和文档产出时，请使用 coding-agent 调用 Claude Code 完成。
在文档冻结之前，不要生成业务代码；只允许生成文档、目录草案、接口草案、任务板和验收门。
```

### 产出目的

把系统架构转成仓库结构与包级职责，作为建仓和后续任务拆分依据。

---

## Step 4：冻结核心接口与 schema

### 目标文件

* `docs/04-api-contracts.md`

### 提示词

```md
基于《MVP执行蓝图.md》中已有接口草案，整理并冻结首版核心接口，不写实现。

目标：
产出 docs/04-api-contracts.md

要求：
1. 只保留 M1 首版必须冻结的接口与字段
2. 明确哪些字段是 source of truth
3. 明确哪些字段是 derived cache
4. 区分 ProjectDocument、DSL、BOM、CheckIssue、CommandEntry、ReferenceContext、EditIntent
5. 区分前端本地接口与后端 API 合同
6. 最后输出“禁止交给 AI 的内容”

输出结构：
- 核心领域对象
- DSL 契约
- 本地命令契约
- 后端 API 契约
- 版本字段要求
- AI 禁区

请直接在当前工作区创建或更新对应文档文件，不要只在聊天中总结。
需要深度分析和文档产出时，请使用 coding-agent 调用 Claude Code 完成。
在文档冻结之前，不要生成业务代码；只允许生成文档、目录草案、接口草案、任务板和验收门。
```

### 产出目的

冻结首版合同面，避免在实现阶段边做边改、前后端漂移。

---

## Step 5：输出首轮风险验证计划

### 目标文件

* `docs/05-risk-spikes.md`

### 提示词

```md
基于 docs/02-architecture.md、docs/03-monorepo-design.md 和《MVP执行蓝图.md》，输出首轮技术风险验证计划。

目标：
产出 docs/05-risk-spikes.md

要求：
1. 只保留首版真正高风险的 6~8 项
2. 每项必须写明：
   - 风险描述
   - 验证方法
   - 通过标准
   - 失败降级方案
3. 明确哪些验证必须在前 2 周完成
4. 不要写泛泛“需关注性能/稳定性”

输出结构：
- 风险项列表
- 验证顺序
- 通过阈值
- 降级路径

请直接在当前工作区创建或更新对应文档文件，不要只在聊天中总结。
需要深度分析和文档产出时，请使用 coding-agent 调用 Claude Code 完成。
在文档冻结之前，不要生成业务代码；只允许生成文档、目录草案、接口草案、任务板和验收门。
```

### 产出目的

把最可能拖垮首版的技术风险提前暴露，并给出通过阈值与降级方案。

---

## Step 6：生成第一阶段任务板

### 目标文件

* `docs/06-task-board.md`

### 提示词

```md
基于 docs/01-05 和《MVP执行蓝图.md》，输出第一阶段开发任务板。

目标：
产出 docs/06-task-board.md

要求：
1. 只覆盖第一阶段
2. 必须按 P0 / P1 / P2 排序
3. 每个任务必须包含：
   - taskId
   - 标题
   - 目标
   - 依赖
   - 输入
   - 输出
   - 验收标准
4. 明确“第一个任务”是谁
5. 明确哪些任务可以并行，哪些绝对不能并行
6. 不要拆得过细到工时级别

输出结构：
- 第一阶段目标
- 任务表
- 执行顺序
- 并行策略
- 第一个任务

请直接在当前工作区创建或更新对应文档文件，不要只在聊天中总结。
需要深度分析和文档产出时，请使用 coding-agent 调用 Claude Code 完成。
在文档冻结之前，不要生成业务代码；只允许生成文档、目录草案、接口草案、任务板和验收门。
```

### 产出目的

生成后续自动调度、人工跟进、阶段推进的统一任务真相源。

---

## Step 7：生成阶段验收门

### 目标文件

* `docs/07-acceptance-gates.md`

### 提示词

```md
基于 docs/06-task-board.md 和《MVP执行蓝图.md》，为每个阶段生成 machine-checkable 验收门。

目标：
产出 docs/07-acceptance-gates.md

要求：
1. 每个 P0 任务都要有明确 Definition of Done
2. 验收项尽量可自动检查
3. 区分：
   - 文件存在检查
   - 类型/测试检查
   - 架构约束检查
   - 文档更新检查
4. 最后给出“不能自动检查的人工确认项”

输出结构：
- P0 验收门
- P1 验收门
- 自动检查项
- 人工检查项

请直接在当前工作区创建或更新对应文档文件，不要只在聊天中总结。
需要深度分析和文档产出时，请使用 coding-agent 调用 Claude Code 完成。
在文档冻结之前，不要生成业务代码；只允许生成文档、目录草案、接口草案、任务板和验收门。
```

### 产出目的

为后续自动执行、阶段检查和“上一任务是否完整”提供统一可判定标准。

---

## Step 8：生成自动执行设计稿

### 目标文件

* `docs/08-automation-plan.md`

### 提示词

```md
基于 docs/06-task-board.md、docs/07-acceptance-gates.md 和《MVP执行蓝图.md》，设计 hourly automation 的任务编排方案。

目标：
产出 docs/08-automation-plan.md

要求：
1. 设计每小时只推进一个任务的调度策略
2. 明确任务状态机
3. 明确锁、心跳、超时、重试、blocked、stale 的处理
4. 明确如何检查上一任务是否完成
5. 明确如何选取下一个任务
6. 输出推荐的 .automation 目录结构
7. 不要依赖聊天历史做真相源

输出结构：
- 调度总览
- 状态机
- 单轮执行流程
- 错误恢复策略
- 目录结构
- 下一步落地建议

请直接在当前工作区创建或更新对应文档文件，不要只在聊天中总结。
需要深度分析和文档产出时，请使用 coding-agent 调用 Claude Code 完成。
在文档冻结之前，不要生成业务代码；只允许生成文档、目录草案、接口草案、任务板和验收门。
```

### 产出目的

把自动执行机制提前设计清楚，为后续每小时定时调度提供文档基线。

---

## 推荐执行顺序

严格按以下顺序运行，不要跳步：

1. Step 1：冻结 MVP 边界
2. Step 2：冻结系统架构
3. Step 3：生成 monorepo 目录草案
4. Step 4：冻结核心接口与 schema
5. Step 5：输出首轮风险验证计划
6. Step 6：生成第一阶段任务板
7. Step 7：生成阶段验收门
8. Step 8：生成自动执行设计稿

前四步完成前，不进入代码生成。

---

## 何时进入实现阶段

只有以下文档全部存在且完成冻结，才允许开始实现：

* `docs/01-mvp-scope.md`
* `docs/02-architecture.md`
* `docs/03-monorepo-design.md`
* `docs/04-api-contracts.md`
* `docs/06-task-board.md`
* `docs/07-acceptance-gates.md`

如果任一文档仍处于开放讨论状态，不进入自动开发。

---

## 后续扩展建议

当这套流程跑通后，再考虑增加以下自定义技能：

* `architecture-freezer`
* `task-breakdown`
* `acceptance-gate-writer`
* `dispatch-router`
* `hourly-job-runner`

当前阶段不要求先实现这些技能。

---

## 最终使用建议

实际使用时，不要把 8 个提示词合并成一条超长指令。
应当逐条执行，每步检查输出文件是否符合预期，再进入下一步。

如果某一步输出质量不够，应当只重做该步，而不是回退整套流程。

---

## 实现阶段如何自动执行

当以下文档全部冻结后，才进入自动执行：

* `docs/01-mvp-scope.md`
* `docs/02-architecture.md`
* `docs/03-monorepo-design.md`
* `docs/04-api-contracts.md`
* `docs/06-task-board.md`
* `docs/07-acceptance-gates.md`

自动执行不要设计成“OpenClaw 自己每小时想下一步”。
正确方式是：使用系统定时器驱动一个显式任务编排器，由编排器调用 OpenClaw，再由 OpenClaw 调用 Claude Code。

推荐链路：

```text
systemd timer / cron
  -> job-runner
    -> 读取 docs/06-task-board.md 与 docs/07-acceptance-gates.md
    -> 检查当前活动任务
    -> 若上一任务未完成，则优先恢复或补验收
    -> 若无活动任务，则取第一个满足依赖的 queued 任务
    -> 调用 OpenClaw
      -> OpenClaw 调用 Claude Code
      -> Claude Code 实现 / 验收 / 更新文档
    -> job-runner 二次校验结果并回写状态
```

### 必要目录

建议在仓库中加入：

```text
repo/
  .automation/
    project-state.json
    scheduler-config.json
    tasks/
    results/
    runs/
    locks/
    heartbeats/
```

### project-state.json 最小字段

```json
{
  "activeTaskId": null,
  "activeRunId": null,
  "lastCompletedTaskId": null,
  "lastRunStatus": null,
  "lastHeartbeatAt": null,
  "retryBudget": {
    "maxTaskRetry": 2,
    "maxStageRetry": 1
  }
}
```

### 任务状态机

统一使用以下状态：

* `queued`
* `picked`
* `executing`
* `validating`
* `documenting`
* `completed`
* `failed`
* `blocked`
* `stale`

规则：

1. 每小时只允许推进一个主任务
2. 如果存在 `picked / executing / validating / documenting` 的活动任务，不领取新任务
3. 只有 `completed / failed / blocked` 才允许进入下一个任务

### 每小时单轮执行流程

1. 取全局锁
2. 检查是否已有活动任务
3. 若有活动任务：优先恢复、补验收或补文档
4. 若无活动任务：按依赖顺序取第一个 `queued` 任务
5. 生成结构化任务包
6. 调 OpenClaw -> Claude Code 执行
7. 执行完成后，独立校验验收门
8. 通过则标记 `completed`，否则进入 `failed / blocked / stale`
9. 回写 `docs/06-task-board.md` 与 `.automation` 状态文件

### 传给 OpenClaw 的任务包模板

```json
{
  "taskId": "P0-002",
  "title": "建立 packages/domain",
  "goal": "建立 ProjectDocument、CommandEntry、CheckIssue 基础结构",
  "inputs": [
    "docs/02-architecture.md",
    "docs/03-monorepo-design.md",
    "docs/04-api-contracts.md",
    "docs/06-task-board.md",
    "docs/07-acceptance-gates.md"
  ],
  "constraints": [
    "只允许修改指定目录",
    "不得破坏依赖方向",
    "必须更新任务文档",
    "必须输出结构化结果"
  ],
  "expectedOutputs": [
    "packages/domain/**",
    ".automation/results/P0-002.result.json",
    "docs/06-task-board.md"
  ],
  "acceptanceGateId": "gate-P0-002"
}
```

### Claude Code 必须输出的结果格式

```json
{
  "taskId": "P0-002",
  "status": "done_with_concerns",
  "changedFiles": [
    "packages/domain/src/project.ts"
  ],
  "tests": {
    "ran": true,
    "passed": true,
    "summary": "pnpm test --filter domain passed"
  },
  "docsUpdated": true,
  "concerns": [],
  "nextSuggestedTaskId": "P0-003"
}
```

注意：编排器不能直接相信这份结果，必须自己二次检查。

---

## 如何纠错与自动恢复

### 1. 防重复执行

使用全局锁文件，例如：

* `.automation/locks/hourly-run.lock`

锁内容至少包含：

* `runId`
* `taskId`
* `stage`
* `startedAt`
* `heartbeatAt`

如果锁存在且未超时，本轮直接退出，不开启新任务。

### 2. 心跳机制

在 Claude Code 执行期间，包装脚本或 job-runner 每 1~2 分钟写一次 heartbeat：

* `.automation/heartbeats/<taskId>.json`

如果超过阈值未更新心跳，例如 10 分钟，则判定为 `stale`。

### 3. 分阶段超时

不要只设总超时。建议：

* `executing`: 30 分钟
* `validating`: 10 分钟
* `documenting`: 5 分钟

超过后进入恢复流程，而不是无限等待。

### 4. 分阶段恢复策略

#### 执行阶段卡死

动作：

1. 杀死 Claude Code 子进程
2. 保留工作区改动
3. 读取最近输出和 git diff
4. 下一个小时只发起“恢复任务”，不要重新完整实现

恢复任务提示词模板：

```md
上一轮任务在 executing 阶段中断。
先检查当前工作区已有改动、测试状态和结果文件。
不要重复大范围改动。
优先完成收尾、补验收、补文档，并输出结构化结果。
```

#### 验收失败

动作：

1. 保留代码改动
2. 生成“修复验收失败”子任务
3. 下一轮只处理失败项，不开启新任务

#### 文档更新失败

动作：

1. 不重复执行代码任务
2. 只执行文档修复任务
3. 强制补写 `docs/06-task-board.md` 与 result 文件

### 5. 重试策略

建议固定：

* 结构化结果缺失：自动重试 1 次
* 测试失败：自动修复 1 次
* 连续 2 次 stale：标记 `blocked`
* 连续 2 次同类错误：停止自动修复，等待人工介入

不要无限重试。

### 6. 二次验收

编排器要独立做这几类检查：

* 目标文件是否存在
* 指定目录是否真的修改
* typecheck / test 是否成功
* 文档是否更新
* 是否符合 docs/07-acceptance-gates.md

只有全部通过，才允许把任务状态改成 `completed`。

### 7. 何时阻断后续任务

出现以下任一情况，必须阻断后续新任务：

* 活动任务未完成
* 当前任务为 `blocked`
* 验收门未通过
* 依赖任务未完成
* 架构文档与任务实现出现冲突

### 8. 人工介入点

以下情况不要继续自动跑：

* Claude Code 连续两轮产出与架构冻结文档冲突
* 当前任务需要新增未冻结接口
* 需要修改任务板依赖结构
* 高风险验证项未过阈值但任务试图继续推进

---

## 进入实现阶段后的推荐提示词

### A. 执行单个任务

```md
基于 docs/02-architecture.md、docs/03-monorepo-design.md、docs/04-api-contracts.md、docs/06-task-board.md、docs/07-acceptance-gates.md，执行 taskId=<TASK_ID> 对应任务。

要求：
1. 只处理这个任务，不扩展到其他任务
2. 严格遵守依赖方向与禁止事项
3. 先实现，再验收，再更新任务文档
4. 必须输出结构化结果到 .automation/results/<TASK_ID>.result.json
5. 如果验收失败，先修复失败项，不要跳过
6. 如果发现任务定义本身有冲突，只能标记 blocked，不允许擅自重写架构
```

### B. 恢复卡死任务

```md
上一轮 taskId=<TASK_ID> 在 <STAGE> 阶段中断。
请先检查：
1. 当前工作区已有改动
2. 现有测试状态
3. .automation/results 和 docs/06-task-board.md 的状态

要求：
- 不重复大范围实现
- 优先恢复到“可验收、可落文档”的状态
- 输出新的结构化结果
- 如果无法安全恢复，标记 blocked 并说明最小人工介入点
```

### C. 修复验收失败

```md
当前 taskId=<TASK_ID> 已实现，但未通过 docs/07-acceptance-gates.md 中的验收门。
请仅修复失败项，不扩大改动范围。
修复后重新执行验收，并更新 .automation/results/<TASK_ID>.result.json 与 docs/06-task-board.md。
```

---

## 最小落地建议

先不要做复杂多任务并发。第一版只做：

1. 单仓库
2. 单任务串行
3. 每小时最多一个任务
4. 带锁、心跳、超时、重试、blocked
5. 由 job-runner 统一调 OpenClaw

只要这版跑稳，再做：

* 多 worker
* 多任务队列
* 自动 review / qa 串联
* 更细的子阶段恢复

# 第一阶段任务板

> 来源：docs/05-risk-spikes.md + docs/04-api-contracts.md + MVP执行蓝图
> 覆盖范围：第一阶段（Week 1~8）

## 第一阶段目标

在 6~8 周内打通"需求 → 确认 → 合法结构 → 可编辑工作区 → 双 BOM → PDF"最小闭环，并把高风险问题在上线前全部暴露。

## 任务表

### P0 任务（阻塞发布）

| TaskId | 标题 | 目标 | 依赖 | 输入 | 输出 | 验收标准 |
|--------|------|------|------|------|------|----------|
| P0-001 | 初始化 monorepo 与 CI | 建立单仓开发底座 | — | — | workspace、lint、typecheck、test pipeline | PR 合并前 CI 全部绿 |
| P0-002 | 建立 packages/schemas | 冻结 DSL / API contract、fixture、runtime validator | P0-001 | — | `packages/schemas/src/dsl/`、`packages/schemas/src/api/` | fixture 全部过 validator |
| P0-003 | 建立 packages/domain | 冻结 ProjectDocument / Command / StructuralNode / JointNode / CheckIssue | P0-002 | `packages/schemas` | `packages/domain/src/project/`、`packages/domain/src/command/` | 类型与 fixture 一致 |
| P0-004 | 建立 packages/stdlib | 建立首批 profile / connector / supplier policy / sku_map 种子数据 | P0-003 | `packages/domain` | `packages/stdlib/src/profiles/`、`packages/stdlib/src/connectors/` | 至少支持 3 个典型货架案例 |
| P0-005 | 建立 packages/rules | 打通 `draftDsl → resolvedDsl → checks` 规则合法化 | P0-003, P0-004 | `packages/domain + stdlib + schemas` | `packages/rules/src/normalize/`、`packages/rules/src/resolve/`、`packages/rules/src/checks/` | 10 条 golden 中至少 8 条产出合法 resolvedDsl |
| P0-006 | 建立 packages/modeler | `resolvedDsl → geometry / SceneViewModel / DimensionViewModel` | P0-005 | `packages/rules` | `packages/modeler/src/geometry/`、`packages/modeler/src/scene-vm/` | 选中 / 高亮 / 树同步 geometry 可用 |
| P0-007 | 建立 packages/render-babylon | Babylon Scene 适配、选中、高亮、thin-instance picking | P0-006 | `packages/modeler` | `packages/render-babylon/src/scene-adapter/`、`packages/render-babylon/src/picking/` | thin-instance picking 稳定；Scene 可从 ProjectDocument 重建 |
| P0-008 | 建立 packages/bom | 设计 BOM / 交易 BOM 双链路 | P0-004, P0-006 | `packages/stdlib` | `packages/bom/src/design/`、`packages/bom/src/trade/`、`packages/bom/src/mapping/` | 行项、数量、映射状态可复核；设计 BOM ≥98%，交易 BOM ≥95% |
| P0-009 | 建立 packages/export | SVG 三视图、PDF payload | P0-008 | `packages/bom` | `packages/export/src/svg/`、`packages/export/src/pdf-payload/` | 三视图 SVG 关键尺寸正确 |
| P0-010 | 建立 packages/ai-contracts | prompts、tool schema、AI DTO、error envelope | P0-002 | `packages/schemas` | `packages/ai-contracts/src/prompts/`、`packages/ai-contracts/src/tools/` | 所有 tool schema 符合 M1 冻结要求 |
| P0-011 | 建立 apps/api AI endpoints | `intent / draft / edit-intent / check-explain` 四个 endpoint | P0-005, P0-010 | `packages/rules + ai-contracts` | `apps/api/src/routes/`、`apps/api/src/services/ai-orchestrator/` | 接口返回 strict schema 合法结果 |
| P0-012 | 建立 apps/web 编辑器壳层 | Vue 3 + Pinia + Babylon 集成 + IndexedDB | P0-007, P0-008, P0-011 | `packages/render-babylon + bom + api` | `apps/web/src/stores/`、`apps/web/src/features/editor/` | Scene / 结构树 / 选择同步可用 |
| P0-013 | 命令系统 | 语义命令、撤销/重做、快照恢复 | P0-003 | `packages/domain` | command bus、persistence store | 20 次编辑内历史一致；snapshot restore 后全部一致 |
| P0-014 | 本地持久化底座 | IndexedDB projects / snapshots / commands | P0-003 | `packages/domain` | IndexedDB repo、snapshot repo | 刷新后可恢复最近项目 |

### P1 任务（首版闭环，不阻断发布）

| TaskId | 标题 | 目标 | 依赖 | 验收标准 |
|--------|------|------|------|----------|
| P1-001 | 局部编辑解释器 | `ReferenceContext → EditIntent → Command` 打通 | P0-005, P0-012, P0-013 | 10 个核心动作中至少 8 个可用 |
| P1-002 | 属性面板受约束编辑 | 宽高深、层高、后撑、型材系列可编辑 | P0-012, P0-013 | 属性面板与命令桥接正常 |
| P1-003 | 检测面板与解释 | blocker / warning / info 可筛选、可定位 | P0-005, P0-012 | 检测结果可定位到结构树节点 |
| P1-004 | 三视图 SVG 与 PDF | 输出工程方案单 | P0-009, P0-011 | PDF 关键尺寸与 BOM 摘要一致 |
| P1-005 | catalog ETL 工具 | catalog CSV/XLSX → 规范化 JSON | P0-004, P0-002 | 新 catalog 可校验并产出 canonical JSON |
| P1-006 | Babylon 选择/高亮/diff spike | 验证 thin-instance picking 稳定性 | P0-007 | 选中/高亮稳定，Scene 重建不丢状态 |
| P1-007 | 局部编辑指代消解验证 | 用 20 条 golden utterance 回放 | P1-001 | 目标解析准确率 ≥85% |
| P1-008 | 规则合法化确定性验证 | 同输入 100 次 hash 比对 | P0-005 | hash 100% 一致 |

### P2 任务（可延期）

| TaskId | 标题 | 依赖 |
|--------|------|------|
| P2-001 | exclude from BOM（构件级排除） | P0-008 |
| P2-002 | grouping（逻辑分组与批量编辑） | P1-001 |
| P2-003 | distributor submission ZIP | P0-009 |
| P2-004 | 多供应商映射 | P0-005, P2-001 |
| P2-005 | AI check-explain 真实实现 | P0-011 |

## 执行顺序

**串行（必须按顺序）：**
```
P0-001 → P0-002 → P0-003 → P0-004 → P0-005 → P0-006 → P0-007 → P0-008 → P0-009 → P0-010 → P0-011 → P0-012
                         ↑                                                        ↑
                         └──────────────── P0-013 ────────────────────────────────┘
                                                                                   
P0-014（可与 P0-003 后任意时间并行）
```

## 并行策略

| 可并行 | 条件 |
|--------|------|
| P0-011（apps/api） | P0-005 + P0-010 完成 |
| P1-005（catalog ETL） | P0-004 + P0-002 完成，可与 P0-005~P0-011 并行 |
| P1-006（Babylon spike） | P0-007 完成即开始 |
| P1-004（SVG/PDF） | P0-009 + P0-011 完成即开始 |
| P1-001（局部编辑） | P0-005 + P0-012 + P0-013 全部完成 |

## 第一个任务

**P0-001：初始化 monorepo 与 CI** ✅ **已完成**（2026-04-19）

- monorepo 结构建立（packages/domain, packages/schemas, apps/api, apps/web）
- pnpm workspaces 配置完成
- CI pipeline 搭建完成（lint + typecheck + test）
- 所有包 typecheck 通过

**P0-002：建立 packages/schemas** ✅ **已完成**（2026-04-20）

- DSL JSON Schema 文件（intent-dsl, confirmation-dsl, draft-dsl, resolved-dsl）
- AI I/O API Schema 文件（intent, draft）
- Runtime validator 使用 Ajv，支持格式校验
- Fixtures 全部通过校验（4/4）
- Gate P0-002 自动检查项全部 PASS

**P0-003：建立 packages/domain** ✅ **已完成**（2026-04-20）

- 完整 domain 类型体系：StructuralNode / JointNode / CommandEntry / CheckIssue / DesignBomItem / TradeBomItem
- 所有类型文件按 architecture 约束分布在 `src/project/`、`src/command/`、`src/bom/`、`src/checks/`、`src/structural/`、`src/joint/`
- Vec3、EntityRef、RevisionId 等 scalar 类型集中于 index.ts
- TypeScript strict mode 编译通过，fixtures schemaVersion = 1.0.0
- Gate P0-003 自动检查项全部 PASS
- **禁止依赖** apps、render-babylon 等应用层（约束满足）

**下一个任务：P0-004**（建立 packages/stdlib）

## 状态定义

- `queued` — 等待执行
- `picked` — 已领取
- `executing` — 执行中
- `validating` — 验收中
- `documenting` — 文档更新中
- `completed` — 完成
- `failed` — 失败（可重试）
- `blocked` — 阻断（需人工介入）
- `stale` — 心跳超时

## 任务完成规则

1. 每个任务必须经过 `executing → validating → documenting → completed`
2. 只有上一任务 `completed / failed / blocked` 才允许进入下一个任务
3. 存在 `picked / executing / validating / documenting` 的活动任务时，不领取新任务
4. 连续 2 次 stale → 标记 `blocked`
5. 连续 2 次同类错误 → 停止自动修复，等待人工介入

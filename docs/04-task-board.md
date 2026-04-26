# AI 铝型材设计系统 — 首版任务看板

> 来源：03开工蓝图.md | 优先级：P0 = 阻塞发布 / P1 = 首版闭环 / P2 = 可延期

---

## P0 任务（阻塞发布，首版必须打通）

| ID | 任务 | 优先级 | 依赖 | 状态 |
|----|------|--------|------|------|
| P0-001 | 初始化 monorepo 与 CI（workspace、lint、typecheck、test pipeline） | P0 | — | queued |
| P0-002 | 建立 packages/schemas（DSL / API contract、fixture、runtime validator） | P0 | P0-001 | queued |
| P0-003 | 建立 packages/domain（ProjectDocument / Command / StructuralNode / JointNode / CheckIssue） | P0 | P0-002 | queued |
| P0-004 | 建立 packages/stdlib（profile / connector / supplier policy / sku_map 种子数据） | P0 | P0-003 | queued |
| P0-005 | 建立 packages/rules（draftDsl → resolvedDsl → checks，规则合法化） | P0 | P0-003, P0-004 | queued |
| P0-006 | 建立 packages/modeler（resolvedDsl → geometry / SceneViewModel） | P0 | P0-005 | queued |
| P0-007 | 建立 packages/render-babylon（Scene 适配、选中、高亮、thin-instance picking） | P0 | P0-006 | queued |
| P0-008 | 建立 packages/bom（设计 BOM / 交易 BOM 双链路） | P0 | P0-004, P0-006 | queued |
| P0-009 | 建立 packages/export（SVG 三视图、PDF payload） | P0 | P0-008 | queued |
| P0-010 | 建立 packages/ai-contracts（prompts、tool schema、DTO、error envelope） | P0 | P0-002 | queued |
| P0-011 | 建立 apps/api AI endpoints（intent / draft / edit-intent / check-explain） | P0 | P0-005, P0-010 | completed |
| P0-012 | 建立 apps/web 编辑器壳层（Vue 3 + Pinia + Babylon 集成） | P0 | P0-007, P0-008, P0-011 | queued |
| P0-013 | 命令系统（语义命令、撤销/重做、快照恢复） | P0 | P0-003 | queued |
| P0-014 | 本地持久化底座（IndexedDB projects / snapshots / commands） | P0 | P0-003 | queued |

---

## P1 任务（首版闭环，不阻断发布但影响体验）

| ID | 任务 | 优先级 | 依赖 | 状态 |
|----|------|--------|------|------|
| P1-001 | 局部编辑解释器（ReferenceContext → EditIntent → Command） | P1 | P0-005, P0-012, P0-013 | queued |
| P1-002 | 属性面板受约束编辑（宽高深、层高、后撑、型材系列） | P1 | P0-012, P0-013 | queued |
| P1-003 | 检测面板与解释（blocker / warning / info 筛选、定位、修复建议） | P1 | P0-005, P0-012 | queued |
| P1-004 | 三视图 SVG 与 PDF 导出（工程方案单） | P1 | P0-009, P0-011 | queued |
| P1-005 | catalog ETL 工具（catalog CSV/XLSX → 规范化 JSON） | P1 | P0-004, P0-002 | queued |
| P1-006 | Babylon 选择 / 高亮 / diff spike 验证 | P1 | P0-007 | queued |
| P1-007 | 局部编辑指代消解准确率验证（≥85%） | P1 | P1-001 | queued |
| P1-008 | 规则合法化确定性验证（100 次 hash 一致） | P1 | P0-005 | queued |

---

## P2 任务（可延期，不进入首版）

| ID | 任务 | 优先级 | 依赖 | 状态 |
|----|------|--------|------|------|
| P2-001 | exclude from BOM（构件级排除） | P2 | P0-008 | queued |
| P2-002 | grouping（逻辑分组与批量编辑） | P2 | P1-001 | queued |
| P2-003 | distributor submission ZIP（外发包） | P2 | P0-009 | queued |
| P2-004 | 多供应商映射 | P2 | P0-005, P2-001 | queued |
| P2-005 | AI check-explain 真实实现 | P2 | P0-011 | queued |

---

## 高风险验证项（须在第 5~6 周前完成）

| 风险 | 验证方法 | 通过标准 | 失败降级 |
|------|----------|----------|----------|
| draftDsl → resolvedDsl → render 链路 | 10 条 golden fixture 完整生成 | ≥8 条合法 resolvedDsl 且 Scene 可重建 | 缩至单模板单 bay |
| Babylon 选中/高亮稳定性 | thin-instance picking 点击/hover/outline 测试 | 选中/高亮/树同步稳定，Scene 重建不丢状态 | 降级为普通 mesh |
| 局部编辑指代消解 | 20 条 golden utterance 回放 | 有上下文时目标解析 ≥85% | 缩至 selection-first |
| 规则合法化确定性 | 同输入 100 次重复 hash 比对 | hash 完全一致，无 silent fallback | 去掉自动分歧消解 |
| BOM 映射正确性 | catalog fixture exact match | 设计 BOM ≥98%，交易 BOM ≥95% | 首版只上线设计 BOM |
| PDF 与尺寸视图一致性 | fixture 比对 resolvedDsl / SVG / PDF | 三视图关键尺寸与 BOM 摘要一致 | 降级为 SVG + CSV + JSON bundle |
| AI strict schema 稳定性 | contract test 覆盖 refusal / schema_error | 所有响应落在 ok / refusal / schema_error 三态 | 缩成模板优先 |

---

## 8 周计划概览

| 周次 | 目标 | 关键里程碑 |
|------|------|-----------|
| Week 1 | 冻结底座 | monorepo + domain/schemas/stdlib + CI |
| Week 2 | 打通规则与建模 | draftDsl → resolvedDsl → modeler 可渲染 |
| Week 3 | 建编辑器壳层 | Scene / 结构树 / 选择同步 / 命令栈 |
| Week 4 | 接 AI 主链路 | intent → confirmation → draft 闭环 |
| Week 5 | 验局部编辑高风险 | EditIntent 准确率 ≥85% |
| Week 6 | 打通交付链路 | BOM + SVG + PDF 初版 |
| Week 7 | 硬化验收 | golden cases + E2E + 快照恢复 |
| Week 8 | 收敛与缓冲 | bugfix + 边界收紧 + 发布准备 |

---

## 依赖图（P0 任务）

```
P0-001 (monorepo + CI)
    │
    ├──► P0-002 (schemas)
    │         │
    │         ├──► P0-003 (domain)
    │         │         │
    │         │         ├──► P0-004 (stdlib)
    │         │         │         │
    │         │         │         └──► P0-005 (rules)
    │         │         │                   │
    │         │         │                   ├──► P0-006 (modeler)
    │         │         │                   │         │
    │         │         │                   │         └──► P0-007 (render-babylon)
    │         │         │                   │
    │         │         │                   ├──► P0-008 (bom)
    │         │         │                   │         │
    │         │         │                   │         └──► P0-009 (export)
    │         │         │                   │
    │         │         │                   └──► P0-013 (命令系统)
    │         │         │
    │         │         └──► P0-014 (持久化)
    │         │
    │         └──► P0-010 (ai-contracts)
    │                   │
    │                   └──► P0-011 (apps/api)
    │                             │
    └──► P0-012 (apps/web) ◄──────┘
              │                        ▲
              │                        │
              └──────────────────────────┘
                  (依赖 P0-007 + P0-008 + P0-011)
```

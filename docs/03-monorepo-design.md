# Monorepo 目录与包职责草案

## 顶层目录树

```
repo/
├── apps/
│   ├── web/                  # 前端工作区（Vue 3 + Pinia + Babylon）
│   └── api/                  # 后端 API（Node.js）
├── packages/
│   ├── domain/               # 核心域
│   ├── schemas/              # 契约层
│   ├── stdlib/               # 标准库
│   ├── rules/                # 规则引擎
│   ├── bom/                  # BOM 模块
│   ├── modeler/              # 建模层
│   ├── render-babylon/       # Babylon 渲染适配
│   ├── export/               # 导出模块
│   ├── ai-contracts/         # AI 合同层
│   └── test-fixtures/         # 测试资产
├── tools/
│   └── catalog-etl/          # Catalog ETL 工具
├── docs/                     # 文档（冻结后不可随意修改）
└── .automation/              # 自动化状态与任务
```

## packages 列表与职责

### packages/domain
- **职责：** `ProjectDocument`、`CommandEntry`、`StructuralNode`、`JointNode`、`CheckIssue`、`SnapshotMeta`、核心枚举、DSL 类型定义
- **允许依赖：** 无应用层依赖
- **禁止依赖：** 任何 `apps/*`、`render-babylon`
- **首版状态：** 必须先建

### packages/schemas
- **职责：** JSON Schema、AI I/O Schema、runtime validator、API contract
- **允许依赖：** `domain`
- **禁止依赖：** Vue、Babylon、应用服务
- **首版状态：** 必须先建

### packages/stdlib
- **职责：** profile / connector / supplier policy / sku_map / catalog 种子数据
- **允许依赖：** `domain`
- **禁止依赖：** `apps/*`、`render-babylon`
- **首版状态：** 必须先建

### packages/rules
- **职责：** `draftDsl -> resolvedDsl` 合法化、默认值补全、拓扑生成、检测规则
- **允许依赖：** `domain`、`schemas`、`stdlib`
- **禁止依赖：** 渲染层和 UI 层
- **首版状态：** 必须先建

### packages/bom
- **职责：** 设计 BOM 聚合、交易 BOM 映射、pack rounding、采购策略
- **允许依赖：** `domain`、`stdlib`
- **禁止依赖：** `apps/web`、`render-babylon`
- **首版状态：** 必须先建

### packages/modeler
- **职责：** `resolvedDsl -> geometry primitives / SceneViewModel / DimensionViewModel`
- **允许依赖：** `domain`、`stdlib`
- **禁止依赖：** Babylon
- **首版状态：** 必须先建

### packages/render-babylon
- **职责：** Babylon Scene 适配、mesh pool、picking、highlight、diff 应用器
- **允许依赖：** `domain`、`modeler`
- **禁止依赖：** 被 `domain/rules/bom/stdlib` 反向引用
- **首版状态：** 必须先建

### packages/export
- **职责：** 三视图 SVG 生成、CSV 导出、PDF payload 组装
- **允许依赖：** `domain`、`bom`、`modeler`
- **禁止依赖：** `apps/web`
- **首版状态：** 必须先建

### packages/ai-contracts
- **职责：** prompt 模板、tool schema、AI DTO、error envelope
- **允许依赖：** `domain`、`schemas`
- **禁止依赖：** `apps/web` / `apps/api` 实现
- **首版状态：** 必须先建

### packages/test-fixtures
- **职责：** golden cases、catalog fixture、resolved fixture、bom fixture
- **允许依赖：** 所有 shared 包
- **禁止依赖：** 不能成为业务包的运行时依赖
- **首版状态：** 必须先建

## apps 列表与职责

### apps/web
- **职责：** Vue 3 UI、Pinia stores、Babylon 集成、IndexedDB persistence、交互层
- **允许依赖：** 所有 shared packages
- **禁止依赖：** 不得被任意 package 导入
- **首版状态：** 必须

### apps/api
- **职责：** AI Orchestrator、catalog 下发、PDF 渲染、version 服务
- **允许依赖：** `schemas`、`stdlib`、`bom`、`export`、`ai-contracts`
- **禁止依赖：** 不得被任意 package 导入
- **首版状态：** 必须

### tools/catalog-etl
- **职责：** 原始 catalog CSV/XLSX → 规范化 JSON 转换与校验
- **允许依赖：** `stdlib`、`schemas`、`test-fixtures`
- **禁止依赖：** 不得被应用运行时依赖
- **首版状态：** P1

## 依赖约束表

| 包 | 允许依赖 | 禁止依赖 |
|---|---|---|
| `domain` | 无 | 任何 app、render-babylon |
| `schemas` | `domain` | Vue、Babylon、应用服务 |
| `stdlib` | `domain` | `apps/*`、`render-babylon` |
| `rules` | `domain`、`schemas`、`stdlib` | 渲染层、UI 层 |
| `bom` | `domain`、`stdlib` | `apps/web`、`render-babylon` |
| `modeler` | `domain`、`stdlib` | Babylon |
| `render-babylon` | `domain`、`modeler` | 被 `domain/rules/bom/stdlib` 反向引用 |
| `export` | `domain`、`bom`、`modeler` | `apps/web` |
| `ai-contracts` | `domain`、`schemas` | app 实现 |
| `apps/web` | 所有 shared 包 | 被任意 package 导入 |
| `apps/api` | `schemas`、`stdlib`、`bom`、`export`、`ai-contracts` | 被任意 package 导入 |

## 建仓顺序

**必须按此顺序建仓，禁止乱序：**

```
1. domain       （底座，无任何应用依赖）
2. schemas      （依赖 domain）
3. stdlib       （依赖 domain）
4. rules        （依赖 domain + schemas + stdlib）
5. modeler      （依赖 domain + stdlib）
6. bom          （依赖 domain + stdlib）
7. render-babylon（依赖 domain + modeler）
8. export       （依赖 domain + bom + modeler）
9. ai-contracts（依赖 domain + schemas）
10. test-fixtures（依赖所有 shared 包）
11. apps/api    （依赖 8 + 9）
12. apps/web    （依赖 1~10）
```

## 首版必建清单

| 阶段 | 必须建设的包 |
|---|---|
| Week 1 | `domain`、`schemas`、`stdlib`、`test-fixtures` |
| Week 2 | `rules`、`modeler` |
| Week 3 | `render-babylon`、`bom` |
| Week 4 | `ai-contracts`、`apps/api` |
| Week 5~6 | `apps/web`、`export` |

## 禁止事项

1. 禁止在底座包（`domain`、`schemas`）未稳定前建设应用层
2. 禁止 `apps/web` 反向依赖任何业务包
3. 禁止 `render-babylon` 被核心业务包引用
4. 禁止在未通过架构验证前引入新包

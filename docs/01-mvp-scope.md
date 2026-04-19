# MVP 边界冻结

## 项目目标

打造一个 AI 驱动的 3D 铝型材网页装配设计器，核心定位为"**受约束的会话式装配设计器**"，而非通用 Web CAD。

产品主链路：**自然语言意图 → 确认层 → 结构草案 DSL → 规则合法化 → 前端本地参数化建模 → 设计 BOM → 交易 BOM / 采购映射 → PDF 方案单**

---

## 本期范围（必须做）

### 首版产品边界

| 分类 | 内容 | 说明 |
|---|---|---|
| 结构类型 | 矩形、正交、开放式、落地式储物架 / 置物架 | 不支持斜角、L型、自由建模 |
| 用户输入 | 自然语言为主 | 聊需求、聊修改 |
| 交互方式 | 会话 + 点选辅助 | 不暴露 CAD 式操作 |
| 编辑能力 | 受约束的局部编辑 | 6~8 个语义动作 |
| 检测能力 | 经验规则 + 合理性检查 | 不做工程仿真 |
| 导出能力 | 设计 BOM、交易 BOM、三视图 SVG、PDF | 规格级，不含实时价格 |
| 持久化 | IndexedDB 本地保存 | 支持快照、撤销/重做 |

### 首版 DSL 主链路

```
intentDsl → confirmationDsl → draftDsl → resolvedDsl（唯一真相源）
```

- AI 只产出 `intentDsl` / `draftDsl` / `EditIntent` / `check explanation`
- `resolvedDsl` 必须经规则层合法化，不允许 AI 直出
- BOM、检测结论、SKU 不允许 AI 直接产出

### 首版技术边界

| 模块 | 首版必须做 |
|---|---|
| 前端本地建模 | 主要编辑动作不依赖后端回包 |
| 规则引擎 | `draftDsl -> resolvedDsl`，默认值补全、合法化、检测 |
| Babylon.js | 3D 渲染、选中、高亮、thin-instance picking |
| 命令模式 | 语义命令（`resizeBay` / `insertLevel` 等），禁止几何命令 |
| Web Worker | 规则重算、BOM、检测，不阻塞 UI |
| IndexedDB | 存 ProjectDocument / 命令 / 快照 / 导出产物 |

---

## 非目标（明确不做）

| 分类 | 内容 | 说明 |
|---|---|---|
| 建模 | 自由手工从零建模、草图/拉伸/约束求解 | 不提供 Web CAD 式操作 |
| 结构类型 | 非矩形 / L 型 / 斜撑混合空间框架 | 二期再做 |
| 仿真 | 复杂工况、强度/稳定性/碰撞仿真 | 不做工程分析 |
| 商业 | 实时价格 / 库存、账号体系、云同步、多人协作、直接下单 | 首版全部后置 |
| 生态 | 门、抽屉、面板、多供应商映射 | 仅预留接口 |

---

## MVP 主链路（唯一）

```
用户输入需求
    ↓
intentDsl（AI 解析需求）
    ↓
confirmationDsl（用户确认关键参数）
    ↓
draftDsl（AI 生成结构草案）
    ↓
resolvedDsl（规则层合法化，唯一真相源）
    ↓
3D 可编辑工作区 + 结构树 + 属性面板
    ↓
局部编辑（ReferenceContext → EditIntent → Command）
    ↓
检测模块（blocker / warning / info）
    ↓
设计 BOM + 交易 BOM + 三视图 SVG + PDF
```

---

## 验收口径

### MVP 闭环标准

| 能力 | 通过条件 |
|---|---|
| 需求解析与确认 | 稳定产出 `intentDsl` 与 `confirmationDsl`，关键项未确认时能阻断生成 |
| 结构合法化 | `draftDsl` 必须能变成合法 `resolvedDsl` |
| 可编辑工作区 | 3D、结构树、属性面板、选中同步可用 |
| 局部编辑与历史 | 核心编辑动作可用，撤销/重做可用 |
| BOM 与导出 | 设计 BOM、交易 BOM、SVG、PDF 都能从 `resolvedDsl` 派生 |

### 首版验收门

1. 10 条典型 fixture 跑完整生成链路，至少 8 条得到合法 `resolvedDsl`
2. Babylon 选中/高亮/树同步稳定，Scene 重建不丢状态
3. 局部编辑指代消解准确率 ≥85%（有选中上下文时）
4. 设计 BOM 准确率 ≥98%，交易 BOM ≥95%
5. 三视图关键尺寸与 BOM 摘要一致

---

## 风险边界

| 风险 | 边界处理 |
|---|---|
| AI 幻觉 | schema 校验 + 规则层兜底，不允许 AI 直接写 `resolvedDsl` |
| 结构不一致 | 3D 永远不是 source of truth，`resolvedDsl` 才是 |
| 前后端漂移 | 前后端共享 `schemas` / `rules` 包，不各自实现两套 |
| 编辑回滚 | 命令模式 + snapshot，必须能从任意状态恢复 |

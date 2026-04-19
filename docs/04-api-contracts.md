# 核心接口与 Schema 冻结

> M1 = 首版必须冻结；P1/P2 = 可延期

## 核心领域对象

### ProjectDocument（项目唯一真相源）

| 字段 | 类型 | M1/P1 | 说明 |
|---|---|---|---|
| `schemaVersion` | `'1.0.0'` | M1 | 冻结 |
| `projectId` | `string` | M1 | 冻结 |
| `name` | `string` | M1 | |
| `locale` | `'zh-CN' \| 'en-US'` | M1 | 冻结 |
| `unitSystem` | `'mm'` | M1 | 冻结 |
| `stdlibVersion` | `string` | M1 | 冻结，历史项目复现必须 |
| `ruleVersion` | `string` | M1 | 冻结 |
| `catalogVersion` | `string` | M1 | 冻结 |
| `resolvedDsl` | `ResolvedDsl` | M1 | **唯一真相源** |
| `structuralNodes` | `StructuralNode[]` | M1 | derived cache |
| `jointNodes` | `JointNode[]` | M1 | derived cache |
| `designBom` | `DesignBomItem[]` | M1 | derived cache |
| `tradeBom` | `TradeBomItem[]` | M1 | derived cache |
| `checkIssues` | `CheckIssue[]` | M1 | derived cache |
| `currentRevisionId` | `string` | M1 | 冻结 |
| `commandCursor` | `number` | M1 | |
| `snapshotIds` | `SnapshotId[]` | M1 | |
| `intentDsl` | `IntentDsl \| null` | M1 | 原样存档 |
| `confirmationDsl` | `ConfirmationDsl \| null` | M1 | 原样存档 |
| `draftDsl` | `DraftDsl \| null` | M1 | 原样存档 |
| `uiState` | `object` | P1 | |
| `modelAudit` | `object` | P2 | |

### StructuralNode（结构节点）

| 字段 | 类型 | M1/P1 | 说明 |
|---|---|---|---|
| `nodeId` | `NodeId` | M1 | 稳定 ID |
| `kind` | `'member' \| 'module'` | M1 | 冻结 |
| `role` | `'upright' \| 'beamX' \| 'beamY' \| 'brace' \| 'foot'` | M1 | 冻结 |
| `semanticPath` | `string` | M1 | 如 `bay[0].level[2].rear.beamX` |
| `axis` | `'x' \| 'y' \| 'z'` | M1 | 冻结 |
| `start` / `end` | `Vec3` | M1 | 冻结 |
| `lengthMm` | `number` | M1 | |
| `profileSpecKey` | `string` | M1 | |
| `provenance.source` | `'user' \| 'ai' \| 'rule' \| 'system'` | M1 | |
| `provenance.ruleIds` | `string[]` | M1 | 冻结 |
| `finishKey` | `string \| null` | P1 | |
| `tags` | `string[]` | P1 | |

### JointNode（连接节点）

| 字段 | 类型 | M1/P1 | 说明 |
|---|---|---|---|
| `jointId` | `JointId` | M1 | 稳定 ID |
| `topology` | `'corner-3way' \| 'tee-3way' \| 'cross-4way' \| 'brace-end' \| 'foot'` | M1 | 冻结 |
| `semanticPath` | `string` | M1 | 冻结 |
| `position` | `Vec3` | M1 | 冻结 |
| `memberIds` | `NodeId[]` | M1 | 冻结 |
| `connectorSpecKey` | `string` | M1 | 规格层键 |
| `connectorFamilyKey` | `string` | M1 | 抽象层键 |

## DSL 契约

| DSL | 职责 | 产出者 | 是否真相源 |
|---|---|---|---|
| `IntentDsl` | 抽取用户需求与歧义 | AI | 否 |
| `ConfirmationDsl` | 需用户确认的决策清单 | 应用编译 + 用户确认 | 否 |
| `DraftDsl` | 结构草案、拓扑意图 | AI | 否 |
| `ResolvedDsl` | 准确坐标、规格、节点、连接、BOM seed | 规则层 | **是** |

### IntentDsl（M1）

```ts
interface IntentDsl {
  dslVersion: '1.0.0'      // M1
  projectType: 'storage_rack'  // M1
  space: {                   // M1
    widthMm: number
    depthMm: number
    heightMm: number
    placement: 'floor'
  }
  capacity: {               // M1
    shelfCount: number
    loadTier: 'light' | 'medium' | 'heavy'
  }
  preferences: {            // M1
    profileSeries: string | null
    rearBrace: boolean | null
    caster: boolean
  }
  constraints: {             // M1
    againstWall: boolean
    maxWidthMm: number | null
  }
  ambiguities: Array<{ key: string; question: string; status: 'open' | 'resolved' }>  // M1
}
```

### ResolvedDsl（M1，source of truth）

```ts
interface ResolvedDsl {
  dslVersion: '1.0.0'
  projectType: 'storage_rack'
  sourceRevisionId: string
  overallSizeMm: { width: number; depth: number; height: number }
  modules: Array<{ moduleId: string; kind: 'rect-bay'; spanMm: number }>
  nodes: StructuralNode[]    // M1 冻结
  joints: JointNode[]        // M1 冻结
}
```

## 本地命令契约

### CommandEntry（M1）

| 字段 | 类型 | 说明 |
|---|---|---|
| `commandId` | `CommandId` | 稳定 ID |
| `type` | 枚举（见下） | 语义命令类型 |
| `source` | `'user-ui' \| 'user-chat' \| 'ai' \| 'rule-autofix' \| 'system'` | |
| `targetRefs` | `EntityRef[]` | 作用对象 |
| `payload` | `Record<string, unknown>` | 正向参数 |
| `inversePayload` | `Record<string, unknown>` | 逆向参数（用于撤销） |
| `beforeRevisionId` | `string` | M1 冻结 |
| `afterRevisionId` | `string` | M1 冻结 |

**允许的语义命令（M1 冻结）：**
- `resizeOverall` / `resizeBay`
- `insertLevel` / `removeLevel` / `moveLevel`
- `toggleBrace`
- `replaceProfileSeries`
- `addBeam` / `removeBeam`
- `insertBay` / `removeBay`
- `restoreSnapshot`

### ReferenceContext（M1）

```ts
interface ReferenceContext {
  activeSelection: Array<{
    entityType: 'structural' | 'joint' | 'module'
    id: string
    semanticPath: string
    role?: string
    axis?: 'x' | 'y' | 'z'
    center: Vec3
    bbox: { min: Vec3; max: Vec3 }
    bayIndex?: number | null
    levelIndex?: number | null
  }>
  hoverTarget: null | { entityType; id; semanticPath; worldPoint? }
  cameraContext: { viewPreset: 'iso' | 'front' | 'right' | 'top'; forward: Vec3; up: Vec3; right: Vec3 }
  structureContext: { focusedModuleId?: string | null; expandedSemanticPaths: string[] }
  recentReferences: Array<{ id: string; semanticPath: string; referencedAt: string }>
  allowedActions: EditAction[]  // M1 冻结
}
```

### EditIntent（M1）

```ts
interface EditIntent {
  action: EditAction  // M1 冻结
  targetMode: 'selected' | 'semantic' | 'relative' | 'global'  // M1
  targetRef: string | null  // M1
  params: Record<string, unknown>
  confidence: number
  needsFollowUp: boolean  // M1 冻结
}
```

## 后端 API 契约

| Endpoint | Input | Output | 同步/异步 | M1 |
|---|---|---|---|---|
| `POST /v1/ai/intent` | `ParseRequirementsRequest` | `{ intentDsl, needsConfirmationKeys }` | 同步 | ✅ |
| `POST /v1/ai/draft` | `ProposeDraftRequest` | `{ draftDsl }` | 同步 | ✅ |
| `POST /v1/ai/edit-intent` | `ResolveEditIntentRequest` | `{ editIntent }` | 同步 | ✅ |
| `GET /v1/runtime/versions` | — | `{ stdlibVersion, ruleVersion, promptVersion, currentCatalogVersion }` | 同步 | ✅ |
| `GET /v1/catalog/:version` | `version path` | `CatalogBundleResponse` | 同步 | ✅ |
| `POST /v1/export/pdf` | `ExportPdfRequest` | `ExportPdfResponse` | 同步 | ✅ |

## 版本字段要求（M1 冻结）

每个 `ProjectDocument` 必须携带以下版本字段，否则历史方案不可复现：

- `stdlibVersion` — 标准库版本
- `ruleVersion` — 规则引擎版本
- `catalogVersion` — 供应商目录版本
- `currentRevisionId` — 当前 revision ID

## AI 禁区（禁止交给 AI 的内容）

| 禁止项 | 原因 |
|---|---|
| `resolvedDsl` 直接输出 | 必须经规则层合法化 |
| 长度计算 | 确定性计算，由规则层执行 |
| 连接件兼容性判断 | 必须走 `rules` 包 |
| 装配约束求解 | 必须由规则引擎执行 |
| BOM 汇总与 SKU 映射 | `bom` 包负责，AI 只提供意图 |
| 检测结论 | 必须基于 `rules` 输出生成 |
| 交易 BOM 映射 | `apps/api` 持有 authoritative mapping |

**所有 AI 输出必须通过 schema validator 校验。AI 响应只能是 `ok / refusal / schema_error` 三态。**

# 阶段验收门

> 每个 P0 任务必须有明确 Definition of Done；P1 参考执行

## P0 验收门

### Gate P0-001：初始化 monorepo 与 CI

**自动检查项：**
```bash
# 1. 目录结构存在
test -d packages/domain && test -d packages/schemas && test -d apps/web && test -d apps/api

# 2. package.json 存在且有效
test -f packages/domain/package.json
test -f packages/schemas/package.json

# 3. CI pipeline 文件存在
test -f .github/workflows/ci.yml || test -f .gitlab-ci.yml

# 4. root package.json 有 workspace 配置
grep -q '"workspaces"' package.json

# 5. typecheck 通过
cd packages/domain && pnpm typecheck 2>/dev/null || echo "skip"
```

**人工检查项：**
- [ ] lint / typecheck / test 三件套可独立运行
- [ ] PR 合并前 CI 状态可见

---

### Gate P0-002：packages/schemas

**自动检查项：**
```bash
# 1. DSL schema 文件存在
test -f packages/schemas/src/dsl/intent-dsl.schema.json
test -f packages/schemas/src/dsl/confirmation-dsl.schema.json
test -f packages/schemas/src/dsl/draft-dsl.schema.json
test -f packages/schemas/src/dsl/resolved-dsl.schema.json

# 2. API schema 文件存在
test -f packages/schemas/src/api/intent.schema.json
test -f packages/schemas/src/api/draft.schema.json

# 3. runtime validator 可运行
node -e "require('./packages/schemas/dist/validator.js')" 2>/dev/null && echo "ok"

# 4. fixture 全部过 validator
node packages/schemas/src/validators/run-fixtures.js 2>/dev/null
```

**人工检查项：**
- [ ] JSON Schema 符合 M1 冻结要求，无 P1/P2 字段混入 M1
- [ ] AI I/O schema 与 `docs/04-api-contracts.md` 一致

---

### Gate P0-003：packages/domain

**自动检查项：**
```bash
# 1. 核心类型文件存在
test -f packages/domain/src/project/ProjectDocument.ts
test -f packages/domain/src/command/CommandEntry.ts
test -f packages/domain/src/bom/DesignBomItem.ts
test -f packages/domain/src/checks/CheckIssue.ts

# 2. TypeScript 编译无错误
cd packages/domain && pnpm build 2>/dev/null

# 3. 类型与 schemas fixture 一致
node -e "const d = require('./packages/domain/dist/project.fixture.json'); console.log(d.schemaVersion)" 2>/dev/null
```

**人工检查项：**
- [ ] `StructuralNode`、`JointNode`、`CheckIssue` 字段与 `docs/04-api-contracts.md` M1 冻结一致
- [ ] 无 Babylon / Vue 类型混入 domain

---

### Gate P0-004：packages/stdlib

**自动检查项：**
```bash
# 1. 种子数据目录存在
test -d packages/stdlib/src/profiles
test -d packages/stdlib/src/connectors
test -d packages/stdlib/src/policies

# 2. 至少 3 个典型案例可用
ls packages/stdlib/src/profiles/*.json | wc -l  # >= 3

# 3. catalog fixture 可加载
node -e "require('./packages/stdlib/dist/catalog.fixture.json')" 2>/dev/null && echo "ok"
```

**人工检查项：**
- [ ] profile / connector 规格数据与行业资料一致
- [ ] 无业务逻辑混入（仅静态数据）

---

### Gate P0-005：packages/rules

**自动检查项：**
```bash
# 1. 规则文件存在
test -f packages/rules/src/normalize/index.ts
test -f packages/rules/src/resolve/index.ts
test -f packages/rules/src/checks/index.ts

# 2. 10 条 golden fixture 运行
cd packages/rules && pnpm test:golden 2>/dev/null
# 通过标准：至少 8/10

# 3. TypeScript 编译无错误
cd packages/rules && pnpm build 2>/dev/null
```

**人工检查项：**
- [ ] `draftDsl -> resolvedDsl` 链路打通，无 AI 直出
- [ ] 10 条 golden 中至少 8 条产出合法 `resolvedDsl`（截图留存）
- [ ] 100 次 hash 测试 100% 一致

---

### Gate P0-006：packages/modeler

**自动检查项：**
```bash
# 1. geometry / scene-vm 文件存在
test -f packages/modeler/src/geometry/index.ts
test -f packages/modeler/src/scene-vm/index.ts

# 2. TypeScript 编译无错误
cd packages/modeler && pnpm build 2>/dev/null
```

**人工检查项：**
- [ ] `resolvedDsl -> geometry` 转换逻辑正确
- [ ] `SceneViewModel` 不持有 Babylon Scene 实例

---

### Gate P0-007：packages/render-babylon

**自动检查项：**
```bash
# 1. scene-adapter / picking 文件存在
test -f packages/render-babylon/src/scene-adapter/index.ts
test -f packages/render-babylon/src/picking/index.ts

# 2. thin-instance picking 测试通过
cd packages/render-babylon && pnpm test:picking 2>/dev/null

# 3. Babylon spike 验证
cd packages/render-babylon && pnpm test:spike 2>/dev/null
```

**人工检查项：**
- [ ] thin-instance picking 稳定（截图留存）
- [ ] Scene 可从 `ProjectDocument` 完整重建
- [ ] 无业务状态泄漏到 Babylon 层

---

### Gate P0-008：packages/bom

**自动检查项：**
```bash
# 1. design / trade / mapping 文件存在
test -f packages/bom/src/design/index.ts
test -f packages/bom/src/trade/index.ts
test -f packages/bom/src/mapping/index.ts

# 2. BOM 映射测试
cd packages/bom && pnpm test:mapping 2>/dev/null
# 通过标准：设计 BOM ≥98%，交易 BOM ≥95%
```

**人工检查项：**
- [ ] 设计 BOM / 交易 BOM 数量可人工复核
- [ ] `mappingStatus` 正确标记

---

### Gate P0-009：packages/export

**自动检查项：**
```bash
# 1. svg / pdf-payload 文件存在
test -f packages/export/src/svg/index.ts
test -f packages/export/src/pdf-payload/index.ts

# 2. SVG 生成测试
cd packages/export && pnpm test:svg 2>/dev/null
```

**人工检查项：**
- [ ] 三视图关键尺寸与 `resolvedDsl` 一致（抽查 3 个）
- [ ] SVG 标签正确（宽度/高度/层高）

---

### Gate P0-010：packages/ai-contracts

**自动检查项：**
```bash
# 1. prompts / tools / dto 文件存在
test -f packages/ai-contracts/src/prompts/intent.ts
test -f packages/ai-contracts/src/tools/intent.schema.json

# 2. 所有 tool schema 符合 M1 冻结要求
node packages/ai-contracts/src/validators/validate-schemas.js 2>/dev/null
```

**人工检查项：**
- [ ] prompt 不含 M1 冻结范围外的内容
- [ ] error envelope 格式正确

---

### Gate P0-011：apps/api

**自动检查项：**
```bash
# 1. 四个 endpoint 文件存在
test -f apps/api/src/routes/ai-intent.ts
test -f apps/api/src/routes/ai-draft.ts
test -f apps/api/src/routes/ai-edit-intent.ts
test -f apps/api/src/routes/check-explain.ts

# 2. API 启动测试
cd apps/api && pnpm build 2>/dev/null && timeout 5 pnpm start 2>/dev/null &
sleep 3 && curl -s http://localhost:3000/v1/runtime/versions | grep -q stdlibVersion && echo "ok"

# 3. contract test 通过
cd apps/api && pnpm test:contract 2>/dev/null
```

**人工检查项：**
- [ ] 所有 AI 响应落在 `ok / refusal / schema_error` 三态

---

### Gate P0-012：apps/web

**自动检查项：**
```bash
# 1. 核心页面文件存在
test -f apps/web/src/features/editor/index.vue
test -f apps/web/src/stores/projectStore.ts

# 2. Vite build 成功
cd apps/web && pnpm build 2>/dev/null

# 3. Babylon 集成无 TS 错误
cd apps/web && pnpm typecheck 2>/dev/null
```

**人工检查项：**
- [ ] Scene / 结构树 / 属性面板 / 选中同步可用（手动测试）
- [ ] IndexedDB 持久化可用（刷新后数据恢复）

---

### Gate P0-013：命令系统

**自动检查项：**
```bash
# 1. command bus 文件存在
test -f apps/web/src/services/commandBus.ts

# 2. 20 次连续命令测试
cd apps/web && pnpm test:commands --count 20 2>/dev/null
# 通过标准：历史一致
```

**人工检查项：**
- [ ] snapshot restore 后 UI/Scene/BOM/checks 一致

---

### Gate P0-014：本地持久化底座

**自动检查项：**
```bash
# 1. IndexedDB repo 文件存在
test -f apps/web/src/services/persistenceService.ts

# 2. 刷新恢复测试
cd apps/web && pnpm test:persistence 2>/dev/null
```

**人工检查项：**
- [ ] 最近项目在刷新后正确恢复

---

## P1 验收门（摘要）

| TaskId | 核心验收项 | 通过标准 |
|--------|-----------|----------|
| P1-001 | 局部编辑解释器 | 10 个核心动作中至少 8 个可用 |
| P1-002 | 属性面板 | 宽高深、层高、后撑、型材系列可编辑 |
| P1-003 | 检测面板 | blocker/warning/info 可筛选、可定位 |
| P1-004 | PDF 导出 | 关键尺寸与 BOM 摘要一致 |
| P1-005 | catalog ETL | 新 catalog 可校验并产出 canonical JSON |
| P1-006 | Babylon spike | thin-instance picking 稳定 |
| P1-007 | 指代消解验证 | 准确率 ≥85% |
| P1-008 | 规则确定性验证 | 100 次 hash 100% 一致 |

## 自动检查项汇总

所有 P0 任务的自动检查项都应纳入 CI：

```yaml
# .github/workflows/ci.yml
jobs:
  acceptance:
    - name: P0-001 monorepo
      run: make check-p0-001
    - name: P0-002 schemas
      run: make check-p0-002
    - name: P0-003 domain
      run: make check-p0-003
    # ... 以此类推
```

## 人工检查项汇总

| 任务 | 人工检查项 |
|------|-----------|
| P0-001 | CI 三件套可独立运行 |
| P0-002 | schema M1 冻结一致性 |
| P0-003 | 类型与接口一致 |
| P0-004 | 规格数据与行业资料一致 |
| P0-005 | golden ≥8/10；hash 100% 一致 |
| P0-006 | geometry 转换正确 |
| P0-007 | thin-instance picking 稳定 |
| P0-008 | BOM 数量可复核 |
| P0-009 | SVG 尺寸一致 |
| P0-010 | prompt 和 error envelope 正确 |
| P0-011 | AI 三态正确 |
| P0-012 | Scene/结构树/选中同步可用 |
| P0-013 | snapshot restore 一致 |
| P0-014 | 刷新后数据恢复 |

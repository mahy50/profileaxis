# 首轮技术风险验证计划

## 风险项列表

### Risk-01：draftDsl → resolvedDsl → render 链路断裂

| 属性 | 内容 |
|---|---|
| 风险描述 | 规则层与建模层无法闭环，导致输入能解析但无法渲染为合法 3D 结构 |
| 验证方法 | 用 10 条典型 fixture 跑完整生成链路，验证从 `ProjectDocument` 可重建 Scene |
| 通过标准 | 10 条中至少 8 条得到合法 `resolvedDsl` 且 Scene 可重建 |
| 前 2 周必须完成 | ✅ |
| 失败降级 | 立刻缩成单模板、单 bay 版本，先保结构闭环 |

### Risk-02：Babylon 选中 / 高亮 / diff 不稳定

| 属性 | 内容 |
|---|---|
| 风险描述 | thin-instance picking 可能不稳定；scene 与业务边界容易耦合 |
| 验证方法 | 做 Babylon spike：点击选中、hover、高亮（outline）、结构树同步、Scene 销毁重建 |
| 通过标准 | 选中/高亮/树同步稳定；Scene 重建不丢业务状态 |
| 前 2 周必须完成 | ✅ |
| 失败降级 | 暂时降级为普通 mesh；配件先用 thin instance 聚合而非独立 mesh |

### Risk-03：局部编辑指代消解准确率不足

| 属性 | 内容 |
|---|---|
| 风险描述 | "这根 / 这一层 / 后面那根" 命中率低会直接毁掉编辑体验 |
| 验证方法 | 用 20 条带 selection / hover / camera context 的 golden utterance 回放 |
| 通过标准 | 有选中上下文时目标解析正确率达到 ≥85%；有歧义时必须追问，不允许乱猜 |
| 前 5 周必须完成 | ✅ |
| 失败降级 | 缩 scope 到 selection-first，只支持已选对象的编辑 |

### Risk-04：规则合法化不确定性

| 属性 | 内容 |
|---|---|
| 风险描述 | 同一输入多次生成不同结构，历史项目不可复现 |
| 验证方法 | 同输入重复跑 100 次，比较 `resolvedDsl` hash；为核心规则写单测 |
| 通过标准 | hash 完全一致；无 silent fallback |
| 前 3 周必须完成 | ✅ |
| 失败降级 | 缩小 stdlib 和 tie-break 组合；先去掉自动分歧消解 |

### Risk-05：BOM 映射正确性不足

| 属性 | 内容 |
|---|---|
| 风险描述 | design BOM 与 trade BOM 可能被 catalog 脏数据拖垮 |
| 验证方法 | 用 catalog fixture 做 exact match 测试，检查 `mappingStatus` 与采购量 |
| 通过标准 | 设计 BOM 准确率 ≥98%；交易映射达到 ≥95%；未映射必须抛 C06 |
| 前 6 周必须完成 | ✅ |
| 失败降级 | 首版只上线设计 BOM；交易 BOM 仅内部预览 |

### Risk-06：PDF 与尺寸视图一致性

| 属性 | 内容 |
|---|---|
| 风险描述 | SVG、PDF、当前模型三者容易不一致 |
| 验证方法 | 用固定 fixture 比对 `resolvedDsl` 尺寸、三视图 SVG、PDF 关键字段 |
| 通过标准 | 前/右/顶关键尺寸与 BOM 摘要一致 |
| 前 6 周必须完成 | ✅ |
| 失败降级 | 暂时降级为导出 `SVG + CSV + JSON bundle`，推迟 PDF |

### Risk-07：AI strict schema 稳定性

| 属性 | 内容 |
|---|---|
| 风险描述 | schema 合法但语义错误，或 schema 漂移导致接口崩溃 |
| 验证方法 | 对每个 AI endpoint 做 contract test，覆盖 refusal / schema_error 三态 |
| 通过标准 | 所有 AI 响应只能落在 `ok / refusal / schema_error` 三态内 |
| 前 4 周必须完成 | ✅ |
| 失败降级 | 先缩成模板优先；AI 只做 intent 解析，不生成 draft |

### Risk-08：全量业务重算与局部渲染更新不一致

| 属性 | 内容 |
|---|---|
| 风险描述 | 业务全量重算与渲染局部更新容易出现不一致 |
| 验证方法 | 执行 20 次连续命令，比较 `resolvedDsl / BOM / checks / render` 与 reload 后结果 |
| 通过标准 | 20 次编辑内历史一致；snapshot restore 后 UI/Scene/BOM/checks 一致 |
| 前 3 周必须完成 | ✅ |
| 失败降级 | 暂时放弃 scene diff；先全量重建 Scene |

## 验证顺序

```
Week 1: Risk-01（建仓后优先验证，否则后面全返工）
Week 2: Risk-02 + Risk-04 + Risk-08（并行 spike）
Week 3: Risk-04 收尾 + Risk-07
Week 4: Risk-07 收尾 + Risk-03 开始
Week 5: Risk-03 收尾
Week 6: Risk-05 + Risk-06
Week 7: 全部复验
```

## 通过阈值汇总

| 风险 | 通过阈值 |
|---|---|
| Risk-01 | ≥8/10 fixture 合法 resolvedDsl + Scene 可重建 |
| Risk-02 | 选中/高亮/树同步稳定，Scene 重建不丢状态 |
| Risk-03 | 目标解析 ≥85%，有歧义时追问率 100% |
| Risk-04 | 100 次 hash 100% 一致 |
| Risk-05 | 设计 BOM ≥98%，交易 BOM ≥95% |
| Risk-06 | 三视图关键尺寸与 BOM 摘要一致 |
| Risk-07 | 100% 落在 ok/refusal/schema_error 三态 |
| Risk-08 | 20 次编辑内历史一致，snapshot restore 一致 |

## 降级路径汇总

| 风险 | 降级方案 |
|---|---|
| Risk-01 | 单模板单 bay |
| Risk-02 | 普通 mesh 降级 |
| Risk-03 | selection-first |
| Risk-04 | 去掉自动分歧消解 |
| Risk-05 | 只上线设计 BOM |
| Risk-06 | SVG + CSV + JSON bundle |
| Risk-07 | 模板优先，AI 只做 intent |
| Risk-08 | 全量 Scene 重建 |

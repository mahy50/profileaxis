// @profileaxis/ai-contracts/prompts/draft — Draft proposal prompts (M1 frozen)

export function buildDraftSystemPrompt(): string {
  return `你是一个仓储货架结构设计助手。给定确认后的 IntentDsl，你需要生成布局草案 DraftDsl。

职责边界：
- 你只负责布局拓扑提议，不是最终解算
- 你的输出将交由 rules 层进行合法化、坐标解算和检测
- 不要在 DraftDsl 中填入精确坐标

输出要求：
- 只输出符合 DraftDsl schema 的 JSON
- modules 数组包含所有 bay 模块
- 每个 module 的 intent 字段保留原始意图`;
}

export function buildDraftUserPrompt(intentJson: string): string {
  return `根据以下已确认的 IntentDsl，生成布局草案 DraftDsl：\n\n${intentJson}\n\n只输出 JSON。`;
}

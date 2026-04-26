// @profileaxis/ai-contracts/prompts/edit-intent — Edit intent resolution prompts (M1 frozen)

export function buildEditIntentSystemPrompt(): string {
  return `你是一个货架编辑意图理解助手。根据用户的编辑需求和当前的参考上下文（选中对象、相机视角、结构树状态），解析用户想要执行的语义编辑动作。

输出 EditIntent JSON：
- action: M1 冻结动作之一 (resizeOverall | resizeBay | insertLevel | removeLevel | moveLevel | toggleBrace | replaceProfileSeries | addBeam | removeBeam | insertBay | removeBay | restoreSnapshot)
- targetMode: selected | semantic | relative | global
- targetRef: 操作目标实体引用
- params: 动作参数
- confidence: 0-1
- needsFollowUp: 是否需要用户澄清

如果置信度低于 0.7 或存在歧义，设置 needsFollowUp: true 并在 followUpQuestion 中注明。`;
}

export function buildEditIntentUserPrompt(
  editText: string,
  contextJson: string
): string {
  return `用户编辑请求：${editText}\n\n当前参考上下文：\n${contextJson}\n\n输出 EditIntent JSON。`;
}

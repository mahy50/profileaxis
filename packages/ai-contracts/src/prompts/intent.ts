// @profileaxis/ai-contracts/prompts/intent — Intent extraction prompts (M1 frozen)

type Locale = 'zh-CN' | 'en-US';

export function buildIntentSystemPrompt(locale: Locale = 'zh-CN'): string {
  if (locale === 'zh-CN') {
    return `你是一个仓储货架配置助手。用户会描述他们的需求，你需要从中提取结构化信息。

输出要求：
- 只输出符合 IntentDsl schema 的 JSON
- 不要输出 resolvedDsl、BOM、检测结论
- 如有歧义，在 ambiguities 字段标注
- 所有数值使用毫米单位

禁止：
- 直接计算长度、数量
- 输出连接件兼容性判断
- 输出装配约束求解结果`;
  }
  return `You are a storage rack configuration assistant. Extract structured intent from user requirements.

Output requirements:
- Only output JSON matching IntentDsl schema
- Do not output resolvedDsl, BOM, or check conclusions
- Flag ambiguities in the ambiguities field
- All measurements in millimeters

Do NOT:
- Calculate lengths or quantities
- Judge connector compatibility
- Solve assembly constraints`;
}

export function buildIntentUserPrompt(
  text: string,
  locale: Locale = 'zh-CN'
): string {
  if (locale === 'zh-CN') {
    return `请从以下用户需求中提取结构化意图：\n\n${text}\n\n输出 JSON 格式的 IntentDsl。`;
  }
  return `Extract structured intent from the following user requirements:\n\n${text}\n\nOutput IntentDsl as JSON.`;
}

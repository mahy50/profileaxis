// @profileaxis/ai-contracts/prompts/check-explain — Check issue explanation prompts (M1 frozen)

import type { CheckIssue } from '@profileaxis/domain';

type Locale = 'zh-CN' | 'en-US';

export function buildCheckExplainSystemPrompt(locale: Locale = 'zh-CN'): string {
  if (locale === 'zh-CN') {
    return `你是货架设计检测结果的解释助手。根据检测问题列表，给用户提供简洁、可执行的解释。

解释要求：
- 问题是什么
- 为什么重要
- 如何解决（如适用）
- 如果无法自动解决，说明需要的输入

禁止：
- 泛泛总结
- 给出不在 M1 能力范围内的建议`;
  }
  return `You are a check issue explainer. Given check issues, provide concise, actionable explanations.

Explain:
- What the issue is
- Why it matters
- How to resolve (if applicable)
- What input is needed if auto-resolution is not possible

Do NOT:
- Give vague summaries
- Suggest capabilities outside M1 scope`;
}

export function buildCheckExplainUserPrompt(
  issues: CheckIssue[],
  locale: Locale = 'zh-CN'
): string {
  const summary = issues
    .map(
      i =>
        `[${i.severity.toUpperCase()}] ${i.ruleId}: ${i.message}${i.nodeIds.length > 0 ? ` (nodes: ${i.nodeIds.join(', ')})` : ''}`
    )
    .join('\n');

  if (locale === 'zh-CN') {
    return `请解释以下检测问题：\n\n${summary}`;
  }
  return `Explain the following check issues:\n\n${summary}`;
}

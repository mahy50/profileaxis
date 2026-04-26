import type {
  IntentResponse,
  DraftResponse,
  EditIntentResponse,
  CheckExplainResponse,
  AIResponse,
  AIErrorEnvelope,
} from '@profileaxis/ai-contracts';

const BASE = '/v1';

async function request<T>(path: string, body?: unknown): Promise<AIResponse<T>> {
  const res = await fetch(`${BASE}${path}`, {
    method: body ? 'POST' : 'GET',
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as AIErrorEnvelope;
    throw new Error(err.error?.message ?? `HTTP ${res.status}`);
  }
  return res.json() as Promise<AIResponse<T>>;
}

export interface VersionInfo {
  stdlibVersion: string;
  ruleVersion: string;
  promptVersion: string;
  currentCatalogVersion: string;
}

export const api = {
  getVersions(): Promise<VersionInfo> {
    return fetch(`${BASE}/runtime/versions`).then(r => r.json());
  },

  intent(text: string, locale: 'zh-CN' | 'en-US' = 'zh-CN'): Promise<IntentResponse> {
    return request('/ai/intent', { text, locale });
  },

  draft(intentDsl: unknown, confirmationDsl?: unknown): Promise<DraftResponse> {
    return request('/ai/draft', { intentDsl, confirmationDsl });
  },

  editIntent(referenceContext: unknown, editText: string): Promise<EditIntentResponse> {
    return request('/ai/edit-intent', { referenceContext, editText });
  },

  checkExplain(issues: unknown[], locale: 'zh-CN' | 'en-US' = 'zh-CN'): Promise<CheckExplainResponse> {
    return request('/ai/check-explain', { issues, locale });
  },
};

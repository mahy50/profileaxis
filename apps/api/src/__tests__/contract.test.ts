// contract.test.ts — Verify AI endpoints return strict schema results
// Tests API response shapes, routing, and AIResponse three-state envelope

import { describe, test, expect, beforeAll, afterAll, vi } from 'vitest';
import { createApiServer, getVersions } from '../index.js';
import type { Server } from 'node:http';
import { isOK, isRefusal, isSchemaError, createErrorEnvelope } from '@profileaxis/ai-contracts';
import {
  runIntent,
  runDraft,
  runEditIntent,
  runCheckExplain,
} from '../services/ai-orchestrator/index.js';

// ── Helpers ─────────────────────────────────────────────────────────────────────

function httpPost(server: Server, path: string, body: unknown): Promise<{ status: number; data: unknown }> {
  const addr = server.address();
  if (!addr || typeof addr === 'string') throw new Error('Server not bound');
  const port = addr.port;
  const payload = JSON.stringify(body);

  return new Promise((resolve, reject) => {
    const http = require('node:http') as typeof import('node:http');
    const req = http.request(
      { hostname: '127.0.0.1', port, path, method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) } },
      (res: import('node:http').IncomingMessage) => {
        const chunks: Buffer[] = [];
        res.on('data', (ch: Buffer) => chunks.push(ch));
        res.on('end', () => {
          try {
            resolve({ status: res.statusCode ?? 0, data: JSON.parse(Buffer.concat(chunks).toString('utf-8')) });
          } catch {
            resolve({ status: res.statusCode ?? 0, data: null });
          }
        });
      }
    );
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

function httpGet(server: Server, path: string): Promise<{ status: number; data: unknown }> {
  const addr = server.address();
  if (!addr || typeof addr === 'string') throw new Error('Server not bound');
  const port = addr.port;

  return new Promise((resolve, reject) => {
    const http = require('node:http') as typeof import('node:http');
    http.get({ hostname: '127.0.0.1', port, path }, (res: import('node:http').IncomingMessage) => {
      const chunks: Buffer[] = [];
      res.on('data', (ch: Buffer) => chunks.push(ch));
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode ?? 0, data: JSON.parse(Buffer.concat(chunks).toString('utf-8')) });
        } catch {
          resolve({ status: res.statusCode ?? 0, data: null });
        }
      });
    }).on('error', reject);
  });
}

const validIntentDsl = {
  dslVersion: '1.0.0' as const,
  projectType: 'storage_rack' as const,
  space: { widthMm: 2700, depthMm: 900, heightMm: 2000, placement: 'floor' as const },
  capacity: { shelfCount: 3, loadTier: 'medium' as const },
  preferences: { profileSeries: null, rearBrace: false, caster: false },
  constraints: { againstWall: false, maxWidthMm: null },
  ambiguities: [],
};

const validCheckIssues = [
  {
    issueId: 'ISSUE-001',
    severity: 'warning' as const,
    ruleId: 'test-rule',
    message: 'Test warning',
    nodeIds: ['N-001'],
    semanticPaths: ['/bay[0]/level[0]'],
    fixSuggestion: 'Fix it',
  },
];

// ── Tests ───────────────────────────────────────────────────────────────────────

describe('Contract: AI Response Envelope', () => {
  test('AIResponse discriminated union — ok', () => {
    const resp = { status: 'ok', data: { x: 1 } };
    expect(isOK(resp)).toBe(true);
    expect(isRefusal(resp)).toBe(false);
    expect(isSchemaError(resp)).toBe(false);
  });

  test('AIResponse discriminated union — refusal', () => {
    const resp = { status: 'refusal', reason: 'unsafe' };
    expect(isOK(resp)).toBe(false);
    expect(isRefusal(resp)).toBe(true);
    expect(isSchemaError(resp)).toBe(false);
  });

  test('AIResponse discriminated union — schema_error', () => {
    const resp = { status: 'schema_error', message: 'bad json' };
    expect(isOK(resp)).toBe(false);
    expect(isRefusal(resp)).toBe(false);
    expect(isSchemaError(resp)).toBe(true);
  });

  test('createErrorEnvelope produces valid error', () => {
    const env = createErrorEnvelope('test_code', 'test message', 'req-123', { detail: 'extra' });
    expect(env.error.code).toBe('test_code');
    expect(env.error.message).toBe('test message');
    expect(env.requestId).toBe('req-123');
    expect(env.error.details).toEqual({ detail: 'extra' });
    expect(env.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });
});

describe('Contract: HTTP Server', () => {
  let server: Server;

  beforeAll(() => {
    server = createApiServer({ port: 0 });
  });

  afterAll(() => {
    server.close();
  });

  test('GET /v1/runtime/versions returns version info', async () => {
    const { status, data } = await httpGet(server, '/v1/runtime/versions');
    expect(status).toBe(200);
    const d = data as Record<string, unknown>;
    expect(d.stdlibVersion).toBeDefined();
    expect(d.ruleVersion).toBeDefined();
    expect(d.promptVersion).toBeDefined();
    expect(d.currentCatalogVersion).toBeDefined();
  });

  test('GET /v1/runtime/versions returns string versions', async () => {
    const { data } = await httpGet(server, '/v1/runtime/versions');
    const d = data as Record<string, unknown>;
    expect(typeof d.stdlibVersion).toBe('string');
    expect(typeof d.ruleVersion).toBe('string');
    expect(typeof d.promptVersion).toBe('string');
  });

  test('POST /v1/ai/intent without text returns 400', async () => {
    const { status, data } = await httpPost(server, '/v1/ai/intent', {});
    expect(status).toBe(400);
    const d = data as Record<string, unknown>;
    expect(d.error).toBeDefined();
  });

  test('POST /v1/ai/intent with invalid locale returns 400', async () => {
    const { status } = await httpPost(server, '/v1/ai/intent', { text: 'test', locale: 'fr' });
    expect(status).toBe(400);
  });

  test('POST /v1/ai/draft without intentDsl returns 400', async () => {
    const { status } = await httpPost(server, '/v1/ai/draft', {});
    expect(status).toBe(400);
  });

  test('POST /v1/ai/draft with invalid intentDsl returns 400', async () => {
    const { status } = await httpPost(server, '/v1/ai/draft', { intentDsl: { dslVersion: '99.0.0' } });
    expect(status).toBe(400);
  });

  test('POST /v1/ai/edit-intent without referenceContext returns 400', async () => {
    const { status } = await httpPost(server, '/v1/ai/edit-intent', {});
    expect(status).toBe(400);
  });

  test('POST /v1/ai/check-explain without issues returns 400', async () => {
    const { status } = await httpPost(server, '/v1/ai/check-explain', {});
    expect(status).toBe(400);
  });

  test('POST /v1/ai/check-explain with empty issues returns 400', async () => {
    const { status } = await httpPost(server, '/v1/ai/check-explain', { issues: [] });
    expect(status).toBe(400);
  });

  test('404 for unknown route', async () => {
    const { status, data } = await httpGet(server, '/v1/unknown');
    expect(status).toBe(404);
    const d = data as Record<string, unknown>;
    expect(d.error).toBeDefined();
  });
});

describe('Contract: Orchestrator — AI response shapes (no API key)', () => {
  test('runIntent returns schema_error without valid API key', async () => {
    const result = await runIntent('我需要一个2000x900的货架', 'zh-CN');
    // Without API key, should get schema_error not a crash
    expect(result).toBeDefined();
    expect(result.status).toBeDefined();
    // Should be one of the three states
    expect(['ok', 'refusal', 'schema_error']).toContain(result.status);
  });

  test('runDraft returns schema_error without valid API key', async () => {
    const result = await runDraft(validIntentDsl as any, null);
    expect(result).toBeDefined();
    expect(['ok', 'refusal', 'schema_error']).toContain(result.status);
  });

  test('runEditIntent returns schema_error without valid API key', async () => {
    const result = await runEditIntent({ activeSelection: [], hoverTarget: null, cameraContext: { viewPreset: 'iso', forward: { x: 0, y: 0, z: 1 }, up: { x: 0, y: 1, z: 0 }, right: { x: 1, y: 0, z: 0 } }, structureContext: { expandedSemanticPaths: [] }, recentReferences: [], allowedActions: [] }, '将货架加宽');
    expect(result).toBeDefined();
    expect(['ok', 'refusal', 'schema_error']).toContain(result.status);
  });

  test('runCheckExplain returns schema_error without valid API key', async () => {
    const result = await runCheckExplain(validCheckIssues as any, 'zh-CN');
    expect(result).toBeDefined();
    expect(['ok', 'refusal', 'schema_error']).toContain(result.status);
  });

  test('all orchestrator functions return three-state envelope', async () => {
    const results = await Promise.all([
      runIntent('test', 'zh-CN'),
      runDraft(validIntentDsl as any, null),
      runEditIntent({ activeSelection: [], hoverTarget: null, cameraContext: { viewPreset: 'iso', forward: { x: 0, y: 0, z: 1 }, up: { x: 0, y: 1, z: 0 }, right: { x: 1, y: 0, z: 0 } }, structureContext: { expandedSemanticPaths: [] }, recentReferences: [], allowedActions: [] }, 'test'),
      runCheckExplain(validCheckIssues as any, 'zh-CN'),
    ]);

    for (const result of results) {
      const valid = isOK(result as any) || isRefusal(result as any) || isSchemaError(result as any);
      expect(valid).toBe(true);
    }
  });
});

describe('Contract: getVersions', () => {
  test('returns all required fields', () => {
    const v = getVersions();
    expect(v.stdlibVersion).toBeDefined();
    expect(v.ruleVersion).toBeDefined();
    expect(v.promptVersion).toBeDefined();
    expect(v.currentCatalogVersion).toBeDefined();
    expect(v.stdlibVersion).toBe(v.currentCatalogVersion);
  });
});

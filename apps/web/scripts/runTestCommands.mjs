#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);

// Parse --count N from CLI args
const countIdx = args.indexOf('--count');
if (countIdx >= 0 && countIdx + 1 < args.length) {
  process.env.COUNT = args[countIdx + 1];
}

const vitestArgs = ['run', 'src/__tests__/commandBus.test.ts'];
const result = spawnSync('npx', ['vitest', ...vitestArgs], {
  cwd: resolve(__dirname, '..'),
  stdio: 'inherit',
  env: process.env,
  shell: true,
});

process.exit(result.status ?? 1);

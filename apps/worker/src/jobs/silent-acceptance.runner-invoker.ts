import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import type { SilentAcceptanceProcessResult } from './silent-acceptance.job.js';

const RUNNER_ENTRY = 'src/worker/silent-acceptance.runner.ts';

export async function invokeSilentAcceptanceRunner(): Promise<SilentAcceptanceProcessResult> {
  const jobsDir = path.dirname(fileURLToPath(import.meta.url));
  const apiRoot = path.resolve(jobsDir, '../../../api');
  const runnerPath = path.join(apiRoot, RUNNER_ENTRY);

  return new Promise((resolve, reject) => {
    const child = spawn('pnpm', ['exec', 'tsx', runnerPath], {
      cwd: apiRoot,
      env: process.env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (chunk: Buffer) => {
      stdout += chunk.toString();
    });

    child.stderr.on('data', (chunk: Buffer) => {
      stderr += chunk.toString();
    });

    child.on('error', reject);

    child.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(stderr || `Silent acceptance runner exited with code ${String(code)}`));
        return;
      }

      const line = stdout
        .trim()
        .split('\n')
        .map((entry) => entry.trim())
        .find((entry) => entry.startsWith('{'));

      if (!line) {
        reject(new Error('Silent acceptance runner did not emit JSON result'));
        return;
      }

      resolve(JSON.parse(line) as SilentAcceptanceProcessResult);
    });
  });
}

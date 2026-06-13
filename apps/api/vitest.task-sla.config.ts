import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: [
      'src/modules/task/**/*.spec.ts',
      'src/modules/task/**/*.integration.spec.ts',
      'src/modules/task/**/*.db.integration.spec.ts',
      'src/modules/decision/**/*.spec.ts',
      'src/modules/decision/**/*.integration.spec.ts',
      'src/modules/decision/**/*.db.integration.spec.ts',
    ],
    passWithNoTests: false,
    hookTimeout: 120_000,
    testTimeout: 60_000,
    fileParallelism: false,
    coverage: {
      provider: 'v8',
      include: [
        'src/modules/task/**/*.ts',
        'src/modules/decision/**/*.ts',
        'src/worker/silent-acceptance.runner.ts',
      ],
      exclude: [
        'src/modules/task/**/*.spec.ts',
        'src/modules/task/**/*.integration.spec.ts',
        'src/modules/task/**/*.db.integration.spec.ts',
        'src/modules/task/**/__tests__/**',
        'src/modules/task/task.module.ts',
        'src/modules/decision/**/*.spec.ts',
        'src/modules/decision/**/*.integration.spec.ts',
        'src/modules/decision/**/*.db.integration.spec.ts',
        'src/modules/decision/**/__tests__/**',
        'src/modules/decision/decision.module.ts',
        'src/worker/silent-acceptance.runner.ts',
      ],
      thresholds: {
        lines: 90,
        branches: 70,
        functions: 90,
        statements: 90,
      },
    },
  },
});

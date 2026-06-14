import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: [
      'src/modules/document/**/*.spec.ts',
      'src/modules/document/**/*.integration.spec.ts',
      'src/modules/document/**/*.db.integration.spec.ts',
    ],
    passWithNoTests: false,
    hookTimeout: 120_000,
    testTimeout: 60_000,
    fileParallelism: false,
    coverage: {
      provider: 'v8',
      include: ['src/modules/document/**/*.ts'],
      exclude: [
        'src/modules/document/**/*.spec.ts',
        'src/modules/document/**/*.integration.spec.ts',
        'src/modules/document/**/*.db.integration.spec.ts',
        'src/modules/document/**/__tests__/**',
        'src/modules/document/document.module.ts',
        'src/modules/document/document.controller.ts',
      ],
      thresholds: {
        lines: 90,
        branches: 85,
        functions: 90,
        statements: 90,
      },
    },
  },
});

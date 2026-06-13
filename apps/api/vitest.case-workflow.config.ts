import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: [
      'src/modules/case-management/**/*.spec.ts',
      'src/modules/case-management/**/*.integration.spec.ts',
      'src/modules/case-management/**/*.db.integration.spec.ts',
    ],
    passWithNoTests: false,
    hookTimeout: 120_000,
    testTimeout: 60_000,
    fileParallelism: false,
    coverage: {
      provider: 'v8',
      include: ['src/modules/case-management/**/*.ts'],
      exclude: [
        'src/modules/case-management/**/*.spec.ts',
        'src/modules/case-management/**/*.integration.spec.ts',
        'src/modules/case-management/**/*.db.integration.spec.ts',
        'src/modules/case-management/**/__tests__/**',
        'src/modules/case-management/case-management.module.ts',
        'src/modules/case-management/transition/transition.types.ts',
        // AES decrypt path — plaintext branch integration testlerde; encrypted path Faz 7
        'src/modules/case-management/case-report-decrypt.service.ts',
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

import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: [
      'src/authorization/**/*.spec.ts',
      'src/authorization/**/*.integration.spec.ts',
      'src/authorization/**/*.db.integration.spec.ts',
      'src/common/guards/__tests__/policy.guard.spec.ts',
    ],
    passWithNoTests: false,
    hookTimeout: 120_000,
    testTimeout: 60_000,
    fileParallelism: false,
    coverage: {
      provider: 'v8',
      include: ['src/authorization/**/*.ts', 'src/common/guards/policy.guard.ts'],
      exclude: [
        'src/**/*.spec.ts',
        'src/**/*.integration.spec.ts',
        'src/**/*.db.integration.spec.ts',
        'src/**/__tests__/**',
        'src/authorization/**/*.types.ts',
        'src/authorization/authorization.module.ts',
        'src/authorization/**/*constants.ts',
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

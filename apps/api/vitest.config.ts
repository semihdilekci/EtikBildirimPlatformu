import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: [
      'src/**/*.spec.ts',
      'src/**/*.integration.spec.ts',
      'src/**/*.db.integration.spec.ts',
    ],
    passWithNoTests: false,
    hookTimeout: 120_000,
    testTimeout: 60_000,
    fileParallelism: false,
    coverage: {
      provider: 'v8',
      include: ['src/modules/auth/**/*.ts'],
      exclude: [
        'src/modules/auth/**/*.spec.ts',
        'src/modules/auth/**/*.integration.spec.ts',
        'src/modules/auth/**/__tests__/**',
        'src/modules/auth/auth.module.ts',
        'src/modules/auth/types/**',
        'src/modules/auth/session/pg-session.store.ts',
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

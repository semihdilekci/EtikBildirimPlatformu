import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: [
      'src/modules/intake/**/*.spec.ts',
      'src/modules/intake/**/*.integration.spec.ts',
      'src/modules/intake/**/*.db.integration.spec.ts',
      'src/modules/tracking/**/*.spec.ts',
      'src/modules/tracking/**/*.integration.spec.ts',
      'src/modules/tracking/**/*.db.integration.spec.ts',
    ],
    passWithNoTests: false,
    hookTimeout: 120_000,
    testTimeout: 60_000,
    fileParallelism: false,
    coverage: {
      provider: 'v8',
      include: ['src/modules/intake/**/*.ts', 'src/modules/tracking/**/*.ts'],
      exclude: [
        'src/modules/intake/**/*.spec.ts',
        'src/modules/intake/**/*.integration.spec.ts',
        'src/modules/intake/**/*.db.integration.spec.ts',
        'src/modules/intake/**/__tests__/**',
        'src/modules/intake/intake.module.ts',
        'src/modules/intake/intake.types.ts',
        'src/modules/tracking/**/*.spec.ts',
        'src/modules/tracking/**/*.integration.spec.ts',
        'src/modules/tracking/**/*.db.integration.spec.ts',
        'src/modules/tracking/**/__tests__/**',
        'src/modules/tracking/tracking.module.ts',
        'src/modules/tracking/tracking.types.ts',
      ],
      thresholds: {
        lines: 80,
        branches: 70,
        functions: 80,
        statements: 80,
      },
    },
  },
});

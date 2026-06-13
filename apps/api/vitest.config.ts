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
      include: [
        'src/crypto/**/*.ts',
        'src/audit/**/*.ts',
        'src/common/interceptors/audit.interceptor.ts',
        'src/common/decorators/audit-action.decorator.ts',
        'src/common/constants/audit-action.metadata.ts',
        'src/modules/dev-crypto-audit/**/*.ts',
      ],
      exclude: [
        'src/**/*.spec.ts',
        'src/**/*.integration.spec.ts',
        'src/**/*.db.integration.spec.ts',
        'src/**/__tests__/**',
        'src/crypto/**/*.spec.ts',
        'src/crypto/**/__tests__/**',
        'src/crypto/crypto.module.ts',
        'src/audit/**/*.spec.ts',
        'src/audit/**/__tests__/**',
        'src/audit/audit.module.ts',
        'src/modules/dev-crypto-audit/**/*.spec.ts',
        'src/modules/dev-crypto-audit/**/__tests__/**',
        'src/modules/dev-crypto-audit/dev-crypto-audit.module.ts',
        'src/modules/dev-crypto-audit/dto/**',
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

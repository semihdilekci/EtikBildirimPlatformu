import eslintConfig from '@ethics/eslint-config';

export default [
  ...eslintConfig,
  {
    files: ['apps/api/**/*.module.ts', 'apps/api/src/app.module.ts'],
    rules: {
      '@typescript-eslint/no-extraneous-class': 'off',
    },
  },
  {
    files: [
      'apps/api/**/*.{spec,integration.spec,db.integration.spec}.ts',
      'apps/api/vitest.config.ts',
      'packages/policy/**/*.spec.ts',
      'packages/policy/vitest.config.ts',
    ],
    rules: {
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-argument': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-return': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/unbound-method': 'off',
      '@typescript-eslint/no-confusing-void-expression': 'off',
    },
  },
];

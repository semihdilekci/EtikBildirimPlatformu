import eslintConfig from '@ethics/eslint-config';

export default [
  ...eslintConfig,
  {
    ignores: ['vitest.config.ts'],
  },
  {
    languageOptions: {
      parserOptions: {
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  {
    files: ['src/main.ts', 'src/jobs/audit-chain-verify.job.ts'],
    rules: {
      'no-console': 'off',
    },
  },
  {
    files: ['**/*.{spec,integration.spec}.ts', 'vitest.config.ts'],
    rules: {
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-argument': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-return': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/require-await': 'off',
    },
  },
];

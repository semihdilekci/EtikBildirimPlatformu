import eslintConfig from '@ethics/eslint-config';

export default [
  ...eslintConfig,
  {
    ignores: ['vitest.config.ts', 'vitest.config.js', 'vitest.config.d.ts', 'vitest.config.*.map'],
  },
  {
    languageOptions: {
      parserOptions: {
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
];

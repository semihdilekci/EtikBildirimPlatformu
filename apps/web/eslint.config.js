import eslintConfig from '@ethics/eslint-config';

export default [
  ...eslintConfig,
  {
    ignores: ['vite.config.ts', 'vitest.config.ts'],
  },
  {
    languageOptions: {
      parserOptions: {
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
];

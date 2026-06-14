import eslintConfig from '@ethics/eslint-config';

export default [
  ...eslintConfig,
  {
    ignores: ['vite.config.ts', 'vitest.config.ts', 'src/test/jest-dom.d.ts'],
  },
  {
    languageOptions: {
      parserOptions: {
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
];

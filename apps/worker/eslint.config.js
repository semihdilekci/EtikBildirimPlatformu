import eslintConfig from '@ethics/eslint-config';

export default [
  ...eslintConfig,
  {
    languageOptions: {
      parserOptions: {
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
];

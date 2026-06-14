import type { TestingLibraryMatchers } from '@testing-library/jest-dom/matchers';

declare module 'vitest' {
  // Module augmentation — jest-dom matcher'ları Vitest expect'e genişletir.
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type -- intentional augmentation
  interface Assertion<T = unknown> extends TestingLibraryMatchers<unknown, T> {}
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type -- intentional augmentation
  interface AsymmetricMatchersContaining extends TestingLibraryMatchers<unknown, unknown> {}
}

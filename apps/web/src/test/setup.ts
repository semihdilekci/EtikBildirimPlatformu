import '@testing-library/jest-dom/vitest';

import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

import { useAuthStore } from '@/stores/useAuthStore';

afterEach(() => {
  cleanup();
  useAuthStore.getState().clear();
});

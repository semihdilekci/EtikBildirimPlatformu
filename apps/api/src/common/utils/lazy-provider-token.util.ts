import { createRequire } from 'node:module';
import type { Type } from '@nestjs/common';

const nodeRequire = createRequire(import.meta.url);

export function lazyProviderToken<T>(modulePath: string, exportName: string): Type<T> {
  const moduleExports = nodeRequire(modulePath) as Record<string, Type<T>>;
  const provider = moduleExports[exportName];
  if (provider === undefined) {
    throw new Error(`Provider export "${exportName}" missing in ${modulePath}`);
  }
  return provider;
}

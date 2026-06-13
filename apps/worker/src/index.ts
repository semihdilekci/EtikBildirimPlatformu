import { PLATFORM_NAME } from '@ethics/shared';

/** Background job worker — Faz 1+ */
export function main(): void {
  if (process.env['NODE_ENV'] !== 'production') {
    console.warn(`[@ethics/worker] placeholder — ${PLATFORM_NAME}`);
  }
}

main();

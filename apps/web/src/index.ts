import { PLATFORM_NAME } from '@ethics/shared';

/** React + Vite bootstrap — Faz 1 */
export function main(): void {
  if (process.env['NODE_ENV'] !== 'production') {
    console.warn(`[@ethics/web] placeholder — ${PLATFORM_NAME}`);
  }
}

main();

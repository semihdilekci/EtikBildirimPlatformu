import { PLATFORM_NAME } from '@ethics/shared';

/** NestJS bootstrap — Faz 1 */
export function main(): void {
  // Placeholder entrypoint; real server starts in Faz 1
  if (process.env['NODE_ENV'] !== 'production') {
    console.warn(`[@ethics/api] placeholder — ${PLATFORM_NAME}`);
  }
}

main();

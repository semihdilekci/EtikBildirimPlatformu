import { Inject, Injectable } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';

import { RedactionService } from './redaction.service.js';

type LogContext = Record<string, unknown>;

@Injectable()
export class SafeLoggerService {
  constructor(
    @InjectPinoLogger(SafeLoggerService.name) private readonly pino: PinoLogger,
    @Inject(RedactionService) private readonly redactionService: RedactionService,
  ) {}

  debug(context: LogContext, message: string): void {
    this.pino.debug(this.sanitizeContext(context), message);
  }

  info(context: LogContext, message: string): void {
    this.pino.info(this.sanitizeContext(context), message);
  }

  warn(context: LogContext, message: string): void {
    this.pino.warn(this.sanitizeContext(context), message);
  }

  error(context: LogContext, message: string): void {
    this.pino.error(this.sanitizeContext(context), message);
  }

  fatal(context: LogContext, message: string): void {
    this.pino.fatal(this.sanitizeContext(context), message);
  }

  private sanitizeContext(context: LogContext): LogContext {
    const redacted = this.redactionService.redactForLog(context);
    if (typeof redacted === 'object' && redacted !== null && !Array.isArray(redacted)) {
      return redacted as LogContext;
    }
    return { value: redacted };
  }
}

import { HttpStatus, PipeTransform } from '@nestjs/common';
import { ErrorCode } from '@ethics/shared';
import type { ZodSchema } from 'zod';

import { DomainException } from '../exceptions/domain.exception.js';

export class ZodValidationPipe<T> implements PipeTransform {
  constructor(private readonly schema: ZodSchema<T>) {}

  transform(value: unknown): T {
    const result = this.schema.safeParse(value);

    if (!result.success) {
      throw new DomainException(
        ErrorCode.VALIDATION_FAILED,
        'İstek doğrulaması başarısız.',
        HttpStatus.BAD_REQUEST,
      );
    }

    return result.data;
  }
}

export function createZodValidationPipe<T>(schema: ZodSchema<T>): ZodValidationPipe<T> {
  return new ZodValidationPipe(schema);
}

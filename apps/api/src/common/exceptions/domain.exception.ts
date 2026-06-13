import { HttpException, HttpStatus } from '@nestjs/common';

import { type ErrorCodeValue } from '@ethics/shared';

export class DomainException extends HttpException {
  readonly code: ErrorCodeValue;

  constructor(code: ErrorCodeValue, message: string, status: HttpStatus = HttpStatus.BAD_REQUEST) {
    super({ code, message }, status);
    this.code = code;
  }
}

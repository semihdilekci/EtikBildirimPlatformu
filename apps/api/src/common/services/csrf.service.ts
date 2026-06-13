import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

import { Inject, Injectable } from '@nestjs/common';

import { EnvService } from '../config/env.service.js';

const TOKEN_BYTES = 32;

@Injectable()
export class CsrfService {
  constructor(@Inject(EnvService) private readonly envService: EnvService) {}

  generateToken(): string {
    const nonce = randomBytes(TOKEN_BYTES).toString('base64url');
    const signature = this.sign(nonce);
    return `${nonce}.${signature}`;
  }

  isValidToken(token: string | undefined): token is string {
    if (!token || typeof token !== 'string') {
      return false;
    }

    const separatorIndex = token.lastIndexOf('.');
    if (separatorIndex <= 0) {
      return false;
    }

    const nonce = token.slice(0, separatorIndex);
    const signature = token.slice(separatorIndex + 1);
    const expectedSignature = this.sign(nonce);

    if (signature.length !== expectedSignature.length) {
      return false;
    }

    return timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature));
  }

  tokensMatch(cookieToken: string | undefined, headerToken: string | undefined): boolean {
    if (!cookieToken || !headerToken) {
      return false;
    }

    if (cookieToken.length !== headerToken.length) {
      return false;
    }

    if (!this.isValidToken(cookieToken) || !this.isValidToken(headerToken)) {
      return false;
    }

    return timingSafeEqual(Buffer.from(cookieToken), Buffer.from(headerToken));
  }

  private sign(nonce: string): string {
    return createHmac('sha256', this.envService.csrfSecret).update(nonce).digest('base64url');
  }
}

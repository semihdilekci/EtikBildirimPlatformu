import type { NextFunction, Request, Response } from 'express';

import { CSRF_COOKIE_NAME } from '../constants/csrf.constants.js';
import type { CsrfService } from '../services/csrf.service.js';
import type { EnvService } from '../config/env.service.js';

export function createCsrfMiddleware(csrfService: CsrfService, envService: EnvService) {
  return (request: Request, response: Response, next: NextFunction): void => {
    const existingToken = request.cookies[CSRF_COOKIE_NAME] as string | undefined;

    if (!csrfService.isValidToken(existingToken)) {
      const token = csrfService.generateToken();
      response.cookie(CSRF_COOKIE_NAME, token, {
        httpOnly: false,
        secure: envService.isProduction,
        sameSite: 'strict',
        path: '/',
      });
    }

    next();
  };
}

import { Injectable } from '@nestjs/common';
import { PassportSerializer } from '@nestjs/passport';

import type { SessionUserPayload } from '../../../common/types/authenticated-user.type.js';

@Injectable()
export class AuthSessionSerializer extends PassportSerializer {
  serializeUser(
    user: SessionUserPayload,
    done: (error: Error | null, payload?: SessionUserPayload) => void,
  ): void {
    done(null, user);
  }

  deserializeUser(
    payload: SessionUserPayload,
    done: (error: Error | null, user?: SessionUserPayload) => void,
  ): void {
    done(null, payload);
  }
}

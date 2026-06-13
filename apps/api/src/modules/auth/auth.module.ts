import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';

import { EnvModule } from '../../common/config/env.module.js';
import { PrismaModule } from '../../prisma/prisma.module.js';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { SessionAuthGuard } from './guards/session-auth.guard.js';
import { LoginAttemptService } from './login-attempt.service.js';
import { AuthSessionSerializer } from './session/auth-session.serializer.js';
import { OidcStrategy } from './strategies/oidc.strategy.js';

@Module({
  imports: [
    EnvModule,
    PrismaModule,
    PassportModule.register({
      session: true,
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    LoginAttemptService,
    OidcStrategy,
    AuthSessionSerializer,
    SessionAuthGuard,
  ],
  exports: [AuthService, LoginAttemptService, SessionAuthGuard],
})
export class AuthModule {}

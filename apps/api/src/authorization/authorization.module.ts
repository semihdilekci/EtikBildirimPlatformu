import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';

import { AuthModule } from '../modules/auth/auth.module.js';
import { SessionAuthGuard } from '../modules/auth/guards/session-auth.guard.js';
import { PolicyGuard } from '../common/guards/policy.guard.js';
import { PrismaModule } from '../prisma/prisma.module.js';
import { DocumentPolicyService } from './document-policy.service.js';
import { FieldMaskingService } from './field-masking.service.js';
import { FieldVisibilityPolicyService } from './field-visibility-policy.service.js';
import { PolicyGuardService } from './policy-guard.service.js';
import { PolicyScopeService } from './policy-scope.service.js';

@Module({
  imports: [AuthModule, PrismaModule],
  providers: [
    PolicyGuardService,
    PolicyScopeService,
    FieldVisibilityPolicyService,
    FieldMaskingService,
    DocumentPolicyService,
    PolicyGuard,
    {
      provide: APP_GUARD,
      useExisting: SessionAuthGuard,
    },
    {
      provide: APP_GUARD,
      useExisting: PolicyGuard,
    },
  ],
  exports: [
    PolicyGuardService,
    PolicyScopeService,
    FieldVisibilityPolicyService,
    FieldMaskingService,
    DocumentPolicyService,
  ],
})
export class AuthorizationModule {}

import { Controller, Get, Inject, Query } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { PermissionCode } from '@ethics/policy';
import {
  listAdminDocumentOperationsQuerySchema,
  type ListAdminDocumentOperationsQuery,
} from '@ethics/dto';
import type { ZodSchema } from 'zod';

import { RequirePolicy } from '../../../common/decorators/require-policy.decorator.js';
import { createZodValidationPipe } from '../../../common/pipes/zod-validation.pipe.js';
import { DocumentOpsAdminService } from './document-ops-admin.service.js';

const ADMIN_READ_RATE_LIMIT = { limit: 60, ttl: 60_000 } as const;

@Controller('admin/document-operations')
export class DocumentOpsAdminController {
  constructor(
    @Inject(DocumentOpsAdminService)
    private readonly documentOpsAdminService: DocumentOpsAdminService,
  ) {}

  @RequirePolicy(PermissionCode.ADMIN_VIEW_SYNC_STATUS)
  @Throttle({ default: ADMIN_READ_RATE_LIMIT })
  @Get()
  async listDocumentOperations(
    @Query(
      createZodValidationPipe(
        listAdminDocumentOperationsQuerySchema as ZodSchema<ListAdminDocumentOperationsQuery>,
      ),
    )
    query: ListAdminDocumentOperationsQuery,
  ) {
    const data = await this.documentOpsAdminService.listDocumentOperations(query);
    return { data };
  }
}

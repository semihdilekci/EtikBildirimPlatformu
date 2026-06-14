import { randomUUID } from 'node:crypto';

import { Inject, Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import {
  DocumentCategory,
  DocumentGrantScope,
  WorkflowCommand,
  type DocumentCategoryCode,
  type DocumentGrantScopeCode,
  type Role as RoleCode,
  type WorkflowCommandCode,
} from '@ethics/shared';

import type { AuthenticatedUser } from '../../common/types/authenticated-user.type.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import type { CreatedTransitionRecord } from '../case-management/transition/transition.types.js';

/** Raportör atamasında erişilebilir doküman kategorileri — Docs/07 §3.6 */
const RAPPORTEUR_GRANT_CATEGORIES: readonly DocumentCategoryCode[] = [
  DocumentCategory.INCOMING_REPORT_ATTACHMENT,
  DocumentCategory.PRE_RESEARCH_NOTE,
  DocumentCategory.COMPANY_EVIDENCE,
  DocumentCategory.DISCIPLINARY_DOCUMENT,
  DocumentCategory.RAPPORTEUR_REPORT,
  DocumentCategory.COUNCIL_AGENDA_PACK,
];

/** Aksiyon sahibi atamasında erişilebilir doküman kategorileri — Docs/07 §3.6 */
const ACTION_OWNER_GRANT_CATEGORIES: readonly DocumentCategoryCode[] = [
  DocumentCategory.IMPLEMENTATION_LETTER,
  DocumentCategory.ACTION_RESPONSE,
];

export type CreateDocumentGrantInput = {
  documentId: string;
  grantScope?: DocumentGrantScopeCode;
  grantedByTransitionId?: string;
  grantedToUserId?: string;
  grantedToRole?: RoleCode;
};

@Injectable()
export class DocumentAccessService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async grantUploaderAccess(
    tx: Prisma.TransactionClient,
    documentId: string,
    uploaderUserId: string,
  ): Promise<void> {
    await this.createUserGrant(tx, {
      documentId,
      grantedToUserId: uploaderUserId,
      grantScope: DocumentGrantScope.FULL_ACCESS,
    });
  }

  async applyTransitionGrants(
    tx: Prisma.TransactionClient,
    caseId: string,
    transition: CreatedTransitionRecord & { performedByUserId?: string | null },
    metadata?: Record<string, unknown>,
  ): Promise<void> {
    const linkedDocuments = await tx.document.findMany({
      where: { transitionId: transition.id },
      select: { id: true },
    });

    for (const document of linkedDocuments) {
      if (transition.performedByUserId) {
        await this.createUserGrant(tx, {
          documentId: document.id,
          grantedToUserId: transition.performedByUserId,
          grantScope: DocumentGrantScope.FULL_ACCESS,
          grantedByTransitionId: transition.id,
        });
      }
    }

    const command = transition.command as WorkflowCommandCode;

    if (command === WorkflowCommand.ASSIGN_RAPPORTEUR) {
      const rapporteurUserId = metadata?.rapporteurUserId;
      if (typeof rapporteurUserId === 'string') {
        await this.grantCaseDocumentsToUser(tx, {
          caseId,
          userId: rapporteurUserId,
          categories: RAPPORTEUR_GRANT_CATEGORIES,
          grantedByTransitionId: transition.id,
        });
      }
      return;
    }

    if (
      command === WorkflowCommand.ASSIGN_ACTION ||
      command === WorkflowCommand.FOLLOW_UP_REASSIGN
    ) {
      const actionOwnerUserId = metadata?.actionOwnerUserId;
      if (typeof actionOwnerUserId === 'string') {
        await this.grantCaseDocumentsToUser(tx, {
          caseId,
          userId: actionOwnerUserId,
          categories: ACTION_OWNER_GRANT_CATEGORIES,
          grantedByTransitionId: transition.id,
        });
      }
    }
  }

  async createUserGrant(
    tx: Prisma.TransactionClient,
    input: CreateDocumentGrantInput & { grantedToUserId: string },
  ): Promise<void> {
    const existing = await tx.documentAccessGrant.findFirst({
      where: {
        documentId: input.documentId,
        grantedToUserId: input.grantedToUserId,
        revokedAt: null,
      },
      select: { id: true },
    });

    if (existing) {
      return;
    }

    await tx.documentAccessGrant.create({
      data: {
        id: randomUUID(),
        documentId: input.documentId,
        grantedToUserId: input.grantedToUserId,
        grantScope: input.grantScope ?? DocumentGrantScope.FULL_ACCESS,
        grantedByTransitionId: input.grantedByTransitionId ?? null,
      },
    });
  }

  async createRoleGrant(
    tx: Prisma.TransactionClient,
    input: CreateDocumentGrantInput & { grantedToRole: RoleCode },
  ): Promise<void> {
    const existing = await tx.documentAccessGrant.findFirst({
      where: {
        documentId: input.documentId,
        grantedToRole: input.grantedToRole,
        revokedAt: null,
      },
      select: { id: true },
    });

    if (existing) {
      return;
    }

    await tx.documentAccessGrant.create({
      data: {
        id: randomUUID(),
        documentId: input.documentId,
        grantedToRole: input.grantedToRole,
        grantScope: input.grantScope ?? DocumentGrantScope.FULL_ACCESS,
        grantedByTransitionId: input.grantedByTransitionId ?? null,
      },
    });
  }

  async revokeGrant(tx: Prisma.TransactionClient, grantId: string): Promise<void> {
    await tx.documentAccessGrant.updateMany({
      where: { id: grantId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async hasActiveGrant(
    user: AuthenticatedUser,
    documentId: string,
    requiredScope: DocumentGrantScopeCode,
  ): Promise<boolean> {
    const grant = await this.prisma.documentAccessGrant.findFirst({
      where: {
        documentId,
        revokedAt: null,
        OR: [
          { grantedToUserId: user.id },
          ...(user.roles.length > 0 ? [{ grantedToRole: { in: [...user.roles] } }] : []),
        ],
      },
      select: { grantScope: true },
    });

    if (!grant) {
      return false;
    }

    if (requiredScope === DocumentGrantScope.METADATA_ONLY) {
      return (
        grant.grantScope === DocumentGrantScope.METADATA_ONLY ||
        grant.grantScope === DocumentGrantScope.FULL_ACCESS
      );
    }

    return grant.grantScope === DocumentGrantScope.FULL_ACCESS;
  }

  private async grantCaseDocumentsToUser(
    tx: Prisma.TransactionClient,
    params: {
      caseId: string;
      userId: string;
      categories: readonly DocumentCategoryCode[];
      grantedByTransitionId: string;
    },
  ): Promise<void> {
    const documents = await tx.document.findMany({
      where: {
        caseId: params.caseId,
        documentCategory: { in: [...params.categories] },
      },
      select: { id: true },
    });

    for (const document of documents) {
      await this.createUserGrant(tx, {
        documentId: document.id,
        grantedToUserId: params.userId,
        grantScope: DocumentGrantScope.FULL_ACCESS,
        grantedByTransitionId: params.grantedByTransitionId,
      });
    }
  }
}

import { HttpStatus, Injectable } from '@nestjs/common';
import { AuditActorType, ErrorCode, WorkflowCommand } from '@ethics/shared';
import { isClearanceSufficient } from '@ethics/policy';
import type { ClearanceLevel } from '@ethics/shared';

import { DomainException } from '../../../common/exceptions/domain.exception.js';
import type { TransitionValidationContext } from './transition.types.js';

const CUID_PATTERN = /^c[a-z0-9]{24}$/i;

@Injectable()
export class TransitionValidators {
  validate(context: TransitionValidationContext): void {
    this.validateClearance(context);
    this.validateRole(context);
    this.validateAssignment(context);
    this.validateReason(context);
    this.validatePreconditions(context);
  }

  private validateClearance(context: TransitionValidationContext): void {
    if (context.definition.isSystemCommand || this.isSystemActorAllowed(context)) {
      return;
    }

    const caseClearance = context.caseEntity.confidentialityLevel as ClearanceLevel;

    if (!isClearanceSufficient(context.actor.clearanceLevel, caseClearance)) {
      throw new DomainException(
        ErrorCode.AUTHZ_FORBIDDEN,
        'Bu vaka için yeterli gizlilik yetkiniz yok.',
        HttpStatus.FORBIDDEN,
      );
    }
  }

  private validateRole(context: TransitionValidationContext): void {
    const { definition, actor } = context;

    if (definition.isSystemCommand || this.isSystemActorAllowed(context)) {
      return;
    }

    const requiredRoles = definition.requiredRoles;
    if (!requiredRoles || requiredRoles.length === 0) {
      return;
    }

    const hasRole = requiredRoles.some((role) => actor.roles.includes(role));
    if (!hasRole) {
      throw new DomainException(
        ErrorCode.AUTHZ_FORBIDDEN,
        'Bu geçiş için gerekli rol yetkiniz yok.',
        HttpStatus.FORBIDDEN,
      );
    }
  }

  private validateAssignment(context: TransitionValidationContext): void {
    const { definition, actor, caseEntity } = context;

    if (!definition.requiresAssignment || !actor.userId) {
      return;
    }

    if (definition.requiresAssignment === 'rapporteur') {
      if (caseEntity.assignedRapporteurId !== actor.userId) {
        throw new DomainException(
          ErrorCode.AUTHZ_FORBIDDEN,
          'Bu vaka size atanmış raportör vakası değil.',
          HttpStatus.FORBIDDEN,
        );
      }
      return;
    }

    if (caseEntity.assignedActionOwnerId !== actor.userId) {
      throw new DomainException(
        ErrorCode.AUTHZ_FORBIDDEN,
        'Bu vaka size atanmış aksiyon sahibi vakası değil.',
        HttpStatus.FORBIDDEN,
      );
    }
  }

  private validateReason(context: TransitionValidationContext): void {
    if (!context.definition.requiresReason) {
      return;
    }

    const reason = context.reason?.trim();
    if (!reason) {
      throw new DomainException(
        ErrorCode.VALIDATION_FAILED,
        'Bu geçiş için gerekçe zorunludur.',
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  private validatePreconditions(context: TransitionValidationContext): void {
    switch (context.command) {
      case WorkflowCommand.ASSIGN_RAPPORTEUR:
        this.requireMetadataUserId(context.metadata, 'rapporteurUserId');
        return;
      case WorkflowCommand.SUBMIT_RAPPORTEUR_REPORT:
        // Faz 7'de doküman tablosu kontrolü; şimdilik metadata ile stub.
        this.requireMetadataUserId(context.metadata, 'rapporteurReportDocumentId');
        return;
      case WorkflowCommand.ASSIGN_ACTION:
      case WorkflowCommand.FOLLOW_UP_REASSIGN:
        this.requireMetadataUserId(context.metadata, 'actionOwnerUserId');
        return;
      case WorkflowCommand.MEMBER_OBJECTION:
        this.requireMetadataString(context.metadata, 'objectionSummary');
        return;
      case WorkflowCommand.SUBMIT_TO_BOARD_REVIEW:
        this.requireMetadataUserId(context.metadata, 'decisionDocumentId');
        return;
      default:
        return;
    }
  }

  private requireMetadataUserId(
    metadata: Record<string, unknown> | undefined,
    field: string,
  ): string {
    const value = this.requireMetadataString(metadata, field);
    if (!CUID_PATTERN.test(value) && !this.isUuidV4(value)) {
      throw new DomainException(
        ErrorCode.VALIDATION_FAILED,
        `${field} geçerli bir kullanıcı veya kayıt kimliği olmalıdır.`,
        HttpStatus.BAD_REQUEST,
      );
    }

    return value;
  }

  private isUuidV4(value: string): boolean {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
  }

  private requireMetadataString(
    metadata: Record<string, unknown> | undefined,
    field: string,
  ): string {
    const value = metadata?.[field];
    if (typeof value !== 'string' || value.trim().length === 0) {
      throw new DomainException(
        ErrorCode.VALIDATION_FAILED,
        `${field} zorunludur.`,
        HttpStatus.BAD_REQUEST,
      );
    }

    return value.trim();
  }

  private requireMetadataBoolean(
    metadata: Record<string, unknown> | undefined,
    field: string,
  ): void {
    const value = metadata?.[field];
    if (value !== true) {
      throw new DomainException(
        ErrorCode.CASE_PRECONDITION_FAILED,
        `${field} koşulu sağlanmadı.`,
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    }
  }

  private isSystemActorAllowed(context: TransitionValidationContext): boolean {
    return (
      context.actor.type === AuditActorType.SYSTEM && context.definition.systemAllowed === true
    );
  }
}

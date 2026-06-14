import { randomUUID } from 'node:crypto';

import {
  DocumentCategory,
  DocumentGrantScope,
  Role,
  WorkflowCommand,
  AuditActorType,
} from '@ethics/shared';
import { beforeAll, afterAll, describe, expect, it } from 'vitest';

import {
  createPostgresTestEnvironment,
  type PostgresTestEnvironment,
} from '../../../test/postgres-test-environment.js';
import { seedSyntheticCompany } from '@ethics/test-fixtures';
import { DocumentAccessService } from '../document-access.service.js';

describe('DocumentAccessService (Testcontainers)', () => {
  let environment: PostgresTestEnvironment;
  let service: DocumentAccessService;
  let documentId: string;
  let userId: string;

  beforeAll(async () => {
    environment = await createPostgresTestEnvironment();
    service = new DocumentAccessService(environment.prisma as never);

    userId = randomUUID();
    documentId = randomUUID();
    const caseId = randomUUID();
    const reportId = randomUUID();
    const companyId = await seedSyntheticCompany(environment.prisma);

    await environment.prisma.user.create({
      data: {
        id: userId,
        email: `grant-test-${userId}@ethics.local`,
        displayName: 'Grant Test User',
        clearanceLevel: 'SENSITIVE',
      },
    });

    await environment.prisma.report.create({
      data: {
        id: reportId,
        trackingCode: 'ETK-GRANT01',
        trackingCodePasswordHash: '$argon2id$v=19$m=65536,t=3,p=1$c2FsdHNhbHQ$hash',
        incidentCountry: 'TUR',
        incidentCity: 'İstanbul',
        companyId,
        categoryGroup: 'asset_financial',
        categories: ['embezzlement'],
        incidentDescription: 'ciphertext',
        encryptionMetadata: {},
        status: 'submitted',
        confidentialityLevel: 'SENSITIVE',
        channel: 'web_form',
        kvkkConsentVersion: '1.0',
        kvkkConsentAt: new Date(),
        submittedAt: new Date(),
      },
    });

    await environment.prisma.case.create({
      data: {
        id: caseId,
        reportId,
        currentState: 'report_submitted',
        workflowVersion: '1.0.0',
        confidentialityLevel: 'SENSITIVE',
        companyId,
        createdBy: userId,
      },
    });

    await environment.prisma.document.create({
      data: {
        id: documentId,
        caseId,
        reportId,
        documentCategory: DocumentCategory.PRE_RESEARCH_NOTE,
        title: 'Grant Test Doc',
        confidentialityLevel: 'SENSITIVE',
        uploadedByUserId: userId,
      },
    });
  }, 120_000);

  afterAll(async () => {
    await environment.teardown();
  }, 30_000);

  it('createUserGrant aktif grant oluşturur', async () => {
    await environment.prisma.$transaction(async (tx) => {
      await service.createUserGrant(tx, {
        documentId,
        grantedToUserId: userId,
        grantScope: DocumentGrantScope.FULL_ACCESS,
      });
    });

    const grant = await environment.prisma.documentAccessGrant.findFirst({
      where: { documentId, grantedToUserId: userId, revokedAt: null },
    });

    expect(grant?.grantScope).toBe(DocumentGrantScope.FULL_ACCESS);
  });

  it('revokeGrant sonrası hasActiveGrant false döner', async () => {
    const grant = await environment.prisma.documentAccessGrant.findFirstOrThrow({
      where: { documentId, grantedToUserId: userId, revokedAt: null },
    });

    await environment.prisma.$transaction(async (tx) => {
      await service.revokeGrant(tx, grant.id);
    });

    const active = await service.hasActiveGrant(
      {
        id: userId,
        email: 'x@ethics.local',
        displayName: 'X',
        roles: [Role.COUNCIL_MEMBER],
        clearanceLevel: 'SENSITIVE',
        companyId: null,
        companyName: null,
        functionId: null,
        locationId: null,
        isGeneralSecretary: false,
      },
      documentId,
      DocumentGrantScope.FULL_ACCESS,
    );

    expect(active).toBe(false);
  });

  it('createRoleGrant idempotent — aynı role ikinci grant oluşturmaz', async () => {
    const roleDocumentId = randomUUID();
    const caseIdForRole = randomUUID();
    const reportId = randomUUID();
    const companyId = await seedSyntheticCompany(environment.prisma);

    await environment.prisma.report.create({
      data: {
        id: reportId,
        trackingCode: 'ETK-ROLE02',
        trackingCodePasswordHash: '$argon2id$v=19$m=65536,t=3,p=1$c2FsdHNhbHQ$hash',
        incidentCountry: 'TUR',
        incidentCity: 'İstanbul',
        companyId,
        categoryGroup: 'asset_financial',
        categories: ['embezzlement'],
        incidentDescription: 'ciphertext',
        encryptionMetadata: {},
        status: 'submitted',
        confidentialityLevel: 'SENSITIVE',
        channel: 'web_form',
        kvkkConsentVersion: '1.0',
        kvkkConsentAt: new Date(),
        submittedAt: new Date(),
      },
    });

    await environment.prisma.case.create({
      data: {
        id: caseIdForRole,
        reportId,
        currentState: 'report_submitted',
        workflowVersion: '1.0.0',
        confidentialityLevel: 'SENSITIVE',
        companyId,
        createdBy: userId,
      },
    });

    await environment.prisma.document.create({
      data: {
        id: roleDocumentId,
        caseId: caseIdForRole,
        reportId,
        documentCategory: DocumentCategory.COMPANY_EVIDENCE,
        title: 'Role Idempotent Doc',
        confidentialityLevel: 'SENSITIVE',
      },
    });

    await environment.prisma.$transaction(async (tx) => {
      await service.createRoleGrant(tx, {
        documentId: roleDocumentId,
        grantedToRole: Role.COUNCIL_CHAIR,
        grantScope: DocumentGrantScope.FULL_ACCESS,
      });
      await service.createRoleGrant(tx, {
        documentId: roleDocumentId,
        grantedToRole: Role.COUNCIL_CHAIR,
        grantScope: DocumentGrantScope.FULL_ACCESS,
      });
    });

    const grants = await environment.prisma.documentAccessGrant.findMany({
      where: { documentId: roleDocumentId, grantedToRole: Role.COUNCIL_CHAIR, revokedAt: null },
    });
    expect(grants).toHaveLength(1);
  });

  it('createRoleGrant rol bazlı erişim sağlar', async () => {
    const roleDocumentId = randomUUID();
    const caseId = randomUUID();
    const reportId = randomUUID();
    const companyId = await seedSyntheticCompany(environment.prisma);

    await environment.prisma.report.create({
      data: {
        id: reportId,
        trackingCode: 'ETK-ROLE01',
        trackingCodePasswordHash: '$argon2id$v=19$m=65536,t=3,p=1$c2FsdHNhbHQ$hash',
        incidentCountry: 'TUR',
        incidentCity: 'İstanbul',
        companyId,
        categoryGroup: 'asset_financial',
        categories: ['embezzlement'],
        incidentDescription: 'ciphertext',
        encryptionMetadata: {},
        status: 'submitted',
        confidentialityLevel: 'SENSITIVE',
        channel: 'web_form',
        kvkkConsentVersion: '1.0',
        kvkkConsentAt: new Date(),
        submittedAt: new Date(),
      },
    });

    await environment.prisma.case.create({
      data: {
        id: caseId,
        reportId,
        currentState: 'report_submitted',
        workflowVersion: '1.0.0',
        confidentialityLevel: 'SENSITIVE',
        companyId,
        createdBy: userId,
      },
    });

    await environment.prisma.document.create({
      data: {
        id: roleDocumentId,
        caseId,
        reportId,
        documentCategory: DocumentCategory.COMPANY_EVIDENCE,
        title: 'Role Grant Doc',
        confidentialityLevel: 'SENSITIVE',
      },
    });

    await environment.prisma.$transaction(async (tx) => {
      await service.createRoleGrant(tx, {
        documentId: roleDocumentId,
        grantedToRole: Role.COUNCIL_CHAIR,
        grantScope: DocumentGrantScope.FULL_ACCESS,
      });
    });

    const active = await service.hasActiveGrant(
      {
        id: randomUUID(),
        email: 'chair@ethics.local',
        displayName: 'Chair',
        roles: [Role.COUNCIL_CHAIR],
        clearanceLevel: 'STRICTLY_CONFIDENTIAL',
        companyId: null,
        companyName: null,
        functionId: null,
        locationId: null,
        isGeneralSecretary: false,
      },
      roleDocumentId,
      DocumentGrantScope.FULL_ACCESS,
    );

    expect(active).toBe(true);
  });

  it('applyTransitionGrants ASSIGN_RAPPORTEUR raportör kategorilerine grant verir', async () => {
    const transitionCaseId = randomUUID();
    const reportId = randomUUID();
    const rapporteurUserId = randomUUID();
    const transitionId = randomUUID();
    const companyId = await seedSyntheticCompany(environment.prisma);

    await environment.prisma.user.create({
      data: {
        id: rapporteurUserId,
        email: `rapporteur-${rapporteurUserId}@ethics.local`,
        displayName: 'Rapporteur',
        clearanceLevel: 'SENSITIVE',
      },
    });

    await environment.prisma.report.create({
      data: {
        id: reportId,
        trackingCode: 'ETK-RAPPORT1',
        trackingCodePasswordHash: '$argon2id$v=19$m=65536,t=3,p=1$c2FsdHNhbHQ$hash',
        incidentCountry: 'TUR',
        incidentCity: 'İstanbul',
        companyId,
        categoryGroup: 'asset_financial',
        categories: ['embezzlement'],
        incidentDescription: 'ciphertext',
        encryptionMetadata: {},
        status: 'submitted',
        confidentialityLevel: 'SENSITIVE',
        channel: 'web_form',
        kvkkConsentVersion: '1.0',
        kvkkConsentAt: new Date(),
        submittedAt: new Date(),
      },
    });

    await environment.prisma.case.create({
      data: {
        id: transitionCaseId,
        reportId,
        currentState: 'report_submitted',
        workflowVersion: '1.0.0',
        confidentialityLevel: 'SENSITIVE',
        companyId,
        createdBy: userId,
      },
    });

    await environment.prisma.caseTransition.create({
      data: {
        id: transitionId,
        caseId: transitionCaseId,
        fromState: 'report_submitted',
        toState: 'pre_research',
        command: WorkflowCommand.ASSIGN_RAPPORTEUR,
        actorType: AuditActorType.USER,
        performedByUserId: userId,
        idempotencyKey: `assign-rapporteur-${transitionId}`,
      },
    });

    const rapporteurDocId = randomUUID();
    const outOfScopeDocId = randomUUID();

    await environment.prisma.document.createMany({
      data: [
        {
          id: rapporteurDocId,
          caseId: transitionCaseId,
          reportId,
          documentCategory: DocumentCategory.RAPPORTEUR_REPORT,
          title: 'Raportör Raporu',
          confidentialityLevel: 'SENSITIVE',
          uploadedByUserId: userId,
        },
        {
          id: outOfScopeDocId,
          caseId: transitionCaseId,
          reportId,
          documentCategory: DocumentCategory.DECISION_DRAFT,
          title: 'Karar Taslağı',
          confidentialityLevel: 'SENSITIVE',
          uploadedByUserId: userId,
        },
      ],
    });

    await environment.prisma.$transaction(async (tx) => {
      await service.applyTransitionGrants(
        tx,
        transitionCaseId,
        {
          id: transitionId,
          fromState: 'report_submitted',
          toState: 'pre_research',
          command: WorkflowCommand.ASSIGN_RAPPORTEUR,
          transitionedAt: new Date(),
          performedByUserId: userId,
        },
        { rapporteurUserId },
      );
    });

    const rapporteurGrant = await service.hasActiveGrant(
      {
        id: rapporteurUserId,
        email: 'r@ethics.local',
        displayName: 'R',
        roles: [Role.RAPPORTEUR],
        clearanceLevel: 'SENSITIVE',
        companyId: null,
        companyName: null,
        functionId: null,
        locationId: null,
        isGeneralSecretary: false,
      },
      rapporteurDocId,
      DocumentGrantScope.FULL_ACCESS,
    );
    const outOfScopeGrant = await service.hasActiveGrant(
      {
        id: rapporteurUserId,
        email: 'r@ethics.local',
        displayName: 'R',
        roles: [Role.RAPPORTEUR],
        clearanceLevel: 'SENSITIVE',
        companyId: null,
        companyName: null,
        functionId: null,
        locationId: null,
        isGeneralSecretary: false,
      },
      outOfScopeDocId,
      DocumentGrantScope.FULL_ACCESS,
    );

    expect(rapporteurGrant).toBe(true);
    expect(outOfScopeGrant).toBe(false);
  });

  it('hasActiveGrant METADATA_ONLY scope ile FULL_ACCESS grant kabul eder', async () => {
    await environment.prisma.$transaction(async (tx) => {
      await service.createUserGrant(tx, {
        documentId,
        grantedToUserId: userId,
        grantScope: DocumentGrantScope.FULL_ACCESS,
      });
    });

    const active = await service.hasActiveGrant(
      {
        id: userId,
        email: 'x@ethics.local',
        displayName: 'X',
        roles: [Role.COUNCIL_MEMBER],
        clearanceLevel: 'SENSITIVE',
        companyId: null,
        companyName: null,
        functionId: null,
        locationId: null,
        isGeneralSecretary: false,
      },
      documentId,
      DocumentGrantScope.METADATA_ONLY,
    );

    expect(active).toBe(true);
  });

  it('applyTransitionGrants geçişe bağlı doküman için performer grant oluşturur', async () => {
    const transitionCaseId = randomUUID();
    const reportId = randomUUID();
    const transitionId = randomUUID();
    const linkedDocId = randomUUID();
    const companyId = await seedSyntheticCompany(environment.prisma);

    await environment.prisma.report.create({
      data: {
        id: reportId,
        trackingCode: 'ETK-LINKED1',
        trackingCodePasswordHash: '$argon2id$v=19$m=65536,t=3,p=1$c2FsdHNhbHQ$hash',
        incidentCountry: 'TUR',
        incidentCity: 'İstanbul',
        companyId,
        categoryGroup: 'asset_financial',
        categories: ['embezzlement'],
        incidentDescription: 'ciphertext',
        encryptionMetadata: {},
        status: 'submitted',
        confidentialityLevel: 'SENSITIVE',
        channel: 'web_form',
        kvkkConsentVersion: '1.0',
        kvkkConsentAt: new Date(),
        submittedAt: new Date(),
      },
    });

    await environment.prisma.case.create({
      data: {
        id: transitionCaseId,
        reportId,
        currentState: 'report_submitted',
        workflowVersion: '1.0.0',
        confidentialityLevel: 'SENSITIVE',
        companyId,
        createdBy: userId,
      },
    });

    await environment.prisma.caseTransition.create({
      data: {
        id: transitionId,
        caseId: transitionCaseId,
        fromState: 'report_submitted',
        toState: 'report_submitted',
        command: WorkflowCommand.OPEN_CASE,
        actorType: AuditActorType.SYSTEM,
        performedByUserId: userId,
        idempotencyKey: `linked-doc-${transitionId}`,
      },
    });

    await environment.prisma.document.create({
      data: {
        id: linkedDocId,
        caseId: transitionCaseId,
        reportId,
        transitionId,
        documentCategory: DocumentCategory.COMPANY_EVIDENCE,
        title: 'Geçişe Bağlı Doküman',
        confidentialityLevel: 'SENSITIVE',
        uploadedByUserId: userId,
      },
    });

    await environment.prisma.$transaction(async (tx) => {
      await service.applyTransitionGrants(
        tx,
        transitionCaseId,
        {
          id: transitionId,
          fromState: 'report_submitted',
          toState: 'report_submitted',
          command: WorkflowCommand.OPEN_CASE,
          transitionedAt: new Date(),
          performedByUserId: userId,
        },
        {},
      );
    });

    const grant = await environment.prisma.documentAccessGrant.findFirst({
      where: {
        documentId: linkedDocId,
        grantedToUserId: userId,
        grantedByTransitionId: transitionId,
        revokedAt: null,
      },
    });
    expect(grant).not.toBeNull();
  });

  it('applyTransitionGrants ASSIGN_ACTION aksiyon sahibi kategorilerine grant verir', async () => {
    const transitionCaseId = randomUUID();
    const reportId = randomUUID();
    const transitionId = randomUUID();
    const actionOwnerUserId = randomUUID();
    const actionDocId = randomUUID();
    const companyId = await seedSyntheticCompany(environment.prisma);

    await environment.prisma.user.create({
      data: {
        id: actionOwnerUserId,
        email: `action-owner-${actionOwnerUserId}@ethics.local`,
        displayName: 'Action Owner',
        clearanceLevel: 'SENSITIVE',
        companyId,
      },
    });

    await environment.prisma.report.create({
      data: {
        id: reportId,
        trackingCode: 'ETK-ACTION1',
        trackingCodePasswordHash: '$argon2id$v=19$m=65536,t=3,p=1$c2FsdHNhbHQ$hash',
        incidentCountry: 'TUR',
        incidentCity: 'İstanbul',
        companyId,
        categoryGroup: 'asset_financial',
        categories: ['embezzlement'],
        incidentDescription: 'ciphertext',
        encryptionMetadata: {},
        status: 'submitted',
        confidentialityLevel: 'SENSITIVE',
        channel: 'web_form',
        kvkkConsentVersion: '1.0',
        kvkkConsentAt: new Date(),
        submittedAt: new Date(),
      },
    });

    await environment.prisma.case.create({
      data: {
        id: transitionCaseId,
        reportId,
        currentState: 'report_submitted',
        workflowVersion: '1.0.0',
        confidentialityLevel: 'SENSITIVE',
        companyId,
        createdBy: userId,
      },
    });

    await environment.prisma.caseTransition.create({
      data: {
        id: transitionId,
        caseId: transitionCaseId,
        fromState: 'report_submitted',
        toState: 'action_assigned',
        command: WorkflowCommand.ASSIGN_ACTION,
        actorType: AuditActorType.USER,
        performedByUserId: userId,
        idempotencyKey: `assign-action-${transitionId}`,
      },
    });

    await environment.prisma.document.create({
      data: {
        id: actionDocId,
        caseId: transitionCaseId,
        reportId,
        documentCategory: DocumentCategory.IMPLEMENTATION_LETTER,
        title: 'Uygulama Yazısı',
        confidentialityLevel: 'SENSITIVE',
        uploadedByUserId: userId,
      },
    });

    await environment.prisma.$transaction(async (tx) => {
      await service.applyTransitionGrants(
        tx,
        transitionCaseId,
        {
          id: transitionId,
          fromState: 'report_submitted',
          toState: 'action_assigned',
          command: WorkflowCommand.ASSIGN_ACTION,
          transitionedAt: new Date(),
          performedByUserId: userId,
        },
        { actionOwnerUserId },
      );
    });

    const active = await service.hasActiveGrant(
      {
        id: actionOwnerUserId,
        email: 'ao@ethics.local',
        displayName: 'AO',
        roles: [Role.ACTION_OWNER],
        clearanceLevel: 'SENSITIVE',
        companyId,
        companyName: null,
        functionId: null,
        locationId: null,
        isGeneralSecretary: false,
      },
      actionDocId,
      DocumentGrantScope.FULL_ACCESS,
    );

    expect(active).toBe(true);
  });
});

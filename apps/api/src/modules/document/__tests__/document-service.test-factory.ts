import { AuditEventPublisher } from '../../../audit/audit-event.publisher.js';
import { DocumentPolicyService } from '../../../authorization/document-policy.service.js';
import { PolicyScopeService } from '../../../authorization/policy-scope.service.js';
import type { EnvService } from '../../../common/config/env.service.js';
import { CryptoService } from '../../../crypto/crypto.service.js';
import { LocalKeyManagementAdapter } from '../../../crypto/key-management.adapter.js';
import type { PrismaService } from '../../../prisma/prisma.service.js';
import { LocalObjectStorageAdapter } from '../../../storage/local-object-storage.adapter.js';
import { DocumentAccessService } from '../document-access.service.js';
import { DocumentEnvelopeService } from '../document-envelope.service.js';
import { DocumentService } from '../document.service.js';

export const TEST_FIELD_KEK = Buffer.alloc(32, 0x01).toString('base64');
export const TEST_DOCUMENT_KEK = Buffer.alloc(32, 0x02).toString('base64');

export function buildDocumentTestEnvService(): EnvService {
  return {
    isProduction: false,
    cryptoKeyManagementProvider: 'local',
    cryptoLocalKekField: TEST_FIELD_KEK,
    cryptoLocalKekDocument: TEST_DOCUMENT_KEK,
  } as EnvService;
}

export type DocumentServiceTestContext = {
  service: DocumentService;
  storage: LocalObjectStorageAdapter;
  envelopeService: DocumentEnvelopeService;
  cryptoService: CryptoService;
  documentAccess: DocumentAccessService;
};

export function extractLocalStorageDownloadKey(downloadUrl: string): string {
  const match = /local-storage:\/\/get\/([^?]+)/.exec(downloadUrl);
  if (!match?.[1]) {
    throw new Error(`Invalid local storage download URL: ${downloadUrl}`);
  }
  return decodeURIComponent(match[1]);
}

export function createDocumentServiceForTests(prisma: PrismaService): DocumentServiceTestContext {
  const keyManagement = new LocalKeyManagementAdapter(buildDocumentTestEnvService());
  const cryptoService = new CryptoService(keyManagement);
  const envelopeService = new DocumentEnvelopeService(cryptoService);
  const storage = new LocalObjectStorageAdapter();
  const documentAccess = new DocumentAccessService(prisma);
  const documentPolicy = new DocumentPolicyService({ get: () => documentAccess } as never);
  documentPolicy.wireDocumentAccessServiceForTests(documentAccess);

  const service = new DocumentService(
    prisma,
    new PolicyScopeService(),
    documentPolicy,
    cryptoService,
    envelopeService,
    documentAccess,
    storage,
    new AuditEventPublisher(),
  );

  return { service, storage, envelopeService, cryptoService, documentAccess };
}

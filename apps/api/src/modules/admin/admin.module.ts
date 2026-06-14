import { Module } from '@nestjs/common';

import { AuthorizationModule } from '../../authorization/authorization.module.js';
import { AuditModule } from '../../audit/audit.module.js';
import { PrismaModule } from '../../prisma/prisma.module.js';
import { EnvModule } from '../../common/config/env.module.js';
import { AdminMasterDataController } from './master-data/admin-master-data.controller.js';
import { AdminMasterDataService } from './master-data/admin-master-data.service.js';
import { AdminUsersController } from './users/admin-users.controller.js';
import { AdminUsersService } from './users/admin-users.service.js';
import { ActionMatrixAdminService } from './config/action-matrix.service.js';
import { ActionMatrixController } from './config/action-matrix.controller.js';
import { ConfigService } from './config/config.service.js';
import { FieldVisibilityAdminService } from './config/field-visibility.service.js';
import { FieldVisibilityController } from './config/field-visibility.controller.js';
import { SystemSettingsController } from './config/system-settings.controller.js';
import { ActionMatrixConfigService } from './maker-checker/action-matrix-config.service.js';
import { MakerCheckerService } from './maker-checker/maker-checker.service.js';
import { SlaPoliciesController } from './sla/sla-policies.controller.js';
import { BusinessCalendarController } from './sla/business-calendar.controller.js';
import { SlaPolicyAdminService } from './sla/sla-policy-admin.service.js';
import { BusinessCalendarAdminService } from './sla/business-calendar-admin.service.js';
import { NotificationTemplateController } from './notification/notification-template.controller.js';
import { NotificationTemplateAdminService } from './notification/notification-template-admin.service.js';
import { KvkkTextController } from './kvkk/kvkk-text.controller.js';
import { KvkkTextAdminService } from './kvkk/kvkk-text-admin.service.js';
import { EmailRelayService } from '../integration/email/email-relay.service.js';
import { AuditViewerController } from './monitoring/audit-viewer.controller.js';
import { DocumentOpsAdminController } from './monitoring/document-ops-admin.controller.js';
import { SystemHealthAdminController } from './monitoring/system-health-admin.controller.js';
import { AuditViewerService } from './monitoring/audit-viewer.service.js';
import { DocumentOpsAdminService } from './monitoring/document-ops-admin.service.js';
import { SystemHealthAdminService } from './monitoring/system-health-admin.service.js';
import { StorageModule } from '../../storage/storage.module.js';

@Module({
  imports: [PrismaModule, AuditModule, AuthorizationModule, EnvModule, StorageModule],
  controllers: [
    AdminUsersController,
    AdminMasterDataController,
    SystemSettingsController,
    FieldVisibilityController,
    ActionMatrixController,
    SlaPoliciesController,
    BusinessCalendarController,
    NotificationTemplateController,
    KvkkTextController,
    AuditViewerController,
    DocumentOpsAdminController,
    SystemHealthAdminController,
  ],
  providers: [
    AdminUsersService,
    AdminMasterDataService,
    ConfigService,
    FieldVisibilityAdminService,
    ActionMatrixAdminService,
    ActionMatrixConfigService,
    MakerCheckerService,
    SlaPolicyAdminService,
    BusinessCalendarAdminService,
    NotificationTemplateAdminService,
    KvkkTextAdminService,
    EmailRelayService,
    AuditViewerService,
    DocumentOpsAdminService,
    SystemHealthAdminService,
  ],
  exports: [
    AdminUsersService,
    AdminMasterDataService,
    ConfigService,
    FieldVisibilityAdminService,
    ActionMatrixAdminService,
    ActionMatrixConfigService,
    MakerCheckerService,
    SlaPolicyAdminService,
    BusinessCalendarAdminService,
    NotificationTemplateAdminService,
    KvkkTextAdminService,
    AuditViewerService,
    DocumentOpsAdminService,
    SystemHealthAdminService,
  ],
})
export class AdminModule {}

import type { PrismaClient } from '@prisma/client';
import { DEFAULT_NOTIFICATION_TEMPLATES, NOTIFICATION_TEMPLATE_CODE_VALUES } from '@ethics/shared';

export async function seedNotificationTemplates(prisma: PrismaClient): Promise<void> {
  for (const template of DEFAULT_NOTIFICATION_TEMPLATES) {
    await prisma.notificationTemplate.upsert({
      where: { templateCode: template.templateCode },
      create: {
        templateCode: template.templateCode,
        name: template.name,
        channel: template.channel,
        subjectTemplate: template.subjectTemplate,
        bodyTemplate: template.bodyTemplate,
        isActive: template.isActive,
        versionNo: 1,
      },
      update: {
        name: template.name,
        channel: template.channel,
        subjectTemplate: template.subjectTemplate,
        bodyTemplate: template.bodyTemplate,
        isActive: template.isActive,
      },
    });
  }

  if (DEFAULT_NOTIFICATION_TEMPLATES.length !== NOTIFICATION_TEMPLATE_CODE_VALUES.length) {
    throw new Error(
      `Notification template seed mismatch: expected ${String(NOTIFICATION_TEMPLATE_CODE_VALUES.length)}, got ${String(DEFAULT_NOTIFICATION_TEMPLATES.length)}`,
    );
  }
}

import type { NotificationTemplateConfigSnapshot } from '@ethics/dto';
import type { NotificationTemplate } from '@prisma/client';

export function toNotificationTemplateConfigSnapshot(
  template: Pick<NotificationTemplate, 'name' | 'subjectTemplate' | 'bodyTemplate' | 'isActive'>,
): NotificationTemplateConfigSnapshot {
  return {
    name: template.name,
    subjectTemplate: template.subjectTemplate,
    bodyTemplate: template.bodyTemplate,
    isActive: template.isActive,
  };
}

export function configsEqual(
  left: NotificationTemplateConfigSnapshot,
  right: NotificationTemplateConfigSnapshot,
): boolean {
  return (
    left.name === right.name &&
    left.subjectTemplate === right.subjectTemplate &&
    left.bodyTemplate === right.bodyTemplate &&
    left.isActive === right.isActive
  );
}

export function validateNotificationTemplateBody(body: string): string | null {
  if (body.length < 1) {
    return 'Şablon gövdesi boş olamaz.';
  }

  return null;
}

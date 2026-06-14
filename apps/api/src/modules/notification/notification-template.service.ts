import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import {
  ErrorCode,
  NotificationTemplateCode,
  renderNotificationEmailTemplate,
  type NotificationTemplateCodeValue,
  type RenderedNotificationEmail,
} from '@ethics/shared';

import { DomainException } from '../../common/exceptions/domain.exception.js';
import { PrismaService } from '../../prisma/prisma.service.js';

export interface RenderNotificationTemplateInput {
  templateCode: NotificationTemplateCodeValue;
  fallbackSubject?: string;
}

@Injectable()
export class NotificationTemplateService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async renderEmailTemplate(
    input: RenderNotificationTemplateInput,
  ): Promise<RenderedNotificationEmail> {
    const template = await this.prisma.notificationTemplate.findUnique({
      where: { templateCode: input.templateCode },
      select: {
        templateCode: true,
        subjectTemplate: true,
        bodyTemplate: true,
        isActive: true,
      },
    });

    if (!template?.isActive) {
      throw new DomainException(
        ErrorCode.NOTIFICATION_TEMPLATE_UNAVAILABLE,
        'Bildirim şablonu kullanılamıyor.',
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    }

    if (template.templateCode === NotificationTemplateCode.SECURE_MESSAGE_REPORTER) {
      throw new DomainException(
        ErrorCode.NOTIFICATION_EMAIL_NOT_ALLOWED,
        'Anonim bildirimci kanalı için e-posta gönderilemez.',
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    }

    return renderNotificationEmailTemplate({
      subjectTemplate: template.subjectTemplate,
      bodyTemplate: template.bodyTemplate,
      fallbackSubject: input.fallbackSubject,
    });
  }
}

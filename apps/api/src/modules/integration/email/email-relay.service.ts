import { Injectable } from '@nestjs/common';

import { EnvService } from '../../../common/config/env.service.js';
import { createSmtpEmailRelayAdapter } from './email-relay.adapter.js';
import type { EmailRelayPort, SendEmailInput, SendEmailResult } from './email-relay.port.js';

@Injectable()
export class EmailRelayService implements EmailRelayPort {
  private readonly relay: EmailRelayPort | null;

  constructor(envService: EnvService) {
    const env = envService.config;
    this.relay =
      env.SMTP_HOST && env.SMTP_FROM_ADDRESS
        ? createSmtpEmailRelayAdapter({
            host: env.SMTP_HOST,
            port: env.SMTP_PORT,
            user: env.SMTP_USER,
            pass: env.SMTP_PASS,
            fromAddress: env.SMTP_FROM_ADDRESS,
            secure: env.SMTP_SECURE,
          })
        : null;
  }

  async sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
    if (!this.relay) {
      throw new Error('SMTP relay is not configured');
    }

    return this.relay.sendEmail(input);
  }

  isConfigured(): boolean {
    return this.relay !== null;
  }
}

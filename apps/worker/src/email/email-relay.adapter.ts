import nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';

import type { EmailRelayPort, SendEmailInput, SendEmailResult } from './email-relay.port.js';

export interface SmtpEmailRelayConfig {
  host: string;
  port: number;
  user?: string;
  pass?: string;
  fromAddress: string;
  secure?: boolean;
}

export class SmtpEmailRelayAdapter implements EmailRelayPort {
  constructor(
    private readonly transporter: Transporter,
    private readonly fromAddress: string,
  ) {}

  async sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
    const info = (await this.transporter.sendMail({
      from: this.fromAddress,
      to: input.to,
      subject: input.subject,
      text: input.textBody,
      html: input.htmlBody,
      headers: input.correlationId
        ? {
            'X-Correlation-Id': input.correlationId,
          }
        : undefined,
    })) as { messageId?: string };

    const messageId =
      typeof info.messageId === 'string' && info.messageId.length > 0
        ? info.messageId
        : `smtp-${String(Date.now())}`;

    return { messageId };
  }
}

export function createSmtpEmailRelayAdapter(config: SmtpEmailRelayConfig): SmtpEmailRelayAdapter {
  const transporter = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure ?? config.port === 465,
    auth:
      config.user && config.pass
        ? {
            user: config.user,
            pass: config.pass,
          }
        : undefined,
    tls: {
      rejectUnauthorized: process.env.NODE_ENV === 'production',
    },
  });

  return new SmtpEmailRelayAdapter(transporter, config.fromAddress);
}

function readSmtpConfigFromEnv(): SmtpEmailRelayConfig | null {
  const host = process.env.SMTP_HOST?.trim();
  const fromAddress = process.env.SMTP_FROM_ADDRESS?.trim() ?? process.env.SMTP_FROM?.trim();

  if (!host || !fromAddress) {
    return null;
  }

  const port = Number(process.env.SMTP_PORT ?? '587');
  const user = process.env.SMTP_USER?.trim() || process.env.SMTP_USERNAME?.trim();
  const pass = process.env.SMTP_PASS?.trim() || process.env.SMTP_PASSWORD?.trim();

  return {
    host,
    port: Number.isFinite(port) ? port : 587,
    user: user || undefined,
    pass: pass || undefined,
    fromAddress,
    secure: process.env.SMTP_SECURE === 'true',
  };
}

export function createEmailRelayFromEnv(): EmailRelayPort | null {
  const config = readSmtpConfigFromEnv();
  if (!config) {
    return null;
  }

  return createSmtpEmailRelayAdapter(config);
}

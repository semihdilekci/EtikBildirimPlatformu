import type { EmailRelayPort, SendEmailInput, SendEmailResult } from './email-relay.port.js';

export interface CapturedEmail extends SendEmailInput {
  messageId: string;
  sentAt: Date;
}

export class InMemoryEmailRelayAdapter implements EmailRelayPort {
  readonly sent: CapturedEmail[] = [];

  sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
    const messageId = `mem-${String(this.sent.length + 1)}`;
    this.sent.push({
      ...input,
      messageId,
      sentAt: new Date(),
    });

    return Promise.resolve({ messageId });
  }

  clear(): void {
    this.sent.length = 0;
  }
}

export interface SendEmailInput {
  to: string;
  subject: string;
  textBody: string;
  htmlBody: string;
  correlationId?: string;
}

export interface SendEmailResult {
  messageId: string;
}

export interface EmailRelayPort {
  sendEmail(input: SendEmailInput): Promise<SendEmailResult>;
}

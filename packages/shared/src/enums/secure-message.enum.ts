/** DB direction — bildirim perspektifinden */
export const SecureMessageDirection = {
  INBOUND_FROM_REPORTER: 'INBOUND_FROM_REPORTER',
  OUTBOUND_TO_REPORTER: 'OUTBOUND_TO_REPORTER',
} as const;

export type SecureMessageDirectionCode =
  (typeof SecureMessageDirection)[keyof typeof SecureMessageDirection];

export const SECURE_MESSAGE_DIRECTION_VALUES = Object.values(SecureMessageDirection);

/** API yanıt direction — bildirimci UI perspektifi */
export const SecureMessageApiDirection = {
  INBOUND: 'INBOUND',
  OUTBOUND: 'OUTBOUND',
} as const;

export type SecureMessageApiDirectionCode =
  (typeof SecureMessageApiDirection)[keyof typeof SecureMessageApiDirection];

export const SecureMessageSenderType = {
  SYSTEM_USER: 'SYSTEM_USER',
  ANONYMOUS_REPORTER: 'ANONYMOUS_REPORTER',
} as const;

export type SecureMessageSenderTypeCode =
  (typeof SecureMessageSenderType)[keyof typeof SecureMessageSenderType];

export const SECURE_MESSAGE_SENDER_TYPE_VALUES = Object.values(SecureMessageSenderType);

export const SECURE_MESSAGE_SENDER_LABELS: Record<SecureMessageApiDirectionCode, string> = {
  [SecureMessageApiDirection.INBOUND]: 'Etik Kurul Sekretaryası',
  [SecureMessageApiDirection.OUTBOUND]: 'Bildirimci',
};

export function toSecureMessageApiDirection(
  dbDirection: SecureMessageDirectionCode,
): SecureMessageApiDirectionCode {
  return dbDirection === SecureMessageDirection.OUTBOUND_TO_REPORTER
    ? SecureMessageApiDirection.INBOUND
    : SecureMessageApiDirection.OUTBOUND;
}

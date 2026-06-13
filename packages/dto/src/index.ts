export { PLATFORM_NAME } from '@ethics/shared';

export {
  authMeResponseSchema,
  authLogoutResponseSchema,
  type AuthMeResponse,
  type AuthLogoutResponse,
} from './auth/index.js';

export {
  createReportBodySchema,
  createReportResponseSchema,
  intakeCompanyListItemSchema,
  intakeKvkkTextResponseSchema,
  involvedPersonSchema,
  witnessSchema,
  embezzlementCategoryDataSchema,
  categorySpecificDataSchemas,
  type CreateReportBody,
  type CreateReportResponse,
  type IntakeCompanyListItem,
  type IntakeKvkkTextResponse,
  type CategorySpecificDataSchemas,
} from './intake/index.js';

export {
  initiateAttachmentBodySchema,
  initiateAttachmentResponseSchema,
  type InitiateAttachmentBody,
  type InitiateAttachmentResponse,
} from './intake/index.js';

export {
  trackingLoginSchema,
  trackingVerifyResponseSchema,
  trackingStatusResponseSchema,
  sendSecureMessageBodySchema,
  secureMessageItemSchema,
  secureMessageListResponseSchema,
  sendSecureMessageResponseSchema,
  type TrackingLoginValues,
  type TrackingVerifyResponse,
  type TrackingStatusResponse,
  type SendSecureMessageBody,
  type SecureMessageItem,
  type SendSecureMessageResponse,
} from './tracking/index.js';
